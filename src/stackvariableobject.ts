import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";

export class StackVariableObject extends StackVariable {

    override _value: Record<string, unknown> = {};

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

    registerProperty(name: string, variable: StackVariable)
    {
        this._value[name] = variable;
    }

    getProperty(name: string) {
        return this._value[name];
    }
}
