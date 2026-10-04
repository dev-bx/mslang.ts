import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNull} from "./stackvariablenull";
import type {ContextInterpreter} from "./contextinterpreter.js";

/**
 * Ссылка на ячейку переменной (зеркало PHP StackVariableRef): чтение и запись идут во
 * внутренний объект через явные методы-делегаты. Proxy больше нет — методы конкретного
 * типа (массива, строки…) вызываются на развёрнутом значении (см. selfCallFunction).
 */
export class StackVariableRef extends StackVariable {

    private _refProxy: RefProxyCallback;
    constructor(refProxy: RefProxyCallback, context: ContextInterpreter | null = null) {
        super(VariableType.vtUndefined, true, context);

        this._refProxy = refProxy;
    }

    getRefValue(): StackVariable {
        // Зеркало PHP: если переменная по ссылке исчезла (вышел её scope), отдаём
        // значение null, а не голый JS null.
        const value = this._refProxy.get();
        if (value === null || value === undefined) {
            return new StackVariableNull(false);
        }
        return value as StackVariable;
    }

    setRefValue(value: object) {
        return this._refProxy.set(value);
    }

    get refValue(): StackVariable {
        return this.getRefValue();
    }

    set refValue(value: object) {
        this.setRefValue(value);
    }

    get isNumeric() { return this.getRefValue().isNumeric; }
    get type() { return this.getRefValue().type; }
    get typeName() { return this.getRefValue().typeName; }
    get value() { return this.getRefValue().value; }
    set value(value: unknown) { this.getRefValue().value = value; }
    get isConst() { return this.getRefValue().isConst; }
    get functions() { return this.getRefValue().functions; }

    getProperty(name: string) { return this.getRefValue().getProperty(name); }
    setProperty(name: string, value: StackVariable) { this.getRefValue().setProperty(name, value); }
    getFunctionEntry(name: string) { return this.getRefValue().getFunctionEntry(name); }
    castAs<T extends VariableType>(variableType: T) { return this.getRefValue().castAs(variableType); }
    offsetSet(offset: string | number, value: StackVariable) { this.getRefValue().offsetSet(offset, value); }
    toPrimitive(): StackVariable { return this.getRefValue().toPrimitive(); }
    funcInvokeToString() { return this.getRefValue().funcInvokeToString(); }
}
