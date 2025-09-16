import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableUndefined} from "./stackvariableundefined";
import {MSLangException} from "./exceptions";

export class StackVariableString extends StackVariable {
    constructor(isConst: boolean = false, value: string) {
        super(VariableType.vtString, isConst);

        this.value = value;
    }

    get value(): string {
        if (typeof this._value !== 'string')
            throw new MSLangException('String value not initialized');

        return this._value;
    }
    set value(value: unknown) {
        if (typeof value !== 'string')
            throw new Error('variable type '+typeof value+' expected string')

        this._value = value;
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

        if (start<0)
            start = this.value.length+start;

        if (end === null)
            end = undefined;

        return this.value.substring(start, end)
    }

    /** Concat */

    funcInvokeConcatReturn = () => VariableType.vtString;

    funcInvokeConcat()
    {
        const values: string[] = [];

        Object.values(arguments).forEach(value => {
            let varString = value.castAs(VariableType.vtString);

            if (!varString)
                throw new Error('Failed convert '+value.typeName+' to string');

            values.push(varString.value);
        });

        if (typeof this.value === 'string')
            return this.value.concat.apply(this.value, values);

        return ''.concat.apply('', values);
    }

}
