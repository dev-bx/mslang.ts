import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableString} from "./stackvariablestring.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableObject} from "./stackvariableobject.js";
import {StackVariableUndefined} from "./stackvariableundefined.js";
import {StackVariableNull} from "./stackvariablenull.js";
import {StackVariableRef} from "./stackvariableref.js";
import {InterpreterException} from "./exceptions";
import type {ContextInterpreter} from "./interpreter.js";

export class StackVariableArray extends StackVariable {

    private _nextNumKey: number = 0;
    constructor(isConst: boolean = false, value: unknown, context: ContextInterpreter | null = null) {
        super(VariableType.vtArray, isConst, context);

        this._nextNumKey = 0;
        this.value = value;

        //Бюджет создаваемых данных (зеркало PHP): новый массив стоит по 16 байт
        //за ячейку (грубая оценка накладных расходов; содержимое ячеек учтено при
        //создании самих значений). Ловит new Array(N) и concat с огромным N.
        if (!isConst && context !== null) {
            context.trackAllocation(this.value.size * 16);
        }
    }


    get value(): Map<string, StackVariable> {
        if (!(this._value instanceof Map))
        {
            this._value = new Map();
        }

        return this._value as Map<string, StackVariable>;
    }

    #addValue(map: Map<unknown, unknown>, k: string, v: unknown)
    {
        if (!(v instanceof StackVariable)) {
            if (Array.isArray(v)) {
                // Зеркало PHP: вложенный массив создаём с контекстом.
                v = new StackVariableArray(false, v, this.getContext());
            } else if (v === null) {
                // typeof null === 'object' в JS — без явной проверки null ушёл бы
                // в StackVariableObject. PHP отдаёт createStackVariableNull.
                v = new StackVariableNull(false);
            } else {

                switch (typeof v) {
                    case "string":
                        v = new StackVariableString(false, v);
                        break;
                    case "boolean":
                        v = new StackVariableBoolean(false, v);
                        break;
                    case "bigint":
                    case "number":
                        v = new StackVariableNumber(false, v);
                        break;
                    case "object":
                        v = new StackVariableObject(false, v);
                        break;
                    case "undefined":
                        v = new StackVariableUndefined(false);
                        break;
                    default:
                        throw new InterpreterException('Incompatible array value ' + typeof v, this.getContext()?.currentToken?.cursorPos);
                }
            }
        }

        if (k.match(/^\d+$/) && Number(k) >= this._nextNumKey) {
            this._nextNumKey = Number(k) + 1;
        }

        map.set(k, v);
    }

    set value(value: unknown) {
        this._nextNumKey = 0;

        const msValue = new Map();

        if (Array.isArray(value)) {
            value.forEach((v, k) => {
                this.#addValue(msValue, k.toString(), v);
            });
        } else if (value instanceof Map) {
            Array.from(value.keys()).forEach(k => {
                this.#addValue(msValue, k.toString(), value.get(k));
            });
        } else if (typeof value === 'object' && value !== null)
        {
            for (const [k, v] of Object.entries(value))
            {
                this.#addValue(msValue, k.toString(), v);
            }
        }

        this._value = msValue;
    }

    getProperty(name: string) {
        // .length у массива — это размер коллекции (зеркало PHP getProperty_length).
        if (name === 'length') {
            return new StackVariableNumber(false, this.value.size);
        }
        return this.value.get(name.toString());
    }

    setProperty(name: string, value: StackVariable) {
        if (name === 'length') {
            const asNumber = value.castAs(VariableType.vtNumber);
            if (!asNumber)
                throw new InterpreterException('Failed set length, invalid value', this.getContext()?.currentToken?.cursorPos);

            const newLen = asNumber.value as number;
            const currentLen = this.value.size;

            if (newLen < currentLen) {
                // Усечение: оставляем первые newLen элементов в исходном порядке.
                const keys = Array.from(this.value.keys()).slice(0, newLen);
                const newMap = new Map<string, StackVariable>();
                keys.forEach(k => newMap.set(k, this.value.get(k) as StackVariable));
                this._value = newMap;
            } else if (newLen > currentLen) {
                // Расширение: добиваем undefined, продолжая числовую нумерацию.
                for (let i = currentLen; i < newLen; i++) {
                    this.value.set(this._nextNumKey.toString(), new StackVariableUndefined(false));
                    this._nextNumKey++;
                }
            }
            return;
        }
        this.value.set(name.toString(), value);
    }

    /** Count */

    funcInvoke_countReturn = () => VariableType.vtNumber;

    funcInvoke_count() {
        return this.value.size;
    }

    /** Contains */

    funcInvoke_containsReturn = () => VariableType.vtBoolean;

    funcInvoke_containsArgs() {
        return [
            new FunctionParameter('searchValue', undefined, true),
        ];
    }

    /**
     * Строгое сравнение элемента с искомым значением по правилам JS
     * (includes/indexOf): тип должен совпасть, число сравнивается по значению.
     * Так `[1,null].Contains(null)` → true, `[1].Contains("1")` → false,
     * `[true,false].IndexOf(true)` → 0. Раньше игла приводилась к строке и
     * сравнивалась строкой — это давало неверные результаты и падало на null.
     */
    private matchesNeedle(value: StackVariable, searchValue: unknown): boolean {
        if (searchValue === null)
            return value.type === VariableType.vtNull;
        if (searchValue === undefined)
            return value.type === VariableType.vtUndefined;

        switch (typeof searchValue) {
            case 'boolean':
                return value.type === VariableType.vtBoolean && value.value === searchValue;
            case 'number':
                return value.type === VariableType.vtNumber && Number(value.value) === searchValue;
            case 'string':
                return value.type === VariableType.vtString && value.value === searchValue;
        }

        return false;
    }

    funcInvoke_contains(searchValue: unknown) {
        for (const value of this.value.values()) {
            if (this.matchesNeedle(value, searchValue))
                return true;
        }

        return false;
    }

    /** IndexOf */

    funcInvoke_indexOfReturn = () => VariableType.vtInteger;

    funcInvoke_indexOfArgs() {
        return [
            new FunctionParameter('searchValue', undefined, true),
        ];
    }

    funcInvoke_indexOf(searchValue: unknown) {
        const keys = Array.from(this.value.keys());
        const values = Array.from(this.value.values());

        for (let i = 0; i < values.length; i++) {
            if (this.matchesNeedle(values[i], searchValue)) {
                //Возвращаемый тип — vtInteger, ключи в Map всегда строки;
                //нечисловой ключ приводим как PHP (int): ведущие цифры или 0
                //(Number('k') дал бы NaN — расхождение с PHP).
                return this.keyToInt(keys[i]);
            }
        }

        return -1;
    }

    /**
     * Зеркало PHP `(int)$string`: необязательный ведущий знак и цифры,
     * стоп на первом не-цифре, нет цифр → 0. Для возврата ключа из indexOf.
     */
    private keyToInt(key: string): number {
        const m = key.match(/^\s*[+-]?\d+/);
        return m ? parseInt(m[0], 10) : 0;
    }

    /** push */

    funcInvoke_pushReturn = () => VariableType.vtNumber;

    funcInvoke_push(...args: unknown[]) {
        Object.values(args).forEach(rawValue => {
            if (!(rawValue instanceof StackVariable)) {
                throw new InterpreterException('value must be instance of StackVariable', this.getContext()?.currentToken?.cursorPos);
            }

            //Ref-аргумент (например, параметр функции) указывает на ячейку scope-а,
            //который умрёт вместе с frame. Кладём в массив сам объект StackVariable —
            //тогда он переживёт возврат из функции, и значения не пропадут.
            let value: StackVariable = rawValue;
            if (value instanceof StackVariableRef) {
                value = value.refValue as StackVariable;
            }

            let key;

            do {
                key = this._nextNumKey.toString();
                this._nextNumKey++;
            } while (this.value.has(key))

            this.value.set(key, value);
        });

        return this.value.size;
    }

    /** pop */

    funcInvoke_pop() {
        if (this.value.size) {
            const lastKey = Array.from(this.value.keys()).pop() as string;

            if (lastKey.match(/^\d+$/) && this._nextNumKey - 1 === Number(lastKey)) {
                this._nextNumKey = Number(lastKey);
            }

            const value = this.value.get(lastKey);

            if (!this.value.delete(lastKey))
                throw new InterpreterException('Failed delete key in StackVariableArray', this.getContext()?.currentToken?.cursorPos);

            return value;
        }

        return new StackVariableUndefined(false);
    }

    /** join */

    funcInvoke_joinReturn = () => VariableType.vtString;

    funcInvoke_joinArgs() {
        return [
            new FunctionParameter('separator', VariableType.vtString, false, false, ','),
        ];
    }

    funcInvoke_join(separator: string) {
        return this.convertToNativeArray().join(separator);
    }

    /** concat */

    funcInvoke_concatReturn = () => VariableType.vtArray;

    funcInvoke_concat() {
        const result = new StackVariableArray(false, this._value, this.getContext());

        Array.from(arguments).forEach(param => {
            if (param instanceof StackVariableArray) {
                Array.from(param.value.keys()).forEach(key => {
                    if (key.match(/^\d+$/)) {
                        result.funcInvoke_push(param.value.get(key));
                    } else {
                        result.setProperty(key, param.value.get(key) as StackVariable);
                    }
                });
            } else {
                result.funcInvoke_push(param);
            }
        });

        return result;
    }

    /** keys */

    funcInvoke_keysReturn = () => VariableType.vtArray;

    funcInvoke_keys() {
        return new StackVariableArray(false, Array.from(this.value.keys()), this.getContext());
    }

    /** values */

    funcInvoke_valuesReturn = () => VariableType.vtArray;

    funcInvoke_values() {
        return new StackVariableArray(false, Array.from(this.value.values()), this.getContext());
    }

    /** reverse */

    funcInvoke_reverseReturn = () => VariableType.vtArray;

    funcInvoke_reverse() {
        return new StackVariableArray(false, Array.from(this.value.values()).reverse(), this.getContext());
    }

    /** flip */

    funcInvoke_flipReturn = () => VariableType.vtArray;

    funcInvoke_flip() {
        const result = new StackVariableArray(false, [], this.getContext());

        Array.from(this.value.keys()).forEach(k => {
            const value = this.value.get(k)?.castAs(VariableType.vtString);
            if (!value)
                return;

            if (k.match(/^\d+$/)) {
                result.setProperty(value.value as string, new StackVariableNumber(false, Number(k)));
            } else {
                result.setProperty(value.value as string, new StackVariableString(false, k));
            }
        });

        return result;
    }

    /** shift */

    funcInvoke_shift() {
        if (!this.value.size) {
            return new StackVariableUndefined(false);
        }

        const oldValue = this.value;

        const key = Array.from(oldValue.keys()).shift() as string;
        const value = oldValue.get(key);
        if (!oldValue.delete(key))
            throw new InterpreterException('Failed delete key in StackVariableArray', this.getContext()?.currentToken?.cursorPos);

        this._nextNumKey = 0;
        this._value = new Map();

        Array.from(oldValue.keys()).forEach(key => {
            if (key.match(/^\d+$/)) {
                this.value.set(this._nextNumKey.toString(), oldValue.get(key) as StackVariable);

                this._nextNumKey++;
            } else {
                this.value.set(key, oldValue.get(key) as StackVariable);
            }
        });

        return value;
    }

    /** unshift */

    funcInvoke_unshiftReturn = () => VariableType.vtNumber;

    funcInvoke_unshift() {
        const oldValue = this.value;

        this._nextNumKey = 0;
        this._value = new Map();

        this.funcInvoke_push(...arguments);

        Array.from(oldValue.keys()).forEach(key => {
            if (key.match(/^\d+$/)) {
                this.value.set(this._nextNumKey.toString(), oldValue.get(key) as StackVariable);

                this._nextNumKey++;
            } else {
                this.value.set(key, oldValue.get(key) as StackVariable);
            }
        });

        return this.value.size;
    }

