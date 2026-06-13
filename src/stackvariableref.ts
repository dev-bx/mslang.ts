import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableUndefined} from "./stackvariableundefined.js";
import type {ContextInterpreter} from "./contextinterpreter.js";

export class StackVariableRef extends StackVariable {

    private _refProxy: RefProxyCallback;
    constructor(refProxy: RefProxyCallback, context: ContextInterpreter | null = null) {
        super(VariableType.vtUndefined, true, context);

        this._refProxy = refProxy;
    }

    getRefValue() {
        // Зеркало PHP: если переменная по ссылке исчезла (null/undefined из-за
        // вышедшего scope), отдаём настоящий StackVariableUndefined, а не null —
        // иначе дальше падает "Reflect.get called on non-object".
        const value = this._refProxy.get();
        if (value === null || value === undefined) {
            return new StackVariableUndefined(false);
        }
        return value;
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

    toPrimitive(): StackVariable {
        return (this.getRefValue() as StackVariable).toPrimitive();
    }

    // Зеркало PHP funcInvokeToString — делегирует во внутренний объект.
    funcInvokeToString() {
        return (this.getRefValue() as StackVariable).funcInvokeToString();
    }

    getProxy() {
        // O-1: единый общий обработчик (ниже) вместо свежего объекта с 6
        // замыканиями на каждое чтение переменной. target Proxy === сам Ref,
        // поэтому трапы берут Ref из target, а не из захваченного this — это
        // позволяет вынести обработчик в модульную константу.
        return new Proxy(this, REF_PROXY_HANDLER);
    }

}

// Один экземпляр обработчика на все Ref-прокси: getProxy больше не аллоцирует
// замыкания. Трапы используют target (это и есть StackVariableRef).
const REF_PROXY_HANDLER: ProxyHandler<StackVariableRef> = {
    get(target, prop) {
        if (prop === 'refValue')
            return target.getRefValue();

        const ref = target.getRefValue();
        return Reflect.get(ref, prop, ref);
    },
    set(target, prop, val) {
        if (prop === 'refValue') {
            target.setRefValue(val);
            return true;
        }

        const ref = target.getRefValue();
        return Reflect.set(ref, prop, val, ref);
    },
    deleteProperty(target, prop) {
        return Reflect.deleteProperty(target.getRefValue() as object, prop);
    },
    ownKeys(target) {
        let v: object | null = target.getRefValue();
        const keys: (string | symbol)[] = [];

        while (v) {
            keys.push(...Reflect.ownKeys(v));
            v = Object.getPrototypeOf(v);
        }

        return [...new Set(keys)];
    },
    has(target, prop) {
        return prop in (target.getRefValue() as object);
    },
    apply(target, thisArg, args) {
        const ref = target.getRefValue();
        return (ref as unknown as (...a: unknown[]) => unknown).apply(ref, args as unknown[]);
    },
};