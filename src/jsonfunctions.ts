import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableNull} from "./stackvariablenull.js";
import {StackVariableBoolean} from "./stackvariableboolean.js";
import {StackVariableNumber} from "./stackvariablenumber.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableUndefined} from "./stackvariableundefined.js";
import {StackVariableArray} from "./stackvariablearray.js";
import {StackVariableObject} from "./stackvariableobject.js";
import {StackVariablePlainObject} from "./stackvariableplainobject.js";
import {StackVariableRef} from "./stackvariableref.js";
import {ObjectFunctions} from "./objectfunctions.js";

/**
 * Зеркало PHP JsonFunctions. Namespace-объект `JSON` с `JSON.parse` и `JSON.stringify`,
 * регистрируется в `ContextInterpreter.registerConst()` под именем `"JSON"`, как `Math`.
 *
 * `stringify` собираем строку ВРУЧНУЮ (не через нативный `JSON.stringify`): родной
 * по-своему обходит undefined и переупорядочивает ключи, а числа печатает не нашим
 * форматтером. Числа печатаем единым {@see StackVariableNumber.numberToJsString} — чтобы
 * совпадать с PHP-эталоном бит-в-бит.
 */
export class JsonFunctions extends StackVariable {
    constructor() {
        super(VariableType.vtObject, true);
    }

    /**
     * `JSON.parse(text [, default])` — разбирает строку JSON в значение языка.
     * При ошибке разбора возвращает `default` (если задан), иначе `undefined`.
     * Валидный `"null"` ошибкой не считается (JSON.parse его не бросает). Метод без
     * объявленных параметров: диспетчер отдаёт сырые StackVariable, так `default`
     * остаётся значением, а не приводится к строке.
     */
    funcInvoke_parseReturn = () => VariableType.vtObject;

    funcInvoke_parse(...args: unknown[]): StackVariable {
        const textVar = args[0];
        const def = args[1];

        let text = '';
        if (textVar instanceof StackVariable) {
            const asString = textVar.castAs(VariableType.vtString);
            text = asString ? String(asString.value) : '';
        }

        let decoded: unknown;
        try {
            decoded = JSON.parse(text);
        } catch {
            return def instanceof StackVariable ? def : new StackVariableUndefined(false);
        }

        return this.jsonToStackVariable(decoded);
    }

    /**
     * `JSON.stringify(value)` — компактная строка JSON. `undefined`/функция на верхнем
     * уровне → `undefined` (как JS), внутри — `null`/выброшенный ключ.
     */
    funcInvoke_stringifyReturn = () => VariableType.vtString;

    funcInvoke_stringify(...args: unknown[]): StackVariable {
        const valueVar = args[0];

        if (!(valueVar instanceof StackVariable)) {
            return new StackVariableUndefined(false);
        }

        const result = this.stringifyValue(valueVar);

        return result === null
            ? new StackVariableUndefined(false)
            : new StackVariableString(false, result, this.getContext());
    }

    /**
     * Разобранный JSON → дерево StackVariable. null/булево/число/строка — примитивы;
     * массив → список vtArray; объект → StackVariablePlainObject.
     */
    private jsonToStackVariable(node: unknown): StackVariable {
        if (node === null) {
            return new StackVariableNull(false);
        }

        const t = typeof node;

        if (t === 'boolean') {
            return new StackVariableBoolean(false, node as boolean);
        }
        if (t === 'number') {
            return new StackVariableNumber(false, node as number);
        }
        if (t === 'string') {
            return new StackVariableString(false, node as string, this.getContext());
        }
        if (Array.isArray(node)) {
            const items = node.map(value => this.jsonToStackVariable(value));
            return new StackVariableArray(false, items, this.getContext());
        }
        if (t === 'object') {
            const object = new StackVariablePlainObject(false, this.getContext());
            for (const key of Object.keys(node as object)) {
                object.setProperty(key, this.jsonToStackVariable((node as Record<string, unknown>)[key]));
            }
            return object;
        }

        return new StackVariableUndefined(false);
    }