    /** fill */
    funcInvoke_fillReturn = () => VariableType.vtArray;

    funcInvoke_fill(...args: unknown[]): unknown {
        const rawValue = args[0];
        let value: StackVariable;
        if (rawValue instanceof StackVariable) {
            value = rawValue;
        } else {
            value = new StackVariableNumber(false, Number(rawValue));
        }
        const fromArg = args[1];
        const toArg = args[2];
        const keys = Array.from(this.value.keys());
        const n = keys.length;
        let from = fromArg !== undefined ? Number(fromArg instanceof StackVariable ? fromArg.value : fromArg) : 0;
        let to = toArg !== undefined ? Number(toArg instanceof StackVariable ? toArg.value : toArg) : n;
        if (from < 0) from = Math.max(0, n + from);
        if (to < 0) to = Math.max(0, n + to);
        if (from > n) from = n;
        if (to > n) to = n;
        for (let i = from; i < to; i++) {
            this.value.set(keys[i], value);
        }
        return this;
    }

    /** includes */
    funcInvoke_includesReturn = () => VariableType.vtBoolean;

    funcInvoke_includes(...args: unknown[]): boolean {
        const needle = args[0];
        if (!(needle instanceof StackVariable)) return false;
        for (const v of this.value.values()) {
            if (v.type === needle.type && v.value === needle.value) {
                return true;
            }
        }
        return false;
    }

    castAs(variableType: VariableType): StackVariable|null {
        switch (variableType) {
            case VariableType.vtArray:
                return this;
            case VariableType.vtString:
                // Зеркало PHP: явное castAs к строке даёт литерал 'array',
                // а не склейку значений — для склейки есть toPrimitive() и .join().
                return new StackVariableString(false, 'array');
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, this.value.size !== 0);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, this.value.size > 0 ? 1 : 0);
        }

        return null;
    }

    // Рекурсивно сводит массив к плоскому списку примитивных значений
    // (строк/чисел). Использует toPrimitive у каждого элемента.
    protected recursivePrimitiveArray(): unknown[] {
        const result: unknown[] = [];

        this.value.forEach(v => {
            if (v instanceof StackVariableArray) {
                result.push(v.recursivePrimitiveArray());
            } else if (v instanceof StackVariable) {
                const prim = v.toPrimitive();
                if (prim.type !== VariableType.vtString && prim.type !== VariableType.vtNumber)
                    throw new InterpreterException('Failed convert value to primitive', this.getContext()?.currentToken?.cursorPos);
                result.push(prim.value);
            } else {
                result.push(v);
            }
        });

        return result;
    }

    toPrimitive(): StackVariable {
        const flatten = (items: unknown[]): unknown[] => {
            const out: unknown[] = [];
            items.forEach(it => {
                if (Array.isArray(it))
                    out.push(...flatten(it));
                else
                    out.push(it);
            });
            return out;
        };

        const flat = flatten(this.recursivePrimitiveArray());
        return new StackVariableString(false, flat.join(','));
    }

    convertToNativeArray() {
        const result: unknown[] = [];

        this.value.forEach(value => {
            if (value instanceof StackVariable) {
                if (value instanceof StackVariableArray) {
                    result.push(value.convertToNativeArray());
                } else {
                    result.push(value.value);
                }
            } else {
                result.push(value);
            }
        });

        return result;
    }

    convertToNativeMap() {
        const result = new Map();

        Array.from(this.value.keys()).forEach(key => {
            const value = this.value.get(key);

            if (value instanceof StackVariable) {
                if (value instanceof StackVariableArray) {
                    result.set(key, value.convertToNativeMap());
                } else {
                    result.set(key, value.value);
                }
            } else {
                result.set(key, value);
            }
        });

        return result;
    }

}
