import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {MSLangException} from "./exceptions";

export class MathFunctions extends StackVariable {

    constructor() {
        super(VariableType.vtObject, true);
    }

    properties = {
        E: {
            get()
            {
                return new StackVariableNumber(false, Math.E);
            }
        },
        LN10: {
            get()
            {
                return new StackVariableNumber(false, Math.LN10);
            }
        },
        LN2: {
            get()
            {
                return new StackVariableNumber(false, Math.LN2);
            }
        },
        LOG10E: {
            get()
            {
                return new StackVariableNumber(false, Math.LOG10E);
            }
        },
        LOG2E: {
            get()
            {
                return new StackVariableNumber(false, Math.LOG2E);
            }
        },
        PI: {
            get()
            {
                return new StackVariableNumber(false, Math.PI);
            }
        },
        SQRT1_2: {
            get()
            {
                return new StackVariableNumber(false, Math.SQRT1_2);
            }
        },
        SQRT2: {
            get()
            {
                return new StackVariableNumber(false, Math.SQRT2);
            }
        },
    }

    /** abs */

    funcInvoke_absReturn = () => VariableType.vtNumber;

    funcInvoke_absArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_abs(x: number)
    {
        return Math.abs(x);
    }

    /** acos */

    funcInvoke_acosReturn = () => VariableType.vtNumber;

    funcInvoke_acosArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_acos(x: number)
    {
        return Math.acos(x);
    }

    /** acosh */

    funcInvoke_acoshReturn = () => VariableType.vtNumber;

    funcInvoke_acoshArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_acosh(x: number)
    {
        return Math.acosh(x);
    }

    /** asin */

    funcInvoke_asinReturn = () => VariableType.vtNumber;

    funcInvoke_asinArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_asin(x: number)
    {
        return Math.asin(x);
    }

    /** asinh */

    funcInvoke_asinhReturn = () => VariableType.vtNumber;

    funcInvoke_asinhArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_asinh(x: number)
    {
        return Math.asinh(x);
    }

    /** atan */

    funcInvoke_atanReturn = () => VariableType.vtNumber;

    funcInvoke_atanArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_atan(x: number)
    {
        return Math.atan(x);
    }

    /** atan2 */

    funcInvoke_atan2Return = () => VariableType.vtNumber;

    funcInvoke_atan2Args() {
        return [
            new FunctionParameter('y', VariableType.vtNumber, true),
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_atan2(y: number, x: number)
    {
        return Math.atan2(y, x);
    }

    /** atanh */

    funcInvoke_atanhReturn = () => VariableType.vtNumber;

    funcInvoke_atanhArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_atanh(x: number)
    {
        return Math.atanh(x);
    }

    /** ceil */

    funcInvoke_ceilReturn = () => VariableType.vtNumber;

    funcInvoke_ceilArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_ceil(x: number)
    {
        return Math.ceil(x);
    }

    /** cos */

    funcInvoke_cosReturn = () => VariableType.vtNumber;

    funcInvoke_cosArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_cos(x: number)
    {
        return Math.cos(x);
    }

    /** cosh */

    funcInvoke_coshReturn = () => VariableType.vtNumber;

    funcInvoke_coshArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_cosh(x: number)
    {
        return Math.cosh(x);
    }

    /** exp */

    funcInvoke_expReturn = () => VariableType.vtNumber;

    funcInvoke_expArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_exp(x: number)
    {
        return Math.exp(x);
    }

    /** expm1 */

    funcInvoke_expm1Return = () => VariableType.vtNumber;

    funcInvoke_expm1Args() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_expm1(x: number)
    {
        return Math.expm1(x);
    }

    /** floor */

    funcInvoke_floorReturn = () => VariableType.vtNumber;

    funcInvoke_floorArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_floor(x: number)
    {
        return Math.floor(x);
    }

    /** hypot */

    funcInvoke_hypotReturn = () => VariableType.vtNumber;

    funcInvoke_hypotArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
            new FunctionParameter('y', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_hypot(x: number, y: number)
    {
        return Math.hypot(x, y);
    }

    /** log */

    funcInvoke_logReturn = () => VariableType.vtNumber;

    funcInvoke_logArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_log(x: number)
    {
        return Math.log(x);
    }

    /** log10 */

    funcInvoke_log10Return = () => VariableType.vtNumber;

    funcInvoke_log10Args() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_log10(x: number)
    {
        return Math.log10(x);
    }

    /** log1p */

    funcInvoke_log1pReturn = () => VariableType.vtNumber;

    funcInvoke_log1pArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_log1p(x: number)
    {
        return Math.log1p(x);
    }

    /** max */
    funcInvoke_maxReturn = () => VariableType.vtNumber;

    funcInvoke_max()
    {
        const values: number[] = [];

        Object.values(arguments).forEach(value => {
            let varNumber = value.castAs(VariableType.vtNumber);

            if (!varNumber)
                throw new MSLangException('Failed cast ' + value.typeName + ' as number');

            values.push(varNumber.value);
        });

        return Math.max(...values);
    }

    /** min */
    funcInvoke_minReturn = () => VariableType.vtNumber;

    funcInvoke_min()
    {
        const values: number[] = [];

        Object.values(arguments).forEach(value => {
            let varNumber = value.castAs(VariableType.vtNumber);

            if (!varNumber)
                throw new MSLangException('Failed cast ' + value.typeName + ' as number');

            values.push(varNumber.value);
        });

        return Math.min(...values);
    }

    /** pow */

    funcInvoke_powReturn = () => VariableType.vtNumber;

    funcInvoke_powArgs() {
        return [
            new FunctionParameter('num', VariableType.vtNumber, true),
            new FunctionParameter('exponent', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_pow(num: number, exponent: number)
    {
        return Math.pow(num, exponent);
    }

    /** round */

    funcInvoke_roundReturn = () => VariableType.vtNumber;

    funcInvoke_roundArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_round(x: number)
    {
        return Math.round(x);
    }

    /** sin */

    funcInvoke_sinReturn = () => VariableType.vtNumber;

    funcInvoke_sinArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_sin(x: number)
    {
        return Math.sin(x);
    }

    /** sinh */

    funcInvoke_sinhReturn = () => VariableType.vtNumber;

    funcInvoke_sinhArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_sinh(x: number)
    {
        return Math.sinh(x);
    }

    /** sqrt */

    funcInvoke_sqrtReturn = () => VariableType.vtNumber;

    funcInvoke_sqrtArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_sqrt(x: number)
    {
        return Math.sqrt(x);
    }

    /** tan */

    funcInvoke_tanReturn = () => VariableType.vtNumber;

    funcInvoke_tanArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_tan(x: number)
    {
        return Math.tan(x);
    }

    /** tanh */

    funcInvoke_tanhReturn = () => VariableType.vtNumber;

    funcInvoke_tanhArgs() {
        return [
            new FunctionParameter('x', VariableType.vtNumber, true),
        ]
    }

    funcInvoke_tanh(x: number)
    {
        return Math.tanh(x);
    }

    //random

    funcInvoke_randomReturn = () => VariableType.vtNumber;

    funcInvoke_random()
    {
        return Math.random();
    }

}