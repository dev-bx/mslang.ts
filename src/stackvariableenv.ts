import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableUndefined} from "./stackvariableundefined.js";
import type {ContextInterpreter} from "./contextinterpreter.js";

/**
 * Глобал `Env` — доступ скрипта к конфигу контекста (read-only). Хост кладёт
 * значения через ContextInterpreter.setConfig*, скрипт читает их как `Env.key`.
 * Неизвестный ключ → undefined. Зеркало PHP StackVariableEnv.
 */
export class StackVariableEnv extends StackVariable {
    constructor(context: ContextInterpreter | null = null) {
        super(VariableType.vtObject, true, context);
    }

    getProperty(name: string): StackVariable | undefined {
        const config = this.getContext()?.getAllConfig() ?? {};
        if (!(name in config)) {
            return undefined;
        }

        return this.wrapConfigValue(config[name]);
    }

    private wrapConfigValue(value: unknown): StackVariable {
        if (typeof value === 'boolean') {
            return new StackVariableBoolean(false, value);
        }
        if (typeof value === 'number') {
            return new StackVariableNumber(false, value);
        }
        if (typeof value === 'string') {
            return new StackVariableString(false, value);
        }

        return new StackVariableUndefined(false);
    }
}
