import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableNumber} from "./stackvariablenumber.js";

export class StackVariableBoolean extends StackVariable {
    constructor(isConst: boolean = false, value?: boolean) {
        super(VariableType.vtBoolean, isConst);

        this.value = value;
    }

    get value() {
        return this._value;
    }
    set value(value) {
        if (typeof value !== 'boolean')
            throw new Error('variable type '+typeof value+' expected boolean')

        this._value = value;
    }

    castAs(variableType: VariableType): StackVariable|null
    {
        switch (variableType)
        {
            case VariableType.vtString:
                return new StackVariableString(false, this.value ? 'true' : 'false');
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, !!this.value);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, this.value ? 0 : 1);
        }

        return null;
    }

}
