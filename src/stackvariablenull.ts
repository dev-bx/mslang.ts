import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import type {ContextInterpreter} from "./contextinterpreter.js";

export class StackVariableNull extends StackVariable {
    constructor(isConst: boolean = false, context: ContextInterpreter | null = null) {
        super(VariableType.vtNull, isConst, context);

        this._value = null;
    }

    castAs(variableType: VariableType): StackVariable|null
    {
        switch (variableType)
        {
            case VariableType.vtString:
                return new StackVariableString(false, 'null');
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, false);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, 0);
        }

        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableNumber(false, 0);
    }

}
