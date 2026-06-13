// Зеркало PHP ContextInterpreter.php: состояние и ход выполнения скрипта.
import {CodeParser, NodeType, ParseNode} from "./parser";
import {CodeLexer, LexerType, LexerTypeArray} from "./lexer";
import {VariableType} from "./variabletype";
import {StackVariable, _registerCreateVariable} from "./stackvariable";
import {StackVariableNumber} from "./stackvariablenumber";
import {StackVariableString} from "./stackvariablestring";
import {StackVariableBoolean} from "./stackvariableboolean";
import {StackVariableArray} from "./stackvariablearray";
import {StackVariableNull} from "./stackvariablenull";
import {StackVariableUndefined} from "./stackvariableundefined";
import {StackVariableVoid} from "./stackvariablevoid";
import {StackVariableEnv} from "./stackvariableenv";
import {StackVariableFunction} from "./stackvariablefunction";
import {StackVariableUserFunction} from "./stackvariableuserfunction";
import {StackVariableClass} from "./stackvariableclass";
import {FunctionEntry} from "./functionentry";
import {MathFunctions} from "./mathfunctions";
import {StringStaticFunctions} from "./stringstaticfunctions";
import {ArrayConstructor} from "./arrayconstructor";
import {StackVariableDateTime} from "./stackvariabledatetime";
import {ContextException, MSLangException, ResourceLimitException} from "./exceptions";
import {StackVariableRef} from "./stackvariableref";
import {ContextType} from "./contexttype";
import {InterpreterNode} from "./interpreter";
import type {Interpreter} from "./interpreter";

interface ExecutionStackItem {
    variables: Record<string, StackVariable>;
    functions: {};
    codeItems?: ParseNode[];
    codeData: Record<string, unknown>;
    type: number;
    pos: number;
    stackVars: StackVariable[];
    contextVariable?: StackVariableArray;
    isFunctionScope?: boolean;
    capturedScope?: Record<string, StackVariable> | null;
    currentThis?: StackVariable | null;
    currentMethodOwner?: StackVariableClass | null;
    isCtorTDZ?: boolean;
    letNames?: Record<string, boolean>;
}

export class ContextInterpreter {
    _variables: Record<string, StackVariable>;
    _functions
    _codeItems?: ParseNode[];
    // Дополнительные данные для текущего кадра выполнения, например
    // позиция перехода для continue в цикле. Зеркало PHP _codeData.
    _codeData: Record<string, unknown> = {};
    _stackVars: StackVariable[];
    _pos:number;
    _executionStack:ExecutionStackItem[];
    _type
    _interpreter
    _contextVariable?: StackVariableArray; //используется для создания массивов "Array"

    /** Накопленные предупреждения времени выполнения (лишние аргументы и т.п.). */
    protected _warnings: string[] = [];

    /**
     * Снимок переменных «замкнутой» области текущей пользовательской функции.
     * Через него тело видит переменные той области, где функция была определена,
     * даже если её родительский scope уже завершился. Сохраняется в стеке при
     * pushFunctionScope.
     */
    _currentCapturedScope: Record<string, StackVariable> | null = null;

    /**
     * Текущий `this` для выполняемого метода/конструктора.
     * - null означает, что `this` не задан (то есть вызов вне класса) и
     *   обращение к `ntThis` должно бросить ошибку.
     * - в обычных pushExecutionStack-кадрах (блоки/циклы) `this` наследуется
     *   от внешнего scope (см. push/pop); pushFunctionScope сбрасывает его
     *   в null и снова выставляет только если функция вызвана как метод.
     */
    _currentThis: StackVariable | null = null;

    /**
     * Класс, в котором определён выполняемый сейчас метод/конструктор.
     * Нужен для `super(...)` и `super.method(...)`: они должны искать
     * родителя **класса-владельца кода**, а не класса instance (`this`).
     * Иначе цепочка `super` из B застряла бы внутри B при вызове через
     * экземпляр потомка C.
     */
    _currentMethodOwner: StackVariableClass | null = null;

