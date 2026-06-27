import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableUndefined} from "./stackvariableundefined";
import {InterpreterException} from "./exceptions";
import type {ContextInterpreter} from "./contextinterpreter.js";

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
            throw new InterpreterException('String value not initialized', this.getContext()?.currentToken?.cursorPos);

        return this._value;
    }
    set value(value: unknown) {
        if (typeof value !== 'string')
            throw new InterpreterException('variable type ' + typeof value + ' expected string', this.getContext()?.currentToken?.cursorPos);

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

    /** split */
    funcInvokeSplitReturn = () => VariableType.vtArray;

    funcInvokeSplitArgs = () => [
        new FunctionParameter('separator', VariableType.vtString, false, false, undefined),
        new FunctionParameter('limit', VariableType.vtNumber, false, false, undefined),
    ];

    funcInvokeSplit(separator?: string, limit?: number): string[] {
        const value = this.value;

        if (separator === undefined || separator === null) {
            return [value];
        }

        //Зеркало PHP: пустой separator → по код-поинтам (Array.from), не нативный
        //split('') по UTF-16 (он режет суррогатные пары). limit отбрасывает остаток
        //(как JS), а нарезаем сами, чтобы совпасть с PHP array_slice.
        let parts = separator === ''
            ? (value === '' ? [] : Array.from(value))
            : value.split(separator);

        if (limit !== undefined && limit !== null && limit >= 0 && limit < parts.length) {
            parts = parts.slice(0, limit);
        }

        return parts;
    }

    /** replace */
    funcInvokeReplaceReturn = () => VariableType.vtString;

    funcInvokeReplaceArgs = () => [
        new FunctionParameter('search', VariableType.vtString, true),
        new FunctionParameter('replacement', VariableType.vtString, true),
    ];

    funcInvokeReplace(search: string, replacement: string): string {
        const value = this.value;

        if (search === '') {
            return replacement + value;
        }

        //indexOf/slice вручную (не нативный .replace) — у нативного replace со строкой
        //замены работают спецсимволы $ ($&, $1). Нам нужна литеральная замена.
        const pos = value.indexOf(search);
        if (pos === -1) {
            return value;
        }

        return value.slice(0, pos) + replacement + value.slice(pos + search.length);
    }

    /** replaceAll */
    funcInvokeReplaceAllReturn = () => VariableType.vtString;

    funcInvokeReplaceAllArgs = () => [
        new FunctionParameter('search', VariableType.vtString, true),
        new FunctionParameter('replacement', VariableType.vtString, true),
    ];

    funcInvokeReplaceAll(search: string, replacement: string): string {
        const value = this.value;

        if (search === '') {
            const chars = value === '' ? [] : Array.from(value);
            if (chars.length === 0) {
                return replacement;
            }
            return replacement + chars.join(replacement) + replacement;
        }

        //split(search).join(replacement) — литеральная замена всех вхождений (без $-магии).
        return value.split(search).join(replacement);
    }

    /** repeat */
    funcInvokeRepeatReturn = () => VariableType.vtString;

    funcInvokeRepeatArgs = () => [
        new FunctionParameter('count', VariableType.vtNumber, true),
    ];

    funcInvokeRepeat(count: number): string {
        if (count < 0) {
            throw new InterpreterException('Invalid count value', this.getContext()?.currentToken?.cursorPos);
        }

        return this.value.repeat(count);
    }

    /** slice */
    funcInvokeSliceReturn = () => VariableType.vtString;

    funcInvokeSliceArgs = () => [
        new FunctionParameter('start', VariableType.vtNumber, true),
        new FunctionParameter('end', VariableType.vtNumber, false, false, undefined),
    ];

    funcInvokeSlice(start: number, end?: number): string {
        //ToInteger (усечение к нулю) ДО логики «от конца» — иначе на отрицательном дробном
        //индексе TS разойдётся с PHP (там int-параметр уже усечён диспетчером) и с V8.
        start = Math.trunc(start);
        if (end !== undefined && end !== null) {
            end = Math.trunc(end);
        }

        //По код-поинтам (Array.from), как PHP mb_str_split и как SubString. JS-семантика:
        //отрицательные индексы — от конца, end не включается.
        const chars = Array.from(this.value);
        const total = chars.length;

        const begin = start < 0 ? Math.max(total + start, 0) : Math.min(start, total);
        let stop: number;
        if (end === undefined || end === null) {
            stop = total;
        } else {
            stop = end < 0 ? Math.max(total + end, 0) : Math.min(end, total);
        }
        if (stop < begin) {
            stop = begin;
        }

        return chars.slice(begin, stop).join('');
    }

    /** padStart */
    funcInvokePadStartReturn = () => VariableType.vtString;

    funcInvokePadStartArgs = () => [
        new FunctionParameter('targetLength', VariableType.vtNumber, true),
        new FunctionParameter('padString', VariableType.vtString, false, false, ' '),
    ];

    funcInvokePadStart(targetLength: number, padString: string = ' '): string {
        return this.pad(targetLength, padString, true);
    }

    /** padEnd */
    funcInvokePadEndReturn = () => VariableType.vtString;

    funcInvokePadEndArgs = () => [
        new FunctionParameter('targetLength', VariableType.vtNumber, true),
        new FunctionParameter('padString', VariableType.vtString, false, false, ' '),
    ];

    funcInvokePadEnd(targetLength: number, padString: string = ' '): string {
        return this.pad(targetLength, padString, false);
    }

    private pad(targetLength: number, padString: string, start: boolean): string {
        //ToInteger длины (как PHP int-параметр и нативный padStart), иначе дробная
        //targetLength дала бы лишний символ в цикле дополнения.
        targetLength = Math.trunc(targetLength);

        //По код-поинтам (Array.from), как PHP mb_str_split: длина и нарезка совпадают
        //с PHP, а нативный padStart считает по UTF-16 код-юнитам.
        const chars = Array.from(this.value);
        const len = chars.length;

        if (len >= targetLength || padString === '') {
            return this.value;
        }

        const padChars = Array.from(padString);
        const need = targetLength - len;
        let pad = '';
        for (let i = 0; i < need; i++) {
            pad += padChars[i % padChars.length];
        }

        return start ? pad + this.value : this.value + pad;
    }

    /** trimStart — нативный trimStart режет ровно ECMAScript-набор пробелов (см. PHP JS_WHITESPACE). */
    funcInvokeTrimStartReturn = () => VariableType.vtString;

    funcInvokeTrimStart(): string {
        return this.value.trimStart();
    }

    /** trimEnd */
    funcInvokeTrimEndReturn = () => VariableType.vtString;

    funcInvokeTrimEnd(): string {
        return this.value.trimEnd();
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
                throw new InterpreterException('Failed convert ' + value.typeName + ' to string', this.getContext()?.currentToken?.cursorPos);

            values.push(varString.value);
        });

        if (typeof this.value === 'string')
            return this.value.concat.apply(this.value, values);

        return ''.concat.apply('', values);
    }

}
