import {CompareType} from "./parser.js";
import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {InterpreterException} from "./exceptions";
import {FunctionParameter} from "./functionparameter";
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
                return new StackVariableString(false, StackVariableNumber.numberToJsString(v));
            case VariableType.vtBoolean:
                //JS: 0, -0, NaN → false; иначе true (бит-в-бит с PHP-эталоном).
                return new StackVariableBoolean(false, v !== 0 && !Number.isNaN(v));
            case VariableType.vtNumber:
                return new StackVariableNumber(false, v);
        }

        return null;
    }

    /** toFixed — нативный Number.prototype.toFixed это и есть эталон V8; PHP повторяет его вручную. */
    funcInvokeToFixedReturn = () => VariableType.vtString;

    funcInvokeToFixedArgs = () => [
        new FunctionParameter('digits', VariableType.vtNumber, false, false, 0),
    ];

    funcInvokeToFixed(digits: number = 0): string {
        //ToInteger как в PHP (int-параметр диспетчер усекает) — до проверки диапазона.
        digits = Math.trunc(digits);
        if (digits < 0 || digits > 100) {
            throw new InterpreterException('toFixed() digits argument must be between 0 and 100', this.getContext()?.currentToken?.cursorPos);
        }
        return StackVariableNumber.toFixedString(this._value as number, digits);
    }

    /**
     * Округление числа к строке с digits знаками — нативный toFixed (это и есть эталон V8;
     * PHP повторяет его вручную). Единая точка для toFixed/Number.roundTo/Number.format.
     * Зовущий обязан дать 0 <= digits <= 100.
     */
    static toFixedString(value: number, digits: number): string {
        return value.toFixed(digits);
    }

    // Зеркало PHP StackVariableNumber::numberToJsString — единый форматтер числа
    // для всего движка (приведение к строке, склейка через `+`, будущий JSON.stringify,
    // сортировка по умолчанию, toFixed). В JS это и есть эталон: Number.prototype.toString
    // выполняет ровно алгоритм ECMAScript Number::toString, поэтому здесь хватает нативного
    // toString. Минус-бесконечность раньше печаталась как 'Infinity' (теряла знак) — теперь
    // '-Infinity', как требует спецификация и как теперь делает PHP-эталон.
    static numberToJsString(value: number): string
    {
        if (Number.isNaN(value))
            return 'NaN';
        if (!Number.isFinite(value))
            return value < 0 ? '-Infinity' : 'Infinity';
        return value.toString();
    }

    properties = NUMBER_PROPERTIES;

}

// O-3: один общий набор свойств на все числа (раньше литерал создавался в каждом
// конструкторе — горячий путь). Геттеры получают конкретный экземпляр через
// apply в getProperty, поэтому общий объект безопасен.
const NUMBER_PROPERTIES = Object.freeze({
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
});
