import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {InterpreterException} from "./exceptions";

export class StackVariableFunction extends StackVariable
{
    private _self: unknown;
    constructor(value?: unknown, self?: unknown) {
        super(VariableType.vtFunction, true);

        this._value = value;
        this._self = self;
    }

    get value() {
        return this._value;
    }
    set value(_value) {
        throw new InterpreterException('Cannot override functions', this.getContext()?.currentToken?.cursorPos);
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

    toPrimitive(): StackVariable {
        return new StackVariableString(false, 'function() {}');
    }

}
