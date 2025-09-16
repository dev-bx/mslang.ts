import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";

export class StackVariableFunction extends StackVariable
{
    private _self: unknown;
    constructor(value?:unknown, self?: unknown) {
        super(VariableType.vtFunction, true);

        this._value = value;
        this._self = self;
    }


    get value() {
        return this._value;
    }
    set value(value) {
        throw new Error('Cannot override function')
    }

    get self() {
        return this._self;
    }

    castAs(variableType: VariableType): StackVariable|null
    {
        switch (variableType)
        {
            case VariableType.vtString:
                return new StackVariableString(false, 'function');
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, true);
        }

        return null;
    }

}
