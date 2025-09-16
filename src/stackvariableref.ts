import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";

export class StackVariableRef extends StackVariable {

    private _refProxy: RefProxyCallback;
    constructor(refProxy: RefProxyCallback) {
        super(VariableType.vtUndefined, true);

        this._refProxy = refProxy;
    }

    getRefValue() {
        return this._refProxy.get();
    }

    setRefValue(value: object) {
        return this._refProxy.set(value);
    }

    get refValue()
    {
        return this.getRefValue();
    }

    set refValue(value)
    {
        this.setRefValue(value);
    }

    getProxy() {
        return new Proxy(
            this,
            {
                get: (target, prop, receiver) => {

                    if (prop === 'refValue')
                        return this.getRefValue();

                    const ref = this.getRefValue();

                    return Reflect.get(ref, prop, ref);
                },
                set: (target, prop, val, receiver) => {
                    if (prop === 'refValue')
                    {
                        this.setRefValue(val);
                        return true;
                    }

                    const ref = this.getRefValue();
                    return Reflect.set(ref, prop, val, ref);
                },
                deleteProperty: (target, prop) => {
                    return Reflect.deleteProperty(this.getRefValue(), prop);
                },
                ownKeys: (target) => {
                    let v = this.getRefValue();

                    let keys = [];

                    while (v)
                    {
                        keys.push(...Reflect.ownKeys(v));
                        v = Object.getPrototypeOf(v);
                    }

                    keys = [...new Set(keys)];

                    return keys;
                    //return Reflect.ownKeys(this.getRefValue());
                },
                has: (target, prop) => {
                    return prop in this.getRefValue();
                },
                apply: (target, thisArg, args) => {
                    const ref = this.getRefValue();
                    (ref as Function).apply(ref, args);
                }
            }
        );
    }

}