import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableUndefined} from "./stackvariableundefined";
import {MSLangException} from "./exceptions";
import type {ContextInterpreter} from "./interpreter.js";

export class StackVariableString extends StackVariable {
    constructor(isConst: boolean = false, value: string, context: ContextInterpreter | null = null) {
        super(VariableType.vtString, isConst, context);

        this.value = value;

        //Бюджет создаваемых данных (зеркало PHP): каждая строка, рождённая на
        //исполнении (склейка, repeat, join…), учитывается своим размером.
        //Литералы из кода (isConst) не считаем — это текст самой программы.
        if (!isConst && context !== null) {
            context.trackAllocation(value.length);
        }
    }

    get value(): string {
        if (typeof this._value !== 'string')
            throw new MSLangException('String value not initialized');

        return this._value;
    }
    set value(value: unknown) {
        if (typeof value !== 'string')
            throw new MSLangException('variable type ' + typeof value + ' expected string');

        this._value = value;
    }

    /** indexOf */

    funcInvoke_indexOfReturn = () => VariableType.vtNumber;

    funcInvoke_indexOfArgs() {
        return [
            new FunctionParameter('searchString', VariableType.vtString, true),
            new FunctionParameter('position', VariableType.vtNumber, false),
        ];
    }

    funcInvoke_indexOf(searchString: string, position?: number) {
        if (typeof this.value !== 'string')
            return -1;

        return this.value.indexOf(String(searchString), position ?? 0);
    }

    /** charCodeAt */
    funcInvokeCharCodeAtReturn = () => VariableType.vtNumber;

    funcInvokeCharCodeAtArgs = () => [
        new FunctionParameter('index', VariableType.vtNumber, true),
    ];

    funcInvokeCharCodeAt(index: number): number {
        if (typeof this.value !== 'string') return NaN;
        if (index < 0 || index >= this.value.length) return NaN;
        return this.value.charCodeAt(index);
    }

    /** charAt */
    funcInvokeCharAtReturn = () => VariableType.vtString;

    funcInvokeCharAtArgs = () => [
        new FunctionParameter('index', VariableType.vtNumber, true),
    ];

    funcInvokeCharAt(index: number): string {
        if (typeof this.value !== 'string') return '';
        return this.value.charAt(index);
    }

    castAs(variableType: VariableType): StackVariable|null {

        if (typeof this.value === 'string')
        {
            switch (variableType) {
                case VariableType.vtString:
                    return new StackVariableString(false, this.value);
                case VariableType.vtBoolean:
                    return new StackVariableBoolean(false, this.value.length !== 0);
                case VariableType.vtNumber:
                    return new StackVariableNumber(false, Number(this.value));
            }
        }

        return null;
    }

    override properties = {
        length: {
            get: () => {
                if (typeof this._value === 'string')
                    return new StackVariableNumber(false, this._value.length);

                return new StackVariableUndefined();
            }
        },
    }

    /** Contains */

    funcInvokeContainsReturn = () => VariableType.vtBoolean;

    funcInvokeContainsArgs = () => [
        new FunctionParameter('searchString', VariableType.vtString, true)
    ]

    funcInvokeContains(searchString: string)
    {
        if (typeof this.value === 'string')
            return this.value.indexOf(searchString) !== -1;

        return false;
    }

    /** StartsWith */

    funcInvokeStartsWithReturn = () => VariableType.vtBoolean;

    funcInvokeStartsWithArgs = () => [
        new FunctionParameter('searchString', VariableType.vtString, true)
    ]

    funcInvokeStartsWith(searchString: string)
    {
        if (typeof this.value === 'string')
            return this.value.startsWith(searchString);

        return false;
    }

    /** EndsWith */

    funcInvokeEndsWithReturn = () => VariableType.vtBoolean;

    funcInvokeEndsWithArgs = () => [
        new FunctionParameter('searchString', VariableType.vtString, true)
    ]

    funcInvokeEndsWith(searchString: string)
    {
        if (typeof this.value === 'string')
            return this.value.endsWith(searchString);

        return false;
    }

    /** ToUpper */

    funcInvokeToUpperReturn = () => VariableType.vtString;

    funcInvokeToUpper()
    {
        if (typeof this.value === 'string')
            return this.value.toUpperCase();

        return '';
    }

    /** ToLower */

    funcInvokeToLowerReturn = () => VariableType.vtString;

    funcInvokeToLower()
    {
        if (typeof this.value === 'string')
            return this.value.toLowerCase();

        return '';
    }

    /** Length */

    funcInvokeLengthReturn = () => VariableType.vtNumber;

    funcInvokeLength()
    {
        if (typeof this.value === 'string')
            return this.value.length;

        return 0;
    }

    /** Trim */

    funcInvokeTrimReturn = () => VariableType.vtString;

    funcInvokeTrim()
    {
        if (typeof this.value === 'string')
            return this.value.trim();

        return '';
    }

    /** SubString */

    funcInvokeSubStringReturn = () => VariableType.vtString;

    funcInvokeSubStringArgs = () => [
        new FunctionParameter('start', VariableType.vtNumber, true),
        new FunctionParameter('end', VariableType.vtNumber, false, false, undefined),
    ]

    funcInvokeSubString(start: number, end?: number)
    {
        if (typeof this.value !== 'string')
            return '';

        //Зеркало PHP mb_substr($value, $start, $length): второй аргумент — это
        //ДЛИНА, а не конечный индекс (как у JS substring). Отрицательный start —
        //смещение от конца; отрицательная длина — отбрасывает столько символов с
        //конца. Работаем по код-поинтам, как mb_substr.
        const chars = Array.from(this.value);
        const total = chars.length;
        const begin = start < 0 ? Math.max(total + start, 0) : Math.min(start, total);
        const len = (end === null || end === undefined) ? undefined : end;
        let stop: number;
        if (len === undefined) {
            stop = total;
        } else if (len < 0) {
            stop = Math.max(total + len, begin);
        } else {
            stop = Math.min(begin + len, total);
        }
        if (stop < begin)
            stop = begin;

        return chars.slice(begin, stop).join('');
    }

    /** Concat */

    funcInvokeConcatReturn = () => VariableType.vtString;

    funcInvokeConcat()
    {
        const values: string[] = [];

        Object.values(arguments).forEach(value => {
            const varString = value.castAs(VariableType.vtString);

            if (!varString)
                throw new MSLangException('Failed convert ' + value.typeName + ' to string');

            values.push(varString.value);
        });

        if (typeof this.value === 'string')
            return this.value.concat.apply(this.value, values);

        return ''.concat.apply('', values);
    }

}
