import {CompareType} from "./parser.js";
import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {InterpreterException} from "./exceptions";

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
            throw new InterpreterException('Value must be a number', this.getContext()?.currentToken?.cursorPos);

        return this._value as number;
    }

    /**
     * Смещение таймзоны в секундах от UTC (из конфига контекста). Компоненты даты
     * считаем как UTC от сдвинутого timestamp (getUTC*) — так JS и PHP дают
     * одинаковый результат независимо от зоны сервера. По умолчанию 0 (UTC).
     * Зеркало PHP StackVariableDateTime::tzOffsetSeconds.
     */
    private tzOffsetSeconds(): number {
        const ctx = this.getContext();
        return (ctx ? ctx.getTimezoneOffsetMinutes() : 0) * 60;
    }

    //Зеркало PHP createStackVariableDateTime: пробрасываем контекст в производный
    //объект (иначе у результата AddDays/Today не будет таймзоны/контекста).
    private makeDateTime(ts: number): StackVariableDateTime {
        const dt = new StackVariableDateTime(ts);
        dt.setContext(this.getContext());
        return dt;
    }

    properties = {
        'Today': {
            get(this: StackVariableDateTime) {
                //Полночь сегодня в зоне конфига: сдвигаем, обрезаем до суток, возвращаем сдвиг.
                const off = this.tzOffsetSeconds();
                const now = Math.floor(Date.now() / 1000);
                const midnight = Math.floor((now + off) / 86400) * 86400 - off;
                return this.makeDateTime(midnight);
            }
        },
        'Now': {
            get(this: StackVariableDateTime) {
                return this.makeDateTime(Math.floor(Date.now() / 1000));
            },
        },
        'Year': {
            get(this: StackVariableDateTime) {
                return new StackVariableNumber(true, new Date((this.value + this.tzOffsetSeconds()) * 1000).getUTCFullYear());
            }
        },
        'Month': {
            get(this: StackVariableDateTime) {
                return new StackVariableNumber(true, new Date((this.value + this.tzOffsetSeconds()) * 1000).getUTCMonth() + 1);
            }
        },
        'Day': {
            get(this: StackVariableDateTime) {
                return new StackVariableNumber(true, new Date((this.value + this.tzOffsetSeconds()) * 1000).getUTCDate());
            }
        },
        'Hour': {
            get(this: StackVariableDateTime) {
                return new StackVariableNumber(true, new Date((this.value + this.tzOffsetSeconds()) * 1000).getUTCHours());
            },
        },
        'Minute': {
            get(this: StackVariableDateTime) {
                return new StackVariableNumber(true, new Date((this.value + this.tzOffsetSeconds()) * 1000).getUTCMinutes());
            },
        },
        'DayOfWeek': {
            get(this: StackVariableDateTime) {
                return new StackVariableNumber(true, new Date((this.value + this.tzOffsetSeconds()) * 1000).getUTCDay());
            },
        },
        'Time': {
            get(this: StackVariableDateTime) {
                //Зеркало PHP getPropertyTime(): секунды от полуночи как ЧИСЛО (в зоне конфига).
                const d = new Date((this.value + this.tzOffsetSeconds()) * 1000);
                return new StackVariableNumber(true, (d.getUTCHours() * 60 * 60) + (d.getUTCMinutes() * 60) + d.getUTCSeconds());
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
        return this.makeDateTime(this.value+(days*60*60*24));
    }

    /** AddHours*/

    funcInvokeAddHoursArgs() {
        return [
            new FunctionParameter('hours', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddHours(hours: number)
    {
        return this.makeDateTime(this.value+(hours*60*60));
    }

    /** AddMinutes */

    funcInvokeAddMinutesArgs() {
        return [
            new FunctionParameter('minutes', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddMinutes(minutes: number)
    {
        return this.makeDateTime(this.value+(minutes*60));
    }

    /** AddSeconds */

    funcInvokeAddSecondsArgs() {
        return [
            new FunctionParameter('seconds', VariableType.vtNumber, true),
        ]
    }

    funcInvokeAddSeconds(seconds: number)
    {
        return this.makeDateTime(this.value+seconds);
    }

    /** fromTimestamp */

    funcInvokeFromTimestampArgs() {
        return [
            new FunctionParameter('seconds', VariableType.vtNumber, true),
        ]
    }

    funcInvokeFromTimestamp(seconds: number): StackVariableDateTime {
        return this.makeDateTime(Math.trunc(seconds));
    }

    /** format */

    funcInvokeFormatArgs() {
        return [
            new FunctionParameter('format', VariableType.vtString, false, false, 'YYYY-MM-DD HH:mm:ss'),
        ]
    }

    funcInvokeFormat(format: string = 'YYYY-MM-DD HH:mm:ss'): StackVariableString {
        const ctx = this.getContext();
        if (typeof this._value !== 'number') {
            return new StackVariableString(false, '', ctx);
        }

        const d = new Date((this.value + this.tzOffsetSeconds()) * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');

        const result = StackVariableDateTime.applyFormat(
            format,
            String(d.getUTCFullYear()),
            pad(d.getUTCMonth() + 1),
            pad(d.getUTCDate()),
            pad(d.getUTCHours()),
            pad(d.getUTCMinutes()),
            pad(d.getUTCSeconds()),
        );

        return new StackVariableString(false, result, ctx);
    }

    /** parse */

    funcInvokeParseArgs() {
        return [
            new FunctionParameter('str', VariableType.vtString, true),
            new FunctionParameter('format', VariableType.vtString, false, false, 'YYYY-MM-DD HH:mm:ss'),
        ]
    }

    funcInvokeParse(str: string, format: string = 'YYYY-MM-DD HH:mm:ss'): StackVariableDateTime {
        let year = 1970, month = 1, day = 1, hour = 0, minute = 0, second = 0;
        const get = (si: number, len: number) => parseInt(str.substring(si, si + len), 10) || 0;

        let fi = 0, si = 0;
        const flen = format.length;
        while (fi < flen) {
            if (format.substring(fi, fi + 4) === 'YYYY') { year = get(si, 4); fi += 4; si += 4; }
            else if (format.substring(fi, fi + 2) === 'MM') { month = get(si, 2); fi += 2; si += 2; }
            else if (format.substring(fi, fi + 2) === 'DD') { day = get(si, 2); fi += 2; si += 2; }
            else if (format.substring(fi, fi + 2) === 'HH') { hour = get(si, 2); fi += 2; si += 2; }
            else if (format.substring(fi, fi + 2) === 'mm') { minute = get(si, 2); fi += 2; si += 2; }
            else if (format.substring(fi, fi + 2) === 'ss') { second = get(si, 2); fi += 2; si += 2; }
            else { fi += 1; si += 1; }
        }

        const ts = Math.floor(Date.UTC(year, month - 1, day, hour, minute, second) / 1000) - this.tzOffsetSeconds();
        return this.makeDateTime(ts);
    }

    /**
     * Подстановка токенов шаблона `format`. Длинный токен (`YYYY`) проверяем раньше коротких;
     * `MM` (месяц) и `mm` (минута) различаются регистром. Зеркало PHP applyFormat.
     */
    private static applyFormat(fmt: string, y: string, mo: string, d: string, h: string, mi: string, s: string): string {
        let out = '';
        const len = fmt.length;
        let i = 0;
        while (i < len) {
            if (fmt.substring(i, i + 4) === 'YYYY') { out += y; i += 4; }
            else if (fmt.substring(i, i + 2) === 'MM') { out += mo; i += 2; }
            else if (fmt.substring(i, i + 2) === 'DD') { out += d; i += 2; }
            else if (fmt.substring(i, i + 2) === 'HH') { out += h; i += 2; }
            else if (fmt.substring(i, i + 2) === 'mm') { out += mi; i += 2; }
            else if (fmt.substring(i, i + 2) === 'ss') { out += s; i += 2; }
            else { out += fmt[i]; i += 1; }
        }
        return out;
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
                //Компоненты строки — локальное время в зоне конфига → timestamp = UTC(компоненты) - offset.
                compareValue = Math.floor(Date.UTC(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]),
                    m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0, m[6] ? parseInt(m[6]) : 0) / 1000) - this.tzOffsetSeconds();
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
                throw new InterpreterException('Unknown compare type ' + compareType, this.getContext()?.currentToken?.cursorPos);
        }
    }

    castAs(variableType: VariableType)
    {
        switch (variableType)
        {
            case VariableType.vtString: {
                const d = new Date((this.value + this.tzOffsetSeconds()) * 1000);
                const pad = (n: number) => String(n).padStart(2, '0');
                const s = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' '
                    + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
                return new StackVariableString(false, s, this.getContext());
            }
            case VariableType.vtBoolean:
                //JS: объект (в т.ч. Date, даже эпоха) всегда истина.
                return new StackVariableBoolean(false, true);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, this.value);
        }

        return null;
    }

    toPrimitive(): StackVariable {
        //ISO 8601 с числовым смещением зоны (детерминированно для JS/PHP).
        const ctx = this.getContext();
        const offMin = ctx ? ctx.getTimezoneOffsetMinutes() : 0;
        const d = new Date((this.value + offMin * 60) * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        const sign = offMin < 0 ? '-' : '+';
        const abs = Math.abs(offMin);
        const offStr = sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
        const body = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T'
            + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
        return new StackVariableString(false, body + offStr, this.getContext());
    }

}
