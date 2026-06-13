import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {ParseNode} from "./parser.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableClass} from "./stackvariableclass.js";
import {InterpreterException} from "./exceptions.js";

/**
 * Пользовательская функция, объявленная внутри скрипта через
 * `function name(args) { body }`.
 *
 * В отличие от {@link StackVariableFunction}, эта обёртка не вызывает
 * хост-callback — она несёт само тело и параметры; интерпретатор сам
 * толкает их в стек выполнения.
 *
 * Зеркало PHP-эталона `StackVariableUserFunction` из mslang.php.
 */
export class StackVariableUserFunction extends StackVariable {
    private readonly _name: string;
    private readonly _params: ParseNode[];
    private readonly _body: ParseNode[];

    /**
     * Снимок переменных области, где функция была объявлена. Через него
     * вложенная функция видит переменные внешней даже после её завершения
     * (snapshot захватывается копией на момент создания функции).
     */
    private _capturedScope: Record<string, StackVariable> = {};

    /**
     * Обёртка-класс для function-конструктора (этап 4). Создаётся лениво,
     * когда функцию вызывают через `new`. Нужен, чтобы:
     *   - instance, созданный через `new Foo()`, был привязан к классу
     *     (для `instanceof Foo` и общей унификации с class-based path);
     *   - повторный `new Foo()` использовал тот же класс-обёртку (instanceof
     *     сравнивает по ссылке).
     */
    private _wrapperClass: StackVariableClass | null = null;

    constructor(name: string, params: ParseNode[], body: ParseNode[]) {
        //isConst=true важно для popExecutionStack: при автокопировании переменных
        //обратно const-функции пропускаются (иначе setValue упал бы).
        super(VariableType.vtFunction, true);
        this._name = name;
        this._params = params;
        this._body = body;
    }

    get value() {
        return this;
    }
    set value(_v) {
        throw new InterpreterException('Cannot override user function', this.getContext()?.currentToken?.cursorPos);
    }

    get name(): string {
        return this._name;
    }

    get params(): ParseNode[] {
        return this._params;
    }

    get body(): ParseNode[] {
        return this._body;
    }

    /**
     * Запоминает снимок переменных области определения — для замыкания.
     * Вызывается при создании функции (см. Interpreter.buildUserFunction).
     */
    setCapturedScope(scope: Record<string, StackVariable>): void {
        this._capturedScope = scope;
    }

    get capturedScope(): Record<string, StackVariable> {
        return this._capturedScope;
    }

    /**
     * Возвращает (создавая при необходимости) класс-обёртку для использования
     * этой функции как конструктора через `new`. Имя класса совпадает с именем
     * функции; конструктор класса — сама функция; родителя нет.
     *
     * Кешируется на самой UserFunction, чтобы все экземпляры,
     * созданные через `new Foo()`, и проверки `... instanceof Foo`
     * ссылались на один и тот же класс.
     */
    getOrCreateWrapperClass(): StackVariableClass {
        if (this._wrapperClass === null) {
            const cls = new StackVariableClass(this._name);
            cls.setConstructor(this);
            this._wrapperClass = cls;
        }
        return this._wrapperClass;
    }

    castAs<T extends VariableType>(variableType: T): StackVariable | null {
        switch (variableType) {
            case VariableType.vtString:
                return new StackVariableString(false, 'function ' + this._name) as StackVariable;
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, true) as StackVariable;
        }
        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableString(false, 'function ' + this._name + '() {}');
    }
}
