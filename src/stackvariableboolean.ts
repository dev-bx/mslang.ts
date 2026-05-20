import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {MSLangException} from "./exceptions";

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
            throw new MSLangException('variable type ' + typeof value + ' expected boolean');

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
                return new StackVariableNumber(false, this.value ? 1 : 0);
        }

        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableNumber(false, this.value ? 1 : 0);
    }

}
