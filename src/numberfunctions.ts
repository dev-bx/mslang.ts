import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableRef} from "./stackvariableref.js";

/**
 * Зеркало PHP NumberFunctions. Namespace-объект `Number`: разбор чисел из строк и проверки.
 * Регистрируется в `registerConst()` под именем `"Number"`.
 *
 * `Number.parseInt`/`Number.parseFloat` повторяют семантику глобальных JS-функций (читают
 * ведущее число из «грязной» строки). `Number.isInteger/isNaN/isFinite` — строгие проверки
 * без приведения.
 */
export class NumberFunctions extends StackVariable {
    constructor() {
        super(VariableType.vtObject, true);
    }

    funcInvoke_parseIntReturn = () => VariableType.vtNumber;

    funcInvoke_parseInt(...args: unknown[]): number {
        //trimStart — нативный режет ровно ECMAScript-набор пробелов (как PHP JS_WHITESPACE).
        const text = NumberFunctions.argToString(args[0]).trimStart();

        let radix = 0;
        if (args[1] instanceof StackVariable) {
            const asNumber = args[1].castAs(VariableType.vtNumber);
            radix = asNumber ? NumberFunctions.toInt32(Number(asNumber.value)) : 0;
        }

        const length = text.length;
        let index = 0;

        let sign = 1;
        if (index < length && (text[index] === '+' || text[index] === '-')) {
            if (text[index] === '-') {
                sign = -1;
            }
            index++;
        }

        let stripPrefix = true;
        if (radix !== 0) {
            if (radix < 2 || radix > 36) {
                return NaN;
            }
            if (radix !== 16) {
                stripPrefix = false;
            }
        } else {
            radix = 10;
        }

        if (stripPrefix
            && index + 1 < length
            && text[index] === '0'
            && (text[index + 1] === 'x' || text[index + 1] === 'X')
        ) {
            index += 2;
            radix = 16;
        }

        const start = index;
        //Основание 10 копим строкой и берём Number() разом — точное округление огромного
        //целого в double (как JS). Прочие основания — накопление в double тем же порядком,
        //что и PHP-эталон.
        const asDecimalString = (radix === 10);
        let digits = '';
        let result = 0;

        while (index < length) {
            const digit = NumberFunctions.digitValue(text[index]);
            if (digit < 0 || digit >= radix) {
                break;
            }
            if (asDecimalString) {
                digits += text[index];
            } else {
                result = result * radix + digit;
            }
            index++;
        }

        if (index === start) {
            return NaN;
        }

        if (asDecimalString) {
            result = Number(digits);
        }

        return sign * result;
    }

    funcInvoke_parseFloatReturn = () => VariableType.vtNumber;

    funcInvoke_parseFloat(...args: unknown[]): number {
        const text = NumberFunctions.argToString(args[0]).trimStart();

        let m = /^[+-]?Infinity/.exec(text);
        if (m) {
            return m[0][0] === '-' ? -Infinity : Infinity;
        }

        m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text);
        if (m) {
            return Number(m[0]);
        }

        return NaN;
    }

    funcInvoke_isIntegerReturn = () => VariableType.vtBoolean;

    funcInvoke_isInteger(...args: unknown[]): boolean {
        const value = args[0];
        if (!(value instanceof StackVariable) || value.type !== VariableType.vtNumber) {
            return false;
        }
        const n = Number(value.value);
        return Number.isFinite(n) && Math.floor(n) === n;
    }

    funcInvoke_isNaNReturn = () => VariableType.vtBoolean;

    funcInvoke_isNaN(...args: unknown[]): boolean {
        const value = args[0];
        if (!(value instanceof StackVariable) || value.type !== VariableType.vtNumber) {
            return false;
        }
        return Number.isNaN(Number(value.value));
    }

    funcInvoke_isFiniteReturn = () => VariableType.vtBoolean;

    funcInvoke_isFinite(...args: unknown[]): boolean {
        const value = args[0];
        if (!(value instanceof StackVariable) || value.type !== VariableType.vtNumber) {
            return false;
        }
        return Number.isFinite(Number(value.value));
    }

    /**
     * `Number.roundTo(value, digits)` — округляет до `digits` знаков и возвращает ЧИСЛО
     * (через ту же запись, что `toFixed`). NaN/Infinity — как есть. digits зажат в 0..100.
     */
    funcInvoke_roundToReturn = () => VariableType.vtNumber;

    funcInvoke_roundTo(...args: unknown[]): number {
        const value = NumberFunctions.argToNumber(args[0]);
        if (Number.isNaN(value) || !Number.isFinite(value)) {
            return value;
        }
        const digits = NumberFunctions.argToDigits(args[1]);
        return Number(StackVariableNumber.toFixedString(value, digits));
    }

    /**
     * `Number.format(value [, digits [, decPoint [, thousandsSep]]])` — число в строку с
     * фиксированным числом знаков и группировкой целой части. Без локали (разделители явные,
     * по умолчанию точка и запятая). Округление — через `toFixed`.
     */
    funcInvoke_formatReturn = () => VariableType.vtString;

    funcInvoke_format(...args: unknown[]): string {
        const value = NumberFunctions.argToNumber(args[0]);
        const digits = NumberFunctions.argToDigits(args[1]);
        const decPoint = args[2] instanceof StackVariable ? NumberFunctions.argToString(args[2]) : '.';
        const thousandsSep = args[3] instanceof StackVariable ? NumberFunctions.argToString(args[3]) : ',';
        return NumberFunctions.formatNumber(value, digits, decPoint, thousandsSep);
    }

    /**
     * Сборка строки `Number.format` вручную (не через локаль): округляем через единый
     * toFixed, группируем целую часть по три цифры.
     */
    private static formatNumber(value: number, digits: number, decPoint: string, thousandsSep: string): string {
        if (Number.isNaN(value)) {
            return 'NaN';
        }
        if (!Number.isFinite(value)) {
            return value < 0 ? '-Infinity' : 'Infinity';
        }

        let fixed = StackVariableNumber.toFixedString(value, digits);

        let negative = fixed.startsWith('-');
        if (negative) {
            fixed = fixed.substring(1);
        }

        const dotPos = fixed.indexOf('.');
        const intPart = dotPos === -1 ? fixed : fixed.substring(0, dotPos);
        const fracPart = dotPos === -1 ? '' : fixed.substring(dotPos + 1);

        //Группировка целой части по три цифры справа.
        let grouped = '';
        const len = intPart.length;
        for (let i = 0; i < len; i++) {
            if (i > 0 && (len - i) % 3 === 0) {
                grouped += thousandsSep;
            }
            grouped += intPart[i];
        }

        let result = grouped;
        if (digits > 0) {
            result += decPoint + fracPart;
        }

        //«-0»/«-0.00» не показываем: знак только при реальном ненулевом значении.
        if (negative && [...(intPart + fracPart)].every(c => c === '0')) {
            negative = false;
        }

        return negative ? '-' + result : result;
    }

    /** Число из аргумента по правилам JS-приведения (нет аргумента → NaN). */
    private static argToNumber(arg: unknown): number {
        let a: unknown = arg;
        if (a instanceof StackVariableRef) {
            a = a.refValue;
        }
        if (a instanceof StackVariable) {
            const asNumber = a.castAs(VariableType.vtNumber);
            if (asNumber) {
                return Number(asNumber.value);
            }
        }
        return NaN;
    }

    /** Число знаков после точки: целое, зажатое в 0..100 (по умолчанию 0). */
    private static argToDigits(arg: unknown): number {
        let a: unknown = arg;
        if (a instanceof StackVariableRef) {
            a = a.refValue;
        }
        let digits = 0;
        if (a instanceof StackVariable) {
            const asNumber = a.castAs(VariableType.vtNumber);
            if (asNumber) {
                const n = Number(asNumber.value);
                if (Number.isFinite(n)) {
                    digits = Math.trunc(n);
                }
            }
        }
        return Math.max(0, Math.min(100, digits));
    }

    private static argToString(arg: unknown): string {
        if (arg instanceof StackVariable) {
            const asString = arg.castAs(VariableType.vtString);
            return asString ? String(asString.value) : '';
        }
        return '';
    }

    private static digitValue(char: string): number {
        const code = char.charCodeAt(0);
        if (code >= 48 && code <= 57) {
            return code - 48;
        }
        if (code >= 97 && code <= 122) {
            return code - 97 + 10;
        }
        if (code >= 65 && code <= 90) {
            return code - 65 + 10;
        }
        return -1;
    }

    /** JS ToInt32 для основания parseInt: `n | 0` — это и есть ToInt32. */
    private static toInt32(n: number): number {
        return n | 0;
    }
}
