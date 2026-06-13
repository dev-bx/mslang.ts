import {StackVariable} from "./stackvariable";
import {StackVariableArray} from "./stackvariablearray";
import {StackVariableUndefined} from "./stackvariableundefined";
import {StackVariableRef} from "./stackvariableref";
import {VariableType} from "./variabletype";
import {InterpreterException, ResourceLimitException} from "./exceptions";
import type {BuiltinConstructor} from "./builtinconstructor";
import type {ContextInterpreter} from "./interpreter.js";

/**
 * Нативный «класс» `Array` для JS-стиля `new Array(N)` и `new Array(a, b, c)`.
 *
 * Семантика:
 *   - `new Array()`         → `[]` (пустой массив).
 *   - `new Array(N)` где N — целое неотрицательное число: массив длиной N
 *     с `undefined`-ячейками. После этого удобно сразу `.fill(value)`
 *     для инициализации.
 *   - `new Array(a, b, c)`  → `[a, b, c]` (массив-литерал из аргументов).
 *
 * Регистрируется через {@see ContextInterpreter.registerConst} под именем `"Array"`.
 * Зеркало PHP-эталона ArrayConstructor.
 */
export class ArrayConstructor extends StackVariable implements BuiltinConstructor {
    constructor() {
        super(VariableType.vtObject, true);
    }

    construct(parameters: StackVariable[], context: ContextInterpreter | null = null): StackVariable {
        //new Array() → пустой массив.
        if (parameters.length === 0) {
            return new StackVariableArray(false, [], context);
        }

        //new Array(N) где N — число: создаём массив фиксированной длины с
        //undefined в каждой ячейке. Это и есть JS-семантика, удобно в связке
        //с .fill(value).
        if (parameters.length === 1) {
            let first: StackVariable = parameters[0];
            if (first instanceof StackVariableRef) {
                first = first.refValue as StackVariable;
            }
            const asNumber = first.castAs(VariableType.vtNumber);
            //Зеркало PHP: если один аргумент кастуется в число — это попытка задать
            //длину. Допустимая длина — неотрицательное целое; иначе бросаем (как PHP),
            //а не молча создаём [NaN]/[Infinity]. NaN/Infinity/"abc"/дробное/отрицательное
            //отбраковываются здесь. Текст печатает NAN/INF, как PHP.
            if (asNumber !== null && typeof asNumber.value === 'number') {
                const n = asNumber.value as number;
                if (Number.isInteger(n) && n >= 0) {
                    //Предварительная проверка бюджета данных ДО материализации N ячеек:
                    //иначе при огромном N память съел бы сам цикл ниже — раньше, чем
                    //учёт в конструкторе StackVariableArray (он спишет бюджет по факту).
                    if (context && context.getLimitAllocBytes()
                        && context.getAllocatedBytes() + n * 16 > context.getLimitAllocBytes()) {
                        throw new ResourceLimitException('Allocation limit [' + context.getLimitAllocBytes() + '] exceeded', context.currentToken?.cursorPos);
                    }
                    const items: StackVariable[] = [];
                    for (let i = 0; i < n; i++) {
                        items.push(new StackVariableUndefined(false));
                    }
                    return new StackVariableArray(false, items, context);
                }
                const label = Number.isNaN(n) ? 'NAN' : (n === Infinity ? 'INF' : (n === -Infinity ? '-INF' : String(n)));
                throw new InterpreterException('Invalid array length: ' + label, context?.currentToken?.cursorPos);
            }
        }

        //new Array(a, b, c, ...) — массив-литерал из аргументов.
        const items: StackVariable[] = [];
        for (let i = 0; i < parameters.length; i++) {
            let item: StackVariable = parameters[i];
            if (item instanceof StackVariableRef) {
                item = item.refValue as StackVariable;
            }
            items.push(item);
        }
        return new StackVariableArray(false, items, context);
    }
}