    /**
     * Флаг TDZ для конструктора extends-класса. true означает, что мы внутри
     * ctor класса с extends и `super(...)` ещё не вызван — любое обращение
     * к `this` должно бросить ошибку. После первого `super(...)` сбрасывается.
     */
    _isCtorTDZ: boolean = false;

    /**
     * Имена переменных, объявленных в текущем блоке через `let` или `const`.
     * Используется в двух местах:
     * 1) popExecutionStack — эти имена не копируются обратно в parent scope
     *    (block scope: `let x` внутри `{ ... }` не утекает наружу).
     * 2) setVariable / varDecl — позволяет различать «локальная let-переменная
     *    того же scope» от «совпадение имени с переменной родителя».
     */
    _letNames: Record<string, boolean> = {};

    // Ограничение количества инструкций выполнения. 0 — без ограничений.
    // Зеркало PHP limitExecInstruction + instructionCounter.
    protected limitExecInstruction: number = 0;
    protected instructionCounter: number = 0;
    //Лимит времени работы скрипта в миллисекундах (0 = выключен). Отметка старта
    //ставится в exec(); проверка — в execOne, рядом со счётчиком инструкций.
    protected limitExecTimeMs: number = 0;
    protected execStartTime: number = 0;
    //Бюджет создаваемых данных в байтах (0 = выключен): сколько байт строк/ячеек
    //массивов скрипт успел СОЗДАТЬ за прогон (накопительно, как счётчик инструкций).
    //Ловит раздувание памяти (удвоение строки в цикле), которое укладывается в
    //бюджет инструкций. Учёт — в конструкторах StackVariableString/StackVariableArray.
    protected limitAllocBytes: number = 0;
    protected allocatedBytes: number = 0;

    setLimitExecInstruction(limit: number) {
        this.limitExecInstruction = limit;
        return this;
    }

    getLimitExecInstruction(): number {
        return this.limitExecInstruction;
    }

    setLimitExecTimeMs(limit: number) {
        this.limitExecTimeMs = limit;
        return this;
    }

    getLimitExecTimeMs(): number {
        return this.limitExecTimeMs;
    }

    setLimitAllocBytes(limit: number) {
        this.limitAllocBytes = limit;
        return this;
    }

    getLimitAllocBytes(): number {
        return this.limitAllocBytes;
    }

    getAllocatedBytes(): number {
        return this.allocatedBytes;
    }

    /**
     * Учёт создаваемых данных (вызывается из конструкторов строк/массивов).
     * Счётчик накопительный — считает, сколько байт скрипт успел создать за прогон,
     * а не сколько живёт сейчас (как и бюджет инструкций — это бюджет работы).
     */
    trackAllocation(bytes: number): void {
        if (bytes <= 0) {
            return;
        }

        this.allocatedBytes += bytes;

        if (this.limitAllocBytes && this.allocatedBytes > this.limitAllocBytes) {
            throw new ResourceLimitException('Allocation limit [' + this.limitAllocBytes + '] exceeded', this.currentToken?.cursorPos);
        }
    }

    constructor(codeItems: ParseNode[], interpreter: Interpreter) {
        this._variables = {};
        this._functions = {};
        this._stackVars = [];
        this._pos = 0;
        this._executionStack = [];
        this._type = ContextType.ctNormal;
        this._contextVariable = undefined;

        this._codeItems = codeItems;
        this._interpreter = interpreter;
    }

    destroy() {
        this.reset();

        this._variables = (undefined as unknown as typeof this._variables);
        this._functions = (undefined as unknown as typeof this._functions);
        this._codeItems = (undefined as unknown as typeof this._codeItems);
        this._stackVars = (undefined as unknown as typeof this._stackVars);
        this._executionStack = (undefined as unknown as typeof this._executionStack);
        this._interpreter = (undefined as unknown as typeof this._interpreter);
        this._contextVariable = (undefined as unknown as typeof this._contextVariable);
    }

