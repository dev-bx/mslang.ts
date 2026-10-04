import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {InterpreterException} from "./exceptions";
import type {ContextInterpreter} from "./contextinterpreter.js";

export class StackVariableBoolean extends StackVariable {
    constructor(isConst: boolean = false, value?: boolean, context: ContextInterpreter | null = null) {
        super(VariableType.vtBoolean, isConst, context);

        this.value = value;
    }

    get value() {
        return this._value;
    }
    set value(value) {
        if (typeof value !== 'boolean')
            throw new InterpreterException('variable type ' + typeof value + ' expected boolean', this.getContext()?.currentToken?.cursorPos);

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
