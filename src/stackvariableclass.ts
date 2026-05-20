import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableUserFunction} from "./stackvariableuserfunction.js";
import {MSLangException} from "./exceptions.js";

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
        throw new MSLangException('Cannot override class "' + this._name + '"');
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
     * Возвращает метод по имени или null, если нет.
     * Этап 1 ищет только в собственных методах, без подъёма по родителю
     * (extends подключим этапом 2).
     */
    getMethod(name: string): StackVariableUserFunction | null {
        return Object.prototype.hasOwnProperty.call(this._methods, name)
            ? this._methods[name]
            : null;
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