    registerConst() {
        this.setVariable('undefined', new StackVariableUndefined(true));
        this.setVariable('null', new StackVariableNull(true));
        this.setVariable('true', new StackVariableBoolean(true, true));
        this.setVariable('false', new StackVariableBoolean(true, false));
        this.setVariable('NaN', new StackVariableNumber(true, NaN));
        this.setVariable('Infinity', new StackVariableNumber(true, Infinity));
        this.setVariable('Math', new MathFunctions());
        this.setVariable('String', new StringStaticFunctions());
        this.setVariable('Array', new ArrayConstructor());
        //Контекст нужен DateTime для таймзоны из конфига (TS setVariable, в отличие
        //от PHP, контекст не проставляет — выставляем явно у нуждающихся глобалов).
        const dateTime = new StackVariableDateTime(undefined);
        dateTime.setContext(this);
        this.setVariable('DateTime', dateTime);
        this.setVariable('debug', new StackVariableFunction(new FunctionEntry('debug', undefined, (...args: unknown[]) => {
            //Это намеренно: встроенная функция debug() из скриптов выводит в консоль.
            // eslint-disable-next-line no-console
            console.log(...args);
        })))
        this.setVariable('Env', new StackVariableEnv(this));
        this.registerErrorClass();
    }

    // ── Конфиг/Env скрипта (хост-настройки; скрипт читает их через глобал Env) ──

    private _config: Record<string, unknown> = {};

    private static _defaultConfig: Record<string, unknown> = { timezone: 0 };

    static setDefaultConfigValue(key: string, value: unknown): void {
        ContextInterpreter._defaultConfig[key] = value;
    }

    setConfigValue(key: string, value: unknown): void {
        this._config[key] = value;
    }

    setConfig(config: Record<string, unknown>): void {
        for (const key in config) {
            this._config[key] = config[key];
        }
    }

    getConfigValue(key: string, def: unknown = null): unknown {
        if (key in this._config) {
            return this._config[key];
        }
        if (key in ContextInterpreter._defaultConfig) {
            return ContextInterpreter._defaultConfig[key];
        }

        return def;
    }

    getAllConfig(): Record<string, unknown> {
        return { ...ContextInterpreter._defaultConfig, ...this._config };
    }

    /**
     * Смещение таймзоны в минутах от UTC (из конфига 'timezone'). Принимает целое
     * число минут или строку: ±HH:MM, ±HHMM, ±HH, минуты-строкой ("180"), "UTC"/"Z".
     * Именованные зоны и прочий мусор — ошибка (чтобы JS и PHP не расходились).
     */
    getTimezoneOffsetMinutes(): number {
        return ContextInterpreter.parseTimezone(this.getConfigValue('timezone', 0));
    }

