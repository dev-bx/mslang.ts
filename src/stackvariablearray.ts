import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableString} from "./stackvariablestring.js";
import {FunctionParameter} from "./functionparameter.js";
import {StackVariableObject} from "./stackvariableobject.js";
import {StackVariableUndefined} from "./stackvariableundefined.js";

export class StackVariableArray extends StackVariable {

    private _nextNumKey: number = 0;
    constructor(isConst: boolean = false, value: unknown) {
        super(VariableType.vtArray, isConst);

        this._nextNumKey = 0;
        this.value = value;
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
                v = new StackVariableArray(false, v);
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
                        throw Error('Incompatible array value ' + typeof v);
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

        let msValue = new Map();

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
        return this.value.get(name.toString());
    }

    setProperty(name: string, value: StackVariable) {
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

    funcInvoke_contains(searchValue: unknown) {
        let result = false;

        searchValue = (searchValue as string).toString();

        Array.from(this.value.values()).every(value => {
            if (value.type === VariableType.vtString) {
                if (value.value === searchValue) {
                    result = true;
                    return false;
                }
            } else {
                let castString = value.castAs(VariableType.vtString);

                if (castString && castString.value === searchValue) {
                    result = true;
                    return false;
                }
            }

            return true;
        });

        return result;
    }

    /** IndexOf */

    funcInvoke_indexOfReturn = () => VariableType.vtInteger;

    funcInvoke_indexOfArgs() {
        return [
            new FunctionParameter('searchValue', undefined, true),
        ];
    }

    funcInvoke_indexOf(searchValue: unknown) {
        let result: unknown = -1;

        searchValue = (searchValue as string).toString();

        Array.from(this.value.values()).every((value, index) => {
            if (value.type === VariableType.vtString) {
                if (value.value === searchValue) {
                    result = Array.from(this.value.keys())[index];
                    return false;
                }
            } else {
                let castString = value.castAs(VariableType.vtString);

                if (castString && castString.value === searchValue) {
                    result = Array.from(this.value.keys())[index];
                    return false;
                }
            }

            return true;
        });

        return result;
    }

    /** push */

    funcInvoke_pushReturn = () => VariableType.vtNumber;

    funcInvoke_push(...args: unknown[]) {
        Object.values(args).forEach(value => {
            if (!(value instanceof StackVariable)) {
                throw new Error('value must be instance of StackVariable');
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
            let lastKey = Array.from(this.value.keys()).pop() as string;

            if (lastKey.match(/^\d+$/) && this._nextNumKey - 1 === Number(lastKey)) {
                this._nextNumKey = Number(lastKey);
            }

            let value = this.value.get(lastKey);

            if (!this.value.delete(lastKey))
                throw new Error('Failed delete key in StackVariableArray');

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
        let result = new StackVariableArray(false, this._value);

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
        return new StackVariableArray(false, Array.from(this.value.keys()));
    }

    /** values */

    funcInvoke_valuesReturn = () => VariableType.vtArray;

    funcInvoke_values() {
        return new StackVariableArray(false, Array.from(this.value.values()));
    }

    /** reverse */

    funcInvoke_reverseReturn = () => VariableType.vtArray;

    funcInvoke_reverse() {
        return new StackVariableArray(false, Array.from(this.value.values()).reverse());
    }

    /** flip */

    funcInvoke_flipReturn = () => VariableType.vtArray;

    funcInvoke_flip() {
        let result = new StackVariableArray(false, []);

        Array.from(this.value.keys()).forEach(k => {
            let value = this.value.get(k)?.castAs(VariableType.vtString);
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

        let oldValue = this.value;

        let key = Array.from(oldValue.keys()).shift() as string;
        let value = oldValue.get(key);
        if (!oldValue.delete(key))
            throw new Error('Failed delete key in StackVariableArray');

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
        let oldValue = this.value;

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

    castAs(variableType: VariableType): StackVariable|null {
        switch (variableType) {
            case VariableType.vtArray:
                return this;
            case VariableType.vtString:
                return new StackVariableString(false, this.funcInvoke_join(','));
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, this.value.size !== 0);
            case VariableType.vtNumber:
                return new StackVariableNumber(false, this.value.size > 0 ? 1 : 0);
        }

        return null;
    }

    convertToNativeArray() {
        let result: unknown[] = [];

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
        let result = new Map();

        Array.from(this.value.keys()).forEach(key => {
            let value = this.value.get(key);

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

    convertToNativeObject()
    {
        let result: Record<string, unknown> = {};

        Array.from(this.value.keys()).forEach(key => {
            let value = this.value.get(key);

            if (value instanceof StackVariable) {
                if (value instanceof StackVariableArray) {
                    result[key] = value.convertToNativeObject();
                } else {
                    result[key] = value.value;
                }

            } else {
                result[key] = value;
            }
        });

        return result;
    }
}
