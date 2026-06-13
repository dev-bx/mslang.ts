import {CompareType} from "./parser.js";
import {VariableType} from "./variabletype.js";
import {FunctionEntry} from "./functionentry.js";
import type {ContextInterpreter} from "./contextinterpreter.js";
import {FunctionParameter} from "./functionparameter";
import {InterpreterException} from "./exceptions";
import {phpLooseEqual} from "./phpsemantics";

interface VariableProperty {
    get?: unknown;
    set?: unknown;
}

// O-3: общий пустой набор свойств. Базовое поле раньше инициализировалось
// литералом `{}` — это аллокация на КАЖДОЕ создание StackVariable. Объект
// свойств только читается (см. getProperty/setProperty), поэтому безопасно
// разделять один экземпляр. Подклассы со своими свойствами перекрывают поле.
const EMPTY_PROPERTIES: Record<string, VariableProperty> = Object.freeze({});

const funcEntryCache: Record<string, Record<string, FunctionEntry>> = {};

// Фабрика значений живёт статическим методом в ContextInterpreter, но базовый
// StackVariable не может импортировать его в рантайме: получится цикл модулей
// (база → ContextInterpreter → подклассы → база), и подкласс пытается наследовать
// ещё не инициализированную базу (TDZ). Поэтому импорт типа-только, а сам метод
// ContextInterpreter регистрирует здесь после своего объявления (низ contextinterpreter.ts).
type CreateVariableFn = (type: VariableType, value: unknown) => StackVariable;
let createVariableFn: CreateVariableFn | null = null;
export function _registerCreateVariable(fn: CreateVariableFn): void {
    createVariableFn = fn;
}

export class StackVariable {
    _type: VariableType
    _value: unknown
    _isConst : boolean
    //Зеркало PHP StackVariable::$context: контекст-владелец (учёт бюджета данных,
    //доступ из методов). null у переменных, созданных без контекста.
    protected _context: ContextInterpreter | null = null;
    properties: Record<string, VariableProperty> = EMPTY_PROPERTIES

    constructor(type: VariableType, isConst: boolean = false, context: ContextInterpreter | null = null) {
        this._type = type;
        this._value = undefined;
        this._isConst = isConst;
        this._context = context;
    }

    getContext(): ContextInterpreter | null {
        return this._context;
    }

    setContext(context: ContextInterpreter | null): void {
        this._context = context;
    }

    get isNumeric() {
        switch (this.type) {
            case VariableType.vtInteger:
            case VariableType.vtFloat:
            case VariableType.vtNumber:
                return true;
        }

        return false;
    }

    get type() {
        return this._type;
    }

    get typeName() {
        switch (this._type) {
            case VariableType.vtUndefined:
                return 'undefined';
            case VariableType.vtVoid:
                return 'void';
            case VariableType.vtNull:
                return 'null';
            case VariableType.vtNumber:
                return 'number';
            case VariableType.vtInteger:
                return 'int';
            case VariableType.vtFloat:
                return 'float';
            case VariableType.vtBoolean:
                return 'bool';
            case VariableType.vtArray:
                return 'array';
            case VariableType.vtObject:
                return 'object';
            case VariableType.vtFunction:
                return 'function';
        }

        const idx = Object.values(VariableType).indexOf(this._type);

        if (idx < 0)
            return '???';

        return Object.keys(VariableType)[idx].substring(2).toLowerCase();
    }

    get value() {
        return this._value;
    }

    set value(value) {
        throw new InterpreterException('value is read only', this.getContext()?.currentToken?.cursorPos);
    }

    get isConst() {
        return this._isConst;
    }

    get functions() {
        const c = this.constructor.name;

        if (!funcEntryCache.hasOwnProperty(c))
        {
            funcEntryCache[c] = {};
            funcEntryCache[c] = this._getFunctions();
        }

        return funcEntryCache[c];
    }

    getProperty(name: string) {
        if (!this.properties.hasOwnProperty(name))
            return undefined;

        if (typeof this.properties[name].get !== 'function')
            return undefined;

        return this.properties[name].get.apply(this);
    }

    setProperty(name: string, value: unknown) {
        if (!this.properties.hasOwnProperty(name))
            return;

        if (typeof this.properties[name].set !== 'function')
            return;

        this.properties[name].set(name, value);
    }

    comparePriority(variable: StackVariable, compareType: CompareType):number|false {
        if (compareType !== CompareType.ctEqual && compareType !== CompareType.ctNotEqual)
            return false;

        return 0;
    }

    compare(variable: StackVariable, compareType: CompareType) {
        switch (compareType) {
            case CompareType.ctEqual:
                return phpLooseEqual(this.value, variable.value);
            case CompareType.ctNotEqual:
                return !phpLooseEqual(this.value, variable.value);
        }

        throw new InterpreterException('Invalid compare type', this.getContext()?.currentToken?.cursorPos);
    }

    castAs<T extends VariableType>(variableType: T): SpecificStackVariable<T>|null {
        return null;
    }

