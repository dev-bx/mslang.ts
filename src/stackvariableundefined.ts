import {VariableType} from "./variabletype.js";
import {StackVariable} from "./stackvariable.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";

export class StackVariableUndefined extends StackVariable {
    constructor(isConst: boolean = false) {
        super(VariableType.vtUndefined, isConst);

        this._value = undefined;
    }

    castAs(variableType: VariableType): StackVariable|null
    {
        switch (variableType)
        {
            case VariableType.vtString:
                return new StackVariableString(false, 'undefined');
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, false);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, NaN);
            case VariableType.vtUndefined:
                return new StackVariableUndefined(false);
        }

        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableNumber(false, NaN);
    }

}
