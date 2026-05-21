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
            result += String.fromCharCode(code | 0);
        }
        return result;
    }
}