    static parseTimezone(value: unknown): number {
        if (typeof value === 'number' && Number.isInteger(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const s = value.trim();
            if (s === '' || s.toUpperCase() === 'UTC' || s.toUpperCase() === 'Z') {
                return 0;
            }
            let m: RegExpExecArray | null;
            if ((m = /^([+-])(\d{1,2}):?(\d{2})$/.exec(s))) {
                return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
            }
            if ((m = /^([+-])(\d{1,2})$/.exec(s))) {
                return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60);
            }
            if (/^[+-]?\d+$/.test(s)) {
                return parseInt(s, 10);
            }
        }

        const label = (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') ? String(value) : typeof value;
        throw new ContextException('Invalid timezone: "' + label + '"');
    }

    /**
     * Регистрирует встроенный класс `Error` через стандартный путь объявления
     * пользовательского класса — парсим мини-скрипт и hoist'им как обычный
     * `class Error { constructor(message) { this.message = message; this.name = "Error"; } }`.
     *
     * Делается так, чтобы `new Error("oops")`, `e instanceof Error` и
     * `class MyError extends Error { ... }` работали через единый механизм
     * пользовательских классов. До этого был отдельный `ErrorConstructor`-builtin.
     */
    protected registerErrorClass(): void {
        const src = 'class Error { constructor(message) { this.message = message; this.name = "Error"; } }';

        const lexer = new CodeLexer(src);
        const parser = new CodeParser(lexer);
        const nodes: ParseNode[] = [];
        parser.parseCode(nodes, true, true, LexerTypeArray.one(LexerType.ltEof));

        this._interpreter.hoistFunctions(this, nodes);
    }

    pushExecutionStack() {
        this._executionStack.push({
            variables: this._variables,
            functions: this._functions,
            codeItems: this._codeItems,
            codeData: this._codeData,
            type: this._type,
            pos: this._pos,
            stackVars: this._stackVars,
            contextVariable: this._contextVariable,
            currentThis: this._currentThis,
            currentMethodOwner: this._currentMethodOwner,
            isCtorTDZ: this._isCtorTDZ,
            letNames: this._letNames,
        });

        //this и methodOwner наследуются в блок/цикл/sub-выражение — это нужно,
        //чтобы внутри тела метода `if (cond) { super.foo(); }` ссылка на
        //родителя класса-владельца была видна так же, как this.
        //letNames сбрасывается: новый блок начинает свой block scope для let/const.
        this._letNames = {};

        this._variables = Object.assign({}, this._variables);
        this._functions = Object.assign({}, this._functions);
        this._stackVars = [];

        this._codeItems = undefined;
        this._codeData = {};
        this._pos = 0;
        this._type = ContextType.ctNormal;
    }

    popExecutionStack(saveVariables?: boolean) {
        if (!this._executionStack.length)
            throw new ContextException('Execution stack is empty');

        const data = this._executionStack.pop();

        if (!data)
        {
            throw new MSLangException('Failed to pop execution stack');
        }

        //Имена, которые этот блок объявил как let/const. Их значения в parent
        //копировать НЕЛЬЗЯ: block scope требует, чтобы переменная не утекала
        //наружу, а если в parent уже было поле с таким же именем, оно должно
        //сохранить своё значение (let лишь временно перекрыл его).
        const blockLetNames = this._letNames;

        if (saveVariables !== true) {
            const tmp = this._variables;

            this._variables = data.variables;

            Object.keys(this._variables).forEach(k => {
                if (this._variables[k].isConst)
                    return;

                //let/const блока: значение из tmp в parent не копируем.
                //Внешняя переменная с тем же именем (если была) сохраняется.
                if (blockLetNames[k] === true)
                    return;

                //Если внутри scope переменную не трогали (например, она была обновлена
                //прямо в snapshot через closure-walk в setVariable) — пропускаем
                //копирование, иначе попадём в установку value на undefined.
                if (tmp[k] === undefined)
                    return;

                if (this._variables[k].type !== tmp[k].type) {
                    //createVariable не умеет vtObject (объекты, классы-экземпляры)
                    //и vtFunction — для них нет понятного «скопировать значение»,
                    //они всегда разделяются по ссылке. Если в блоке переменная
                    //стала такого типа — пробрасываем сам объект из блока в parent,
                    //минуя createVariable.
                    const newType = tmp[k].type;
                    if (newType === VariableType.vtObject || newType === VariableType.vtFunction) {
                        this._variables[k] = tmp[k];
                    } else {
                        this._variables[k] = this.createVariable(newType, tmp[k].value);
                    }
                } else {
                    //Один и тот же тип, но обновлённый в блоке через присваивание.
                    //У null/undefined/void нет осмысленного «нового значения»:
                    //setter read-only. Пропускаем — иначе «value is read only».
                    const t = this._variables[k].type;
                    if (t === VariableType.vtNull || t === VariableType.vtUndefined || t === VariableType.vtVoid)
                        return;
                    if (t === VariableType.vtObject || t === VariableType.vtFunction) {
                        //Если в блоке переменная стала ссылаться на другой объект,
                        //переносим эту новую ссылку в parent. Если тот же объект
                        //(мутировался через свой метод) — parent уже видит изменения
                        //через общую ссылку, ничего делать не нужно.
                        if (this._variables[k] !== tmp[k]) {
                            this._variables[k] = tmp[k];
                        }
                        return;
                    }
                    this._variables[k].value = tmp[k].value;
                }
            });
        }

        this._functions = data.functions;
        this._codeItems = data.codeItems;
        this._codeData = data.codeData;
        this._pos = data.pos;
        this._type = data.type;
        this._stackVars = data.stackVars;
        this._contextVariable = data.contextVariable;
        this._currentThis = data.currentThis ?? null;
        this._currentMethodOwner = data.currentMethodOwner ?? null;
        this._isCtorTDZ = data.isCtorTDZ ?? false;
        this._letNames = data.letNames ?? {};
    }

    /**
     * Открывает изолированную область видимости для вызова пользовательской функции.
     *
     * Принимает captured snapshot — переменные области, где функция была объявлена.
     * Через него внутри функции доступны замкнутые переменные.
     */
    pushFunctionScope(capturedScope: Record<string, StackVariable> | null = null) {
        this._executionStack.push({
            variables: this._variables,
            functions: this._functions,
            codeItems: this._codeItems,
            codeData: this._codeData,
            type: this._type,
            pos: this._pos,
            stackVars: this._stackVars,
            contextVariable: this._contextVariable,
            isFunctionScope: true,
            capturedScope: this._currentCapturedScope,
            currentThis: this._currentThis,
            currentMethodOwner: this._currentMethodOwner,
            isCtorTDZ: this._isCtorTDZ,
            letNames: this._letNames,
        });

        //Внутри функции — пустое имя-пространство для локальных переменных и параметров.
        this._variables = {};
        this._stackVars = [];
        this._codeItems = undefined;
        this._codeData = {};
        this._pos = 0;
        this._type = ContextType.ctFunctionCall;
        this._currentCapturedScope = capturedScope;
        //По умолчанию свежий функциональный scope не имеет this — обычная функция,
        //вызванная не через new и не как obj.method, не должна видеть наружный this.
        this._currentThis = null;
        this._currentMethodOwner = null;
        this._isCtorTDZ = false;
        //Каждый функциональный scope начинает свой block scope для let/const.
        this._letNames = {};
    }

    /**
     * Закрывает scope функции — восстанавливает внешнее состояние полностью,
     * без копирования внутренних переменных наружу.
     */
    popFunctionScope() {
        if (!this._executionStack.length)
            throw new ContextException('Execution stack is empty');

        const data = this._executionStack.pop();
        if (!data)
            throw new MSLangException('Failed to pop execution stack');

        this._variables = data.variables;
        this._functions = data.functions;
        this._codeItems = data.codeItems;
        this._codeData = data.codeData;
        this._pos = data.pos;
        this._type = data.type;
        this._stackVars = data.stackVars;
        this._contextVariable = data.contextVariable;
        this._currentCapturedScope = data.capturedScope ?? null;
        this._currentThis = data.currentThis ?? null;
        this._currentMethodOwner = data.currentMethodOwner ?? null;
        this._isCtorTDZ = data.isCtorTDZ ?? false;
        this._letNames = data.letNames ?? {};
    }

    addWarning(message: string): void {
        this._warnings.push(message);
    }

    getWarnings(): string[] {
        return this._warnings;
    }

    clearWarnings(): void {
        this._warnings = [];
    }

    /**
     * Возвращает переменную из «верхней» (корневой) области.
     * Для взаимной рекурсии: top-level функции видны из любого вложенного scope.
     */
    getGlobalVariable(name: string): StackVariable | undefined {
        if (this._executionStack.length === 0) {
            return this._variables[name];
        }
        const rootVars = this._executionStack[0].variables;
        return rootVars[name];
    }

    pushStackVar(data: unknown) {
        if (!(data instanceof StackVariable))
            throw Error('non StackVariable');

        this._stackVars.push(data);
    }

    popStackVar() {
        const r = this._stackVars.pop();

        if (r === undefined)
            throw new ContextException('Stack is empty');

        return r;
    }

    cloneVariable(variable: StackVariable): StackVariable {
        // Объекты (DateTime, Math, хост-объекты) не клонируем — отдаём ту же ссылку,
        // иначе createVariable не знает, как пересоздать конкретный подкласс,
        // и теряется состояние/поведение объекта. Это зеркало PHP-реализации.
        if (variable.type === VariableType.vtObject) {
            return variable;
        }
        // Пользовательская функция — по ссылке, как объекты. Иначе createVariable
        // завернёт её в StackVariableFunction без тела и параметров.
        if (variable instanceof StackVariableUserFunction) {
            return variable;
        }
        return this.createVariable(variable.type, variable.value);
    }

    getNextInterToken() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        if (this._pos >= this._codeItems.length)
            throw new ContextException('End of execution code');

        return this._codeItems[this._pos++];
    }

