import {StackVariableObject} from "./stackvariableobject.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import type {StackVariable} from "./stackvariable.js";
import type {ContextInterpreter} from "./contextinterpreter.js";

/**
 * Зеркало PHP StackVariablePlainObject. Простой объект «ключ → значение» в стиле
 * JS-литерала `{...}`; появляется только из `JSON.parse` (литерала `{a:1}` в языке нет).
 *
 * По типу это `vtObject` (наследует {@see StackVariableObject}) — поэтому бесплатно
 * получает семантику объекта: передачу по ссылке, доступ по свойству `obj.key` и по
 * ключу `obj["key"]` (интерпретатор для индекса объекта зовёт getProperty). От хост-объекта
 * отличается тем, что `JSON.stringify` печатает его как `{...}`, а массив — как `[...]`:
 * так пустой `{}` и пустой `[]` различимы.
 *
 * Хранилище — обычный объект (как у StackVariableObject). При печати порядок ключей
 * приводится к JS-каноничному в JsonFunctions, поэтому Map тут не нужен.
 */
export class StackVariablePlainObject extends StackVariableObject {
    constructor(isConst: boolean = false, context: ContextInterpreter | null = null) {
        super(isConst, {});

        if (context) {
            this.setContext(context);
        }
    }

    override castAs(variableType: VariableType): StackVariable | null {
        switch (variableType) {
            case VariableType.vtObject:
                return this;
            //Как JS: `String({a:1})` и `"" + {a:1}` → "[object Object]" (а не "[object]"
            //у экземпляров пользовательских классов).
            case VariableType.vtString:
                return new StackVariableString(false, '[object Object]', this.getContext());
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, true);
        }

        return null;
    }

    override toPrimitive(): StackVariable {
        return new StackVariableString(false, '[object Object]', this.getContext());
    }
}
