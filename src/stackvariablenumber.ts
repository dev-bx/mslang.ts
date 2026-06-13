import {CompareType} from "./parser.js";
import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {InterpreterException} from "./exceptions";
import {phpLooseEqual} from "./phpsemantics";

export class StackVariableNumber extends StackVariable {
    constructor(isConst: boolean, value: unknown) {
        super(VariableType.vtNumber, isConst);

        this.value = value;
    }

    get value() {
        return this._value;
    }
    set value(value) {
        if (typeof value !== 'number')
            throw new InterpreterException('variable type ' + typeof value + ' expected number', this.getContext()?.currentToken?.cursorPos);

        this._value = value;
    }

    comparePriority(variable: StackVariable, compareType: CompareType):number|false
    {
        if (variable.isNumeric)
            return 1;

        if (compareType !== CompareType.ctEqual && compareType !== CompareType.ctNotEqual)
            return false;

        return 0;
    }

    compare(variable: StackVariable, compareType: CompareType)
    {
        switch (compareType)
        {
            case CompareType.ctEqual:
                return phpLooseEqual(this.value, variable.value);
            case CompareType.ctNotEqual:
                return !phpLooseEqual(this.value, variable.value);
        }

        if (!variable.isNumeric || typeof this.value !== 'number' || typeof variable.value !== 'number')
            throw new InterpreterException('Invalid compare type', this.getContext()?.currentToken?.cursorPos);

        switch (compareType) {
            case CompareType.ctLess:
                return this.value < variable.value;
            case CompareType.ctGreat:
                return this.value > variable.value;
            case CompareType.ctEqual | CompareType.ctLess:
                return this.value <= variable.value;
            case CompareType.ctEqual | CompareType.ctGreat:
                return this.value >= variable.value;
            default:
                // Зеркало PHP: InterpreterException с позицией текущего токена, а не голый Error.
                throw new InterpreterException('Unknown compare type ' + compareType, this.getContext()?.currentToken?.cursorPos);
        }
    }

    castAs(variableType: VariableType): StackVariable|null
    {
        // Убрана TS-only ветка typeof !== 'number' → 'undefined' (в PHP её нет;
        // _value у числа всегда число). Ранний `return this` (как в PHP) НЕ делаем:
        // в PHP это значение-объект, в JS — ссылка, и общий объект ломает `++a + a`.
        const v = this._value as number;

        switch (variableType)
        {
            case VariableType.vtString:
                if (isNaN(v))
                    return new StackVariableString(false, 'NaN');

                if (!isFinite(v))
                    return new StackVariableString(false, 'Infinity');

                return new StackVariableString(false, v.toString());
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, !!v);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, v);
        }

        return null;
    }

    properties = {
        isNaN: {
            get(this: StackVariableNumber) {
                return new StackVariableBoolean(false, isNaN(this._value as number));
            }
        },

        isFinite: {
            get(this: StackVariableNumber) {
                if (typeof this._value === 'number')
                    return new StackVariableBoolean(false, isFinite(this._value));

                return new StackVariableBoolean(false, false);
            }
        },
    }

}
