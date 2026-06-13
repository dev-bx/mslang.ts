import {VariableType} from "./variabletype.js";
import {StackVariable} from "./stackvariable.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";

/**
 * Тип «пусто» (vtVoid) — результат функции/скрипта, не вернувшего значение.
 * Зеркало PHP StackVariableVoid: ведёт себя как JS `undefined` при приведениях
 * (к числу → NaN, к булеву → false), к остальным типам — null. toPrimitive → NaN.
 */
export class StackVariableVoid extends StackVariable {
    constructor(isConst: boolean = false) {
        super(VariableType.vtVoid, isConst);

        this._value = null;
    }

    castAs(variableType: VariableType): StackVariable|null
    {
        switch (variableType)
        {
            case VariableType.vtNumber:
                return new StackVariableNumber(false, NaN);
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, false);
        }

        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableNumber(false, NaN);
    }

}