    /**
     * Значение → строка JSON, либо null если значение «пропадает» (undefined/функция).
     */
    private stringifyValue(input: StackVariable): string | null {
        let value: StackVariable = input;
        if (value instanceof StackVariableRef) {
            //Ref в TS — прозрачный Proxy: .value/.type форвардятся, но getRefValue()
            //через Proxy уходит в обёрнутое значение. Разворачиваем через .refValue
            //(его Proxy обрабатывает особо) — нужно для instanceof-проверок ниже.
            value = value.refValue as StackVariable;
        }

        switch (value.type) {
            case VariableType.vtUndefined:
            case VariableType.vtVoid:
            case VariableType.vtFunction:
                return null;

            case VariableType.vtNull:
                return 'null';

            case VariableType.vtBoolean:
                return value.value ? 'true' : 'false';

            case VariableType.vtNumber: {
                const n = value.value as number;
                //NaN/Infinity не выражаются в JSON — как JS, печатаем "null".
                if (Number.isNaN(n) || !Number.isFinite(n)) {
                    return 'null';
                }
                return StackVariableNumber.numberToJsString(n);
            }

            case VariableType.vtString:
                return JsonFunctions.quoteJsonString(String(value.value));

            case VariableType.vtArray:
                return this.stringifyArray(value);

            case VariableType.vtObject: {
                //Объект со словарём свойств (литерал из JSON.parse, экземпляр класса
                //new O(), впрыснутый хост-объект через setVariable) — перечисляем его
                //свойства. Значения-функции и undefined внутри stringifyEntries отсеются
                //сами: методы и функции в JSON не попадают, как в JS. Прочие vtObject —
                //namespace-объекты (Math/JSON), DateTime, Env, хост, что считает
                //getProperty на лету, — словаря свойств не имеют, печатаем пустой объект.
                const rec = value instanceof StackVariableObject ? value.value : null;
                if (rec && typeof rec === 'object') {
                    return this.stringifyEntries(Object.keys(rec).map(k => [k, rec[k] as StackVariable]));
                }
                return '{}';
            }

            default:
                return 'null';
        }
    }

    /**
     * Массив: список (ключи ровно 0..n-1) печатаем как [...], иначе как объект {...}.
     */
    private stringifyArray(value: StackVariable): string {
        const map = value.value as Map<string, StackVariable>;
        const keys = Array.from(map.keys());

        let isList = true;
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] !== String(i)) {
                isList = false;
                break;
            }
        }

        if (isList) {
            const parts: string[] = [];
            for (const item of map.values()) {
                const part = item instanceof StackVariable ? this.stringifyValue(item) : null;
                //undefined/функция как элемент списка → "null" (как JS).
                parts.push(part ?? 'null');
            }
            return '[' + parts.join(',') + ']';
        }

        return this.stringifyEntries(Array.from(map.entries()));
    }

    /**
     * Словарь «ключ → значение» как объект JSON. Ключ-значение `undefined` выбрасывается.
     * Порядок ключей — как в JS: целые индексы по возрастанию, затем прочие по вставке.
     */
    private stringifyEntries(entries: [string, StackVariable][]): string {
        const map = new Map<string, StackVariable>(entries);
        const parts: string[] = [];

        for (const key of ObjectFunctions.orderedKeys(Array.from(map.keys()))) {
            const item = map.get(key);
            if (!(item instanceof StackVariable)) {
                continue;
            }
            const part = this.stringifyValue(item);
            if (part === null) {
                continue;
            }
            parts.push(JsonFunctions.quoteJsonString(key) + ':' + part);
        }

        return '{' + parts.join(',') + '}';
    }

    /**
     * Строка → JSON-строка в кавычках. Экранируем только кавычку, обратный слэш и
     * управляющие < 0x20 (короткие \b\f\n\r\t, прочее \u00XX). НЕ экранируем слэш и
     * НЕ экранируем не-ASCII — кириллицу и прочий UTF печатаем сырым (как JS).
     */
    private static quoteJsonString(value: string): string {
        let result = '"';

        for (let i = 0; i < value.length; i++) {
            const char = value[i];

            switch (char) {
                case '"':
                    result += '\\"';
                    break;
                case '\\':
                    result += '\\\\';
                    break;
                case '\b':
                    result += '\\b';
                    break;
                case '\f':
                    result += '\\f';
                    break;
                case '\n':
                    result += '\\n';
                    break;
                case '\r':
                    result += '\\r';
                    break;
                case '\t':
                    result += '\\t';
                    break;
                default: {
                    const code = value.charCodeAt(i);
                    if (code < 0x20) {
                        result += '\\u' + code.toString(16).padStart(4, '0');
                    } else {
                        result += char;
                    }
                }
            }
        }

        return result + '"';
    }
}
