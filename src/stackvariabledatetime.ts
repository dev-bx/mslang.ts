import {CompareType} from "./parser.js";
import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {MSLangException} from "./exceptions";

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const dateTimeSecRegex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const timeRegex = /^(\d{2}):(\d{2})$/;
const timeSecRegex = /^(\d{2}):(\d{2}):(\d{2})$/;

export class StackVariableDateTime extends StackVariable {
    constructor(value: unknown) {
        super(VariableType.vtObject, true);

        if (typeof value === 'number')
            this._value = Math.floor(value);
    }

    get value(): number {
        if (typeof this._value !== 'number')
            throw new MSLangException('Value must be a number');

        return this._value as number;
    }

    properties = {
        'Today': {
            get() {
                const d = new Date();
                d.setHours(0,0,0,0);
                return new StackVariableDateTime(Math.floor(d.getTime()/1000));
            }
        },
        'Now': {
            get() {
                const d = new Date();
                return new StackVariableDateTime(Math.floor(d.getTime()/1000));
            },
        },
        'Year': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);
                return new StackVariableNumber(true, d.getFullYear());
            }
        },
        'Month': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);

                if (d)
                    return new StackVariableNumber(true, d.getMonth()+1);

                return undefined;
            }
        },
        'Day': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);
                if (d)
                    return new StackVariableNumber(true, d.getDate());

                return undefined;
            }
        },
        'Hour': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);
                if (d)
                    return new StackVariableNumber(true, d.getHours());

                return undefined;
            },
        },
        'Minute': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);
                if (d)
                    return new StackVariableNumber(true, d.getMinutes());

                return undefined;
            },
        },
        'DayOfWeek': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);
                if (d)
                    return new StackVariableNumber(true, d.getDay());

                return undefined;
            },
        },
        'Time': {
            get(this: StackVariableDateTime) {
                const d = new Date(this.value * 1000);
                if (d) {
                    return new StackVariableDateTime((d.getHours() * 60 * 60) + (d.getMinutes() * 60) + d.getSeconds());
                }

                return undefined;
            },
        }
    }

    /** AddDays */

    funcInvokeAddDaysArgs() {
        return [
            new FunctionParameter('days', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddDays(days: number)
    {
        return new StackVariableDateTime(this.value+(days*60*60*24));
    }

    /** AddHours*/

    funcInvokeAddHoursArgs() {
        return [
            new FunctionParameter('hours', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddHours(hours: number)
    {
        return new StackVariableDateTime(this.value+(hours*60*60));
    }

    /** AddMinutes */

    funcInvokeAddMinutesArgs() {
        return [
            new FunctionParameter('minutes', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddMinutes(minutes: number)
    {
        return new StackVariableDateTime(this.value+(minutes*60));
    }

    /** AddSeconds */

    funcInvokeAddSecondsArgs() {
        return [
            new FunctionParameter('minutes', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddSeconds(seconds: number)
    {
        return new StackVariableDateTime(this.value+seconds);
    }

    comparePriority(variable: StackVariable, compareType: CompareType):number|false
    {
        if (variable instanceof StackVariableDateTime)
            return 1;

        if (variable.isNumeric)
            return 1;

        if (variable.type === VariableType.vtString && typeof variable.value === 'string')
        {
            let m = variable.value.match(dateTimeSecRegex);
            if (!m)
                m = variable.value.match(dateTimeRegex);
            if (!m)
                m = variable.value.match(dateRegex);
            if (!m)
                m = variable.value.match(timeSecRegex);
            if (!m)
                m = variable.value.match(timeRegex);

            if (m === null)
                return false;

            return 1;
        }

        return false;
    }

    compare(variable: StackVariable, compareType: CompareType)
    {
        let compareValue:unknown = false;

        if (variable instanceof StackVariableDateTime || variable.isNumeric)
        {
            compareValue = variable.value;
        } else if (variable.type === VariableType.vtString && typeof variable.value === 'string')
        {
            let m = variable.value.match(dateTimeSecRegex);
            if (!m)
                m = variable.value.match(dateTimeRegex);
            if (!m)
                m = variable.value.match(dateRegex);

            if (m)
            {
                const date = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]),
                    m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0, m[6] ? parseInt(m[6]) : 0, 0);
                if (date)
                    compareValue = Math.floor(date.getTime()/1000);
            } else {
                m = variable.value.match(timeSecRegex);
                if (!m)
                    m = variable.value.match(timeRegex);

                if (m)
                {
                    compareValue = (parseInt(m[1])*60*60)+(parseInt(m[2])*60);
                    if (m[3])
                        (compareValue as number) += parseInt(m[3]);
                }
            }
        } else {
            compareValue = variable.value;
        }

        switch (compareType)
        {
            case CompareType.ctEqual:
                return this.value === compareValue;
            case CompareType.ctNotEqual:
                return this.value !== compareValue;
        }

        if (typeof compareValue !== 'number')
            return false;

        switch (compareType)
        {
            case CompareType.ctLess:
                return this.value < compareValue;
            case CompareType.ctGreat:
                return this.value > compareValue;
            case CompareType.ctEqual | CompareType.ctLess:
                return this.value <= compareValue;
            case CompareType.ctEqual | CompareType.ctGreat:
                return this.value >= compareValue;
            default:
                throw new MSLangException('Unknown compare type ' + compareType);
        }
    }

    castAs(variableType: VariableType)
    {
        switch (variableType)
        {
            case VariableType.vtString: {
                const date = new Date(this.value * 1000);
                const iso = date.toISOString().match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);

                if (iso)
                    return new StackVariableString(false, iso[1] + ' ' + iso[2]);

                return null;
            }
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, !!this.value);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, this.value);
        }

        return null;
    }

    toPrimitive(): StackVariable {
        const d = new Date(this.value * 1000);
        const iso = d.toISOString().match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
        return new StackVariableString(false, iso ? iso[1] + ' ' + iso[2] : '');
    }

}