    get whoNextTypeInterToken() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        if (this._pos >= this._codeItems.length)
            return NodeType.ntNotSet;

        return this._codeItems[this._pos].nType;
    }

    get currentToken() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        if (this._pos >= this._codeItems.length)
            return null;

        return this._codeItems[this._pos];
    }

    get eof() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        return this._pos >= this._codeItems.length;
    }

    execOne() {
        // Защита от бесконечного выполнения, если установлен лимит.
        // Зеркало PHP execOne (см. ContextInterpreter::execOne).
        if (this.limitExecInstruction && this.instructionCounter >= this.limitExecInstruction) {
            throw new ResourceLimitException('Execution limit [' + this.limitExecInstruction + '] exceeded', this.currentToken?.cursorPos);
        }

        if (this.limitExecTimeMs && this.execStartTime
            && Date.now() - this.execStartTime >= this.limitExecTimeMs) {
            throw new ResourceLimitException('Execution time limit [' + this.limitExecTimeMs + ' ms] exceeded', this.currentToken?.cursorPos);
        }

        this.instructionCounter++;

        const token = this.getNextInterToken(),
            handler = this._interpreter.getCodeHandler(token.nType);

        if (!handler)
            throw new ContextException('no registered handler for token ' + token.typeName + '(' + token.nType + ')');

        //handler.call(this._interpreter, this, token);
        handler(this, token);
    }

    execStepOver() {
        const executionPos = this._executionStack.length;

        do {
            this.execOne();
        } while (executionPos !== this._executionStack.length)
    }

    execGetVariable() {
        while (true) {
            this.execStepOver();

            const nextToken = this.currentToken;
            if (!nextToken)
                break;

            if ([NodeType.ntExpressionCompare, NodeType.ntCompareOr, NodeType.ntCompareAnd].indexOf(nextToken.nType) >= 0)
                break;

            if (nextToken.isMathNode())
                break;

            if (nextToken instanceof InterpreterNode)
                break;
        }
    }

    exec(returnVal?: boolean) {
        const stackPosition = this._stackVars.length;

        //Отметка старта для лимита времени (ставится один раз — вложенные exec
        //функций не перезаписывают её, время считается от начала всего прогона).
        if (this.execStartTime === 0) {
            this.execStartTime = Date.now();
        }

        //Hoisting функций верхнего уровня: они должны быть видны до своих
        //строк-объявлений (как в JavaScript).
        if (Array.isArray(this._codeItems)) {
            this._interpreter.hoistFunctions(this, this._codeItems);
        }

        while (!this.eof) {
            try {
                this.execOne();
            } catch (e) {
                //Ресурсный лимит (инструкции/время/данные) скриптовый try/catch ловить
                //НЕ должен: иначе скрипт перехватил бы остановку и продолжил работу.
                if (e instanceof ResourceLimitException) {
                    throw e;
                }

                //Системная ошибка интерпретатора. Если в стеке есть try — оборачиваем
                //её в Error-объект и продолжаем с catch-блока. Иначе пробрасываем дальше.
                if (!this._interpreter.hasCatchInStack(this)) {
                    throw e;
                }

                const errorObj = this._interpreter.wrapAsError(this, e);
                this._interpreter.unwindThrow(this, errorObj, this.currentToken ?? null);
            }
            if (this._type === ContextType.ctReturn)
                break;
        }

        if (returnVal === true) {
            if (this._stackVars.length > stackPosition) {
                return this.popStackVar();
            }

            return this.createVariable(VariableType.vtVoid, undefined);
        } else {
            if (stackPosition !== this._stackVars.length)
                throw new ContextException('Execution stack corrupted');
        }
    }

    getVariable(name: string): StackVariable|undefined {
        if (this._variables[name] !== undefined) {
            return this._variables[name];
        }

        //Lookup по execution stack снизу вверх (только для чтения):
        //позволяет внутри функции видеть глобальные константы (true/false/null/Math/...)
        //и top-level пользовательские функции.
        for (let i = this._executionStack.length - 1; i >= 0; i--) {
            const vars = this._executionStack[i].variables;
            if (vars && vars[name] !== undefined) {
                return vars[name];
            }
        }

        //Замыкание: переменные, «застывшие» в области, где функция была определена.
        if (this._currentCapturedScope !== null && this._currentCapturedScope[name] !== undefined) {
            return this._currentCapturedScope[name];
        }

        return undefined;
    }

    getVariableRef(name: string) {
        if (!this.getVariable(name))
            return undefined;

        const refValue = (new StackVariableRef({
            get:() => {
                return this.getVariable(name) as object;
            },
            set: (value: unknown) => {

                if (!(value instanceof StackVariable))
                {
                    throw new MSLangException('set variable by ref value must be instance of StackVariable');
                }

                this.setVariable(name, value);
            }
        }));

        return refValue.getProxy();
    }

    setVariable(name:string, value: StackVariable) {
        //Замыкание-by-reference включается только внутри пользовательской функции
        //(текущий scope или любой scope вверх — типа ctFunctionCall). Старые блочные
        //конструкции (if/while/for/switch) сохраняют семантику «локально в блоке».
        let isInsideFunction = this._type === ContextType.ctFunctionCall;
        if (!isInsideFunction) {
            for (const frame of this._executionStack) {
                if (frame.type === ContextType.ctFunctionCall) {
                    isInsideFunction = true;
                    break;
                }
            }
        }

        if (isInsideFunction && this._variables[name] === undefined) {
            //Идём по execution stack: если переменная есть наверху — обновляем там.
            for (let i = this._executionStack.length - 1; i >= 0; i--) {
                const vars = this._executionStack[i].variables;
                if (vars && vars[name] !== undefined) {
                    if (vars[name].isConst)
                        throw new ContextException('Cannot override constant ' + name);
                    vars[name] = value;
                    return;
                }
            }

            //Захваченная область замыкания.
            if (this._currentCapturedScope !== null && this._currentCapturedScope[name] !== undefined) {
                const existing = this._currentCapturedScope[name];
                if (existing.isConst)
                    throw new ContextException('Cannot override constant ' + name);
                if (existing.type === value.type) {
                    existing.value = value.value;
                } else {
                    this._currentCapturedScope[name] = value;
                }
                return;
            }

            //Нигде нет — правило №1: создаём в корневой (глобальной) области.
            if (this._executionStack.length > 0) {
                this._executionStack[0].variables[name] = value;
                return;
            }
        }

        if (!!this._variables[name] && this._variables[name].isConst)
            throw new ContextException('Cannot override constant ' + name);

        this._variables[name] = value;
    }

    static createVariable(type: VariableType, value: unknown, context: ContextInterpreter | null = null): StackVariable {
        switch (type) {
            case VariableType.vtInteger:
            case VariableType.vtFloat:
            case VariableType.vtNumber:
                return new StackVariableNumber(false, value);
            case VariableType.vtString:
                //Контекст прокидывается в строки/массивы (зеркало PHP createStackVariableString):
                //конструктор учитывает размер в бюджете создаваемых данных.
                return new StackVariableString(false, value as string, context);
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, !!value);
            case VariableType.vtArray:
                return new StackVariableArray(false, value, context);
            case VariableType.vtNull:
                return new StackVariableNull(false);
            case VariableType.vtUndefined:
                return new StackVariableUndefined(false);
            case VariableType.vtVoid:
                return new StackVariableVoid(false);
            case VariableType.vtFunction:
                return new StackVariableFunction(value, null);
            default:
                throw new ContextException('Unknown variable type ' + type);
        }
    }

    createVariable(type: VariableType, value: unknown) {
        return ContextInterpreter.createVariable(type, value, this);
    }

    reset() {
        while (this._executionStack.length)
            this.popExecutionStack();

        this._variables = {};
        this._functions = {};
        this._stackVars = [];
        this._pos = 0;
        this._type = ContextType.ctNormal;
        this._executionStack = [];
        //Зеркало PHP reset(): счётчики ресурсов обнуляются вместе с состоянием.
        this.instructionCounter = 0;
        this.allocatedBytes = 0;
        this.execStartTime = 0;
    }

    callFunction(name: string, parameters: StackVariable[]) {
        const variable = this.getVariable(name);

        if (!variable) {
            throw new MSLangException('global function "' + name + '" not defined');
        }

        if (variable.type !== VariableType.vtFunction) {
            throw new MSLangException('variable "' + name + '" is not function');
        }


        const funcEntry = variable.value;

        if (!(funcEntry instanceof FunctionEntry)) {
            throw new MSLangException('variable type is function, value must be instance of "' + FunctionEntry.name + '"');
        }

        if (funcEntry.getRequiredCount() > parameters.length) {
            throw new ContextException('Invalid number of arguments for function "' + name + '"');
        }

        const callFuncArgs: (StackVariable|null)[] = [null];

        const funcParameters = funcEntry.getParameters();
        // ЯЗЫКОВОЕ ОТЛИЧИЕ от PHP (P2-12): PHP идёт строго по объявленным
        // параметрам (вариативные builtin'ы там объявлены как variadic). В TS
        // встроенные вариативные функции (String.fromCharCode, Array.fill и т.п.)
        // недо-объявляют параметры и опираются на позиционную передачу всех
        // фактических аргументов через Math.max. Для пользовательских функций
        // разницы нет (в MSLang нет объекта arguments). Поэтому оставляем Math.max.
        const paramCount = Math.max(parameters.length, funcParameters.length);

        for (let index = 0; index < paramCount; index++) {

            if (index < parameters.length) {
                callFuncArgs.push(parameters[index]);
            } else {
                callFuncArgs.push(funcParameters[index].createVariableDefaultValue(this));
            }
        }

        let returnVal = funcEntry.invokeArguments(callFuncArgs);

        if (!(returnVal instanceof StackVariable)) {
            returnVal = new StackVariableUndefined(false);
        }

        return returnVal;
    }

    selfCallFunction(self: StackVariable, name: string, parameters: StackVariable[]) {
        /** @var self StackVariable  */

        const funcEntry = self.getFunctionEntry(name);

        if (!funcEntry) {
            throw new ContextException('Unknown function "' + name + '"');
        }

        if (funcEntry.getRequiredCount() > parameters.length) {
            throw new ContextException('Invalid number of arguments for function "' + name + '"');
        }

        const callFuncArgs = [self];

        const funcParameters = funcEntry.getParameters();
        // См. комментарий в callFunction: Math.max нужен для вариативных builtin'ов TS.
        const paramCount = Math.max(parameters.length, funcParameters.length);

        for (let index = 0; index < paramCount; index++) {
            if (index < parameters.length) {
                callFuncArgs.push(parameters[index]);
            } else {
                callFuncArgs.push(funcParameters[index].createVariableDefaultValue(this));
            }
        }

        return funcEntry.invokeArguments(callFuncArgs);
    }
}

// Регистрируем фабрику значений в базовом StackVariable (он импортирует тип-только,
// чтобы не было цикла модулей). Делается один раз при загрузке этого модуля — до
// любого исполнения скрипта, поэтому createVariableFn в базе уже выставлен.
_registerCreateVariable((type, value) => ContextInterpreter.createVariable(type, value));