    _getFunctionEntry(name:string)
    {
        const methodName = name.charAt(0).toUpperCase() === name.charAt(0) ? 'funcInvoke' + name : 'funcInvoke_'+name;

        if (typeof (this as any)[methodName] !== 'function') {
            return null;
        }

        let funcArguments: unknown[] = [],
            funcReturnType = null;

        if (typeof (this as any)[methodName + 'Args'] === 'function') {
            funcArguments = (this as any)[methodName + 'Args']();
        } else if (Array.isArray((this as any)[methodName + 'Args'])) {
            funcArguments = (this as any)[methodName + 'Args'];
        }

        if (typeof (this as any)[methodName + 'Return'] === 'function') {
            funcReturnType = (this as any)[methodName + 'Return']();
        } else if (typeof (this as any)[methodName + 'Return'] !== 'undefined') {
            funcReturnType = (this as any)[methodName + 'Return'];
        }

        //Если this — это Proxy от StackVariableRef (см. stackvariableref.getProxy),
        //захватывать его в closure нельзя: ref завязан на запись в текущем scope
        //(_variables / let-кадр). Когда первый вызов прошёл через Proxy на
        //короткоживущей let-переменной (например, `let p = []; p.push(0); this.p = p;`
        //в конструкторе класса), scope умирает, refValue становится undefined,
        //и следующий вызов того же метода — даже на совсем другом объекте —
        //падает с "Reflect.get called on non-object". Свойство `refValue`
        //через Proxy специально отдаёт реальный объект (см. getProxy.get),
        //у обычных StackVariable его нет — берём this как есть.
        const refValueNow = (this as any).refValue;
        const captured: StackVariable = (refValueNow instanceof StackVariable) ? refValueNow : (this as unknown as StackVariable);

        const entry = new FunctionEntry(name, funcReturnType, (...args: InvokeArguments[]) => {
            return captured.invokeMethod(entry, methodName, args);
        });

        funcArguments.forEach(funcArgument => {
            if (funcArgument instanceof FunctionParameter || typeof funcArgument === 'string')
            {
                entry.addParameter(funcArgument);
            } else {
                throw new InterpreterException('Invalid argument type: '+typeof funcArgument, this.getContext()?.currentToken?.cursorPos);
            }

        });

        return entry;
    }

    _getFunctions()
    {
        const list:Record<string, FunctionEntry> = {};

        let keys = [],
            obj = this;

        while (obj)
        {
            keys.push(...Object.getOwnPropertyNames(obj));

            obj = Object.getPrototypeOf(obj);
        }

        keys = [...new Set(keys)];

        keys.forEach(k => {
            if (!k.startsWith('funcInvoke'))
                return;

            let funcName = k.substring(10);

            if (funcName.startsWith('_'))
            {
                funcName = funcName.substring(1);
            }

            if (funcName.endsWith('Return'))
            {
                funcName = funcName.substring(0, funcName.length-6);
            } else if (k.endsWith('Args'))
            {
                funcName = funcName.substring(0, funcName.length-4);
            }

            if (list.hasOwnProperty(funcName.toLowerCase()))
                return;

            if (typeof (this as any)[k] !== 'function')
                return;

            const entry = this._getFunctionEntry(funcName);
            if (entry)
            {
                list[funcName.toLowerCase()] = entry;
            }
        });

        return list;
    }

    getFunctionEntry(name: string) {
        const c = this.constructor.name;

        if (!funcEntryCache.hasOwnProperty(c))
        {
            funcEntryCache[c] = {};
            funcEntryCache[c] = this._getFunctions();
        }

        return funcEntryCache[c][name.toLowerCase()];
    }

    invokeMethod(entry: FunctionEntry, methodName: string, invokeArguments: InvokeArguments) {
        /** @var entry FunctionEntry */

        if (invokeArguments.length < 1) {
            throw new InterpreterException('Arguments is empty', this.getContext()?.currentToken?.cursorPos);
        }

        const funcArguments = entry.getParameters();

        invokeArguments = Object.values(invokeArguments);

        const self = invokeArguments.shift();

        if (typeof self !== 'object' || self === null)
        {
            throw new InterpreterException(entry.getName()+' called on null or undefined', this.getContext()?.currentToken?.cursorPos);
        }

        if (typeof (this as any)[methodName] !== 'function') {
            throw new InterpreterException(methodName+' method not exists on object', this.getContext()?.currentToken?.cursorPos);
        }

        let index = 0;
        const callArguments: unknown[] = [];

        invokeArguments.forEach(argument => {
            if (!(argument instanceof StackVariable))
            {
                throw new InterpreterException('Argument must be instance of '+StackVariable.name, this.getContext()?.currentToken?.cursorPos);
            }

            if (funcArguments[index])
            {
                callArguments.push(argument.value);
            } else {
                callArguments.push(argument);
            }

            index++;
        });

        const returnValue =  (this as any)[methodName].apply(self, callArguments);

        if (returnValue instanceof StackVariable)
            return returnValue;

        //Зеркало PHP: результат оборачивается через контекст переменной (если он есть) —
        //так строки/массивы из методов (repeat, join, concat…) попадают в бюджет данных.
        //Контекст берём с получателя метода (self), запасной вариант — с владельца кэша.
        const ctx = (self instanceof StackVariable ? self.getContext() : null) ?? this.getContext();
        if (ctx) {
            return ctx.createVariable(entry.getReturnType(), returnValue);
        }

        return createVariableFn!(entry.getReturnType(), returnValue);
    }

    funcInvokeToStringArgs()
    {
        return [];
    }

    funcInvokeToStringReturn()
    {
        return VariableType.vtString;
    }

    funcInvokeToString() {
        const v = this.castAs(VariableType.vtString);

        if (v)
            return v.value;

        throw new InterpreterException('Failed ' + this.typeName + ' cast as string', this.getContext()?.currentToken?.cursorPos);
    }

    // Приведение значения к примитиву (для конкатенации, арифметики и т.п.).
    // Подклассы переопределяют. База — зеркало PHP StackVariable::toPrimitive.
    toPrimitive(): StackVariable {
        switch (this.type) {
            case VariableType.vtVoid:
                return createVariableFn!(VariableType.vtString, 'void');
            case VariableType.vtObject:
                return createVariableFn!(VariableType.vtString, '[object]');
            case VariableType.vtString:
            case VariableType.vtNumber:
                return this;
        }

        throw new InterpreterException('Failed get primitive for ' + this.typeName, this.getContext()?.currentToken?.cursorPos);
    }

}
