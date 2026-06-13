import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableUserFunction} from "./stackvariableuserfunction.js";
import {InterpreterException} from "./exceptions.js";
import type {ContextInterpreter} from "./interpreter.js";

/**
 * Пользовательский класс, объявленный внутри скрипта через
 *   `class Name { constructor(...) { ... } method1(...) { ... } ... }`.
 *
 * Хранит имя, ссылку на конструктор и словарь методов (все — `StackVariableUserFunction`).
 *
 * Сам объект «класс» — это значение типа `vtFunction`, чтобы его можно было
 * положить в `_variables` как обычную переменную и потом найти по имени.
 * Создание экземпляра идёт через узел `ntNew` — он сам разбирается, что в
 * имени лежит {@link StackVariableClass}, и собирает {@link StackVariableObject}
 * с привязкой к этому классу.
 *
 * Этап 1 — без наследования (extends/super идут отдельной задачей).
 *
 * Зеркало PHP-эталона `StackVariableClass` из mslang.php.
 */
export class StackVariableClass extends StackVariable {
    private readonly _name: string;
    /**
     * Конструктор класса — необязательный. Если null, `new Name()` создаст
     * пустой объект и просто проигнорирует переданные аргументы.
     */
    private _constructor: StackVariableUserFunction | null = null;
    /**
     * Методы класса, доступ по имени. Имя совпадает с тем, как метод
     * объявлен в `class { ... }` (регистрозависимо).
     */
    private readonly _methods: Record<string, StackVariableUserFunction> = {};

    /**
     * Имя родительского класса (этап 2 — extends) или null. Реальная ссылка
     * резолвится лениво через {@link getParent}, чтобы не зависеть от
     * порядка объявления классов в скрипте.
     */
    private _parentName: string | null = null;

    /**
     * Максимальная глубина цепочки наследования для защиты от циклов и
     * слишком глубоких иерархий. При превышении бросаем ошибку.
     */
    static readonly PARENT_CHAIN_LIMIT = 100;

    constructor(name: string) {
        //isConst=true: класс — это «реестр», его не переписывают присваиванием.
        //popExecutionStack обходит const-переменные, что и нужно.
        super(VariableType.vtFunction, true);
        this._name = name;
    }

    get value() {
        return this;
    }
    set value(_v) {
        throw new InterpreterException('Cannot override class "' + this._name + '"', this.getContext()?.currentToken?.cursorPos);
    }

    get name(): string {
        return this._name;
    }

    setConstructor(ctor: StackVariableUserFunction): void {
        this._constructor = ctor;
    }

    getConstructor(): StackVariableUserFunction | null {
        return this._constructor;
    }

    registerMethod(name: string, method: StackVariableUserFunction): void {
        this._methods[name] = method;
    }

    /**
     * Имя родительского класса для `extends Parent`. null — корневой класс.
     */
    setParentName(parentName: string | null): void {
        this._parentName = parentName;
    }

    getParentName(): string | null {
        return this._parentName;
    }

    /**
     * Lazy-резолв родителя через текущий контекст. Возвращает null, если
     * extends не задан. Бросает ошибку, если имя родителя есть, а такого
     * класса в области нет.
     */
    getParent(context: ContextInterpreter): StackVariableClass | null {
        if (this._parentName === null) {
            return null;
        }
        const parent = context.getVariable(this._parentName);
        if (!parent) {
            throw new InterpreterException(
                'Unknown parent class "' + this._parentName + '" of "' + this._name + '"',
                context.currentToken?.cursorPos,
            );
        }
        if (!(parent instanceof StackVariableClass)) {
            throw new InterpreterException(
                '"' + this._parentName + '" is not a class (parent of "' + this._name + '")',
                context.currentToken?.cursorPos,
            );
        }
        return parent;
    }

    /**
     * Поиск собственного метода по имени без обхода цепочки родителей.
     * Используется реализацией getMethod() и super.method().
     */
    getOwnMethod(name: string): StackVariableUserFunction | null {
        return Object.prototype.hasOwnProperty.call(this._methods, name)
            ? this._methods[name]
            : null;
    }

    /**
     * Возвращает метод по имени, ищет вверх по цепочке родителей.
     * При слишком глубокой иерархии (например, циклической) бросает ошибку.
     */
    getMethod(name: string, context?: ContextInterpreter): StackVariableUserFunction | null {
        let cls: StackVariableClass | null = this;
        let depth = 0;
        while (cls !== null) {
            if (Object.prototype.hasOwnProperty.call(cls._methods, name)) {
                return cls._methods[name];
            }
            if (!context) {
                //Без контекста идём только по собственным методам (как раньше).
                return null;
            }
            cls = cls.getParent(context);
            depth++;
            if (depth > StackVariableClass.PARENT_CHAIN_LIMIT) {
                throw new InterpreterException(
                    'Class inheritance chain is too deep or has a cycle, starting from "' + this._name + '"',
                    context.currentToken?.cursorPos,
                );
            }
        }
        return null;
    }

    /**
     * Поиск ближайшего конструктора в цепочке наследования. Используется
     * автоматической логикой `new` для extends-классов без своего ctor.
     * Возвращает пару [class, ctor] или null, если ни одного нет.
     */
    findCtorInChain(context: ContextInterpreter): [StackVariableClass, StackVariableUserFunction] | null {
        let cls: StackVariableClass | null = this;
        let depth = 0;
        while (cls !== null) {
            if (cls._constructor !== null) {
                return [cls, cls._constructor];
            }
            cls = cls.getParent(context);
            depth++;
            if (depth > StackVariableClass.PARENT_CHAIN_LIMIT) {
                throw new InterpreterException(
                    'Class inheritance chain is too deep or has a cycle, starting from "' + this._name + '"',
                    context.currentToken?.cursorPos,
                );
            }
        }
        return null;
    }

    get methods(): Record<string, StackVariableUserFunction> {
        return this._methods;
    }

    castAs<T extends VariableType>(variableType: T): StackVariable | null {
        switch (variableType) {
            case VariableType.vtString:
                return new StackVariableString(false, 'class ' + this._name) as StackVariable;
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, true) as StackVariable;
        }
        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableString(false, 'class ' + this._name + ' {}');
    }
}
