import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableObject} from "./stackvariableobject.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";

/**
 * Builtin-конструктор для `new Error(message)`.
 *
 * Регистрируется в `ContextInterpreter.registerConst()` под именем `Error`.
 * Корректный путь — `new Error(...)`, обрабатывается через `ntNew`.
 *
 * Объект ошибки — обычный `StackVariableObject` с полями `.message`, `.name`,
 * у системных также `.line` / `.column` (заполняются в `Interpreter.wrapAsError`).
 *
 * Зеркало PHP-эталона `ErrorConstructor`.
 */
export class ErrorConstructor extends StackVariable {
    constructor() {
        super(VariableType.vtFunction, true);
    }

    get value() {
        return this;
    }

    /**
     * Создаёт объект ошибки с заданным сообщением.
     */
    build(message: string): StackVariableObject {
        const obj = new StackVariableObject(false, {});
        obj.registerProperty('message', new StackVariableString(false, message));
        obj.registerProperty('name', new StackVariableString(false, 'Error'));
        return obj;
    }

    castAs<T extends VariableType>(variableType: T): StackVariable | null {
        switch (variableType) {
            case VariableType.vtString:
                return new StackVariableString(false, 'function Error') as StackVariable;
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, true) as StackVariable;
        }
        return null;
    }

    toPrimitive(): StackVariable {
        return new StackVariableString(false, 'function Error() {}');
    }
}
