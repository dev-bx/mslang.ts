import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";

/**
 * Статические методы JS-объекта `String`. Регистрируется через
 * `ContextInterpreter.registerConst()` под именем `"String"`.
 */
export class StringStaticFunctions extends StackVariable {
    constructor() {
        super(VariableType.vtObject, true);
    }

    /** String.fromCharCode(c1, c2, ...) */
    funcInvoke_fromCharCodeReturn = () => VariableType.vtString;

    funcInvoke_fromCharCode(...args: unknown[]): string {
        let result = '';
        for (const a of args) {
            let code: number;
            if (a instanceof StackVariable) {
                const n = a.castAs(VariableType.vtNumber);
                if (!n) continue;
                code = Number(n.value);
            } else {
                code = Number(a);
            }
            //Зеркало PHP mb_chr: собираем по КОД-ПОИНТУ, а не код-юниту UTF-16
            //(fromCharCode терял астральные символы — эмодзи). Невалидный код → ''
            //(как mb_chr возвращает false).
            const i = Math.trunc(code);
            if (!Number.isFinite(i) || i < 0 || i > 0x10FFFF)
                continue;
            result += String.fromCodePoint(i);
        }
        return result;
    }
}
