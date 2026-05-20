import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import type {StackVariableClass} from "./stackvariableclass.js";

export class StackVariableObject extends StackVariable {

    override _value: Record<string, unknown> = {};

    /**
     * Класс, к которому этот объект относится (`new ClassName(...)`).
     * null — обычный объект без класса (хост-объекты типа результата
     * `new Error(...)` на старом пути; этапом 3 они уйдут на пользовательский Error).
     */
    private _class: StackVariableClass | null = null;

    constructor(isConst: boolean = false, value: unknown) {
        super(VariableType.vtObject, isConst);

        this._value = value as typeof this._value;
    }

    get value() {
        return this._value;
    }
    set value(value) {
        this._value = value;
    }

    setClass(cls: StackVariableClass | null): void {
        this._class = cls;
    }

    getClass(): StackVariableClass | null {
        return this._class;
    }

    registerProperty(name: string, variable: StackVariable)
    {
        this._value[name] = variable;
    }

    getProperty(name: string) {
        return this._value[name];
    }

    setProperty(name: string, value: StackVariable): void {
        //Для экземпляров пользовательских классов запись в this.x или obj.x
        //идёт прямо в _value (которая у объекта — словарь свойств).
        if (this._value === null || typeof this._value !== 'object') {
            this._value = {};
        }
        this._value[name] = value;
    }
}
