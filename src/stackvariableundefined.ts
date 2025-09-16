import {VariableType} from "./variabletype.js";
import {StackVariable} from "./stackvariable.js";

export class StackVariableUndefined extends StackVariable {
    constructor(isConst: boolean = false) {
        super(VariableType.vtUndefined, isConst);

        this._value = undefined;
    }

}
