import {CompareType} from "./parser.js";
import {VariableType} from "./variabletype.js";
import {FunctionEntry} from "./functionentry.js";
import {ContextInterpreter} from "./interpreter.js";
import {FunctionParameter} from "./functionparameter";
import {MSLangException} from "./exceptions";

interface VariableProperty {
    get?: unknown;
    set?: unknown;
}

const funcEntryCache: Record<string, Record<string, FunctionEntry>> = {};

export class StackVariable {
    _type: VariableType
    _value: unknown
    _isConst : boolean
    properties: Record<string, VariableProperty> = {}

    constructor(type: VariableType, isConst: boolean = false) {
        this._type = type;
        this._value = undefined;
        this._isConst = isConst;
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

        let idx = Object.values(VariableType).indexOf(this._type);

        if (idx < 0)
            return '???';

        return Object.keys(VariableType)[idx].substring(2).toLowerCase();
    }

    get value() {
        return this._value;
    }

    set value(value) {
        throw new MSLangException('value is read only');
    }

    get isConst() {
        return this._isConst;
    }

    get functions() {
        let c = this.constructor.name;

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
                return this.value == variable.value;
            case CompareType.ctNotEqual:
                return this.value != variable.value;
        }

        throw new MSLangException('Invalid compare type');
    }

    castAs<T extends VariableType>(variableType: T): SpecificStackVariable<T>|null {
        return null;
    }

    _getFunctionEntry(name:string)
    {
        let methodName = name.charAt(0).toUpperCase() === name.charAt(0) ? 'funcInvoke' + name : 'funcInvoke_'+name;

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

        const entry = new FunctionEntry(name, funcReturnType, (...args: InvokeArguments[]) => {
            return this.invokeMethod(entry, methodName, args);
        });

        funcArguments.forEach(funcArgument => {
            if (funcArgument instanceof FunctionParameter || typeof funcArgument === 'string')
            {
                entry.addParameter(funcArgument);
            } else {
                throw new MSLangException('Invalid argument type: '+typeof funcArgument);
            }

        });

        return entry;
    }

    _getFunctions()
    {
        let list:Record<string, FunctionEntry> = {};

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

            let entry = this._getFunctionEntry(funcName);
            if (entry)
            {
                list[funcName.toLowerCase()] = entry;
            }
        });

        return list;
    }

    getFunctionEntry(name: string) {
        let c = this.constructor.name;

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
            throw new MSLangException('Arguments is empty');
        }

        let funcArguments = entry.getParameters();

        invokeArguments = Object.values(invokeArguments);

        let self = invokeArguments.shift();

        if (typeof self !== 'object' || self === null)
        {
            throw new MSLangException(entry.getName()+' called on null or undefined');
        }

        if (typeof (this as any)[methodName] !== 'function') {
            throw new MSLangException(methodName+' method not exists on object');
        }

        let index = 0,
            callArguments: unknown[] = [];

        invokeArguments.forEach(argument => {
            if (!(argument instanceof StackVariable))
            {
                throw new MSLangException('Argument must be instance of '+StackVariable.constructor.name);
            }

            if (funcArguments[index])
            {
                callArguments.push(argument.value);
            } else {
                callArguments.push(argument);
            }

            index++;
        });

        let returnValue =  (this as any)[methodName].apply(self, callArguments);

        if (returnValue instanceof StackVariable)
            return returnValue;

        return ContextInterpreter.createVariable(entry.getReturnType(), returnValue);
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
        let v = this.castAs(VariableType.vtString);

        if (v)
            return v.value;

        throw new MSLangException('Failed ' + this.typeName + ' cast as string');
    }

    // Приведение значения к примитиву (для конкатенации, арифметики и т.п.).
    // Подклассы переопределяют. База — зеркало PHP StackVariable::toPrimitive.
    toPrimitive(): StackVariable {
        switch (this.type) {
            case VariableType.vtVoid:
                return ContextInterpreter.createVariable(VariableType.vtString, 'void');
            case VariableType.vtObject:
                return ContextInterpreter.createVariable(VariableType.vtString, '[object]');
            case VariableType.vtString:
            case VariableType.vtNumber:
                return this;
        }

        throw new MSLangException('Failed get primitive for ' + this.typeName);
    }

}
