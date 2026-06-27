import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {StackVariableString} from "./stackvariablestring.js";
import {StackVariableArray} from "./stackvariablearray.js";
import {StackVariableRef} from "./stackvariableref.js";
import {StackVariableUndefined} from "./stackvariableundefined.js";
import {StackVariablePlainObject} from "./stackvariableplainobject.js";

/**
 * Зеркало PHP ObjectFunctions. Namespace-объект `Object`: `Object.keys(x)`,
 * `Object.values(x)`, `Object.entries(x)`. Регистрируется в `registerConst()` под
 * именем `"Object"`.
 *
 * Для plain-объекта (из `JSON.parse`) это единственный способ перебрать ключи: метод
 * прямо на объекте (`obj.keys()`) конфликтовал бы с ключом данных по имени `keys`.
 * Связка `Object.keys(o)` + `for` + `o[key]` даёт полный обход.
 *
 * Здесь же живёт единый порядок ключей объекта ({@see orderedKeys}) — его переиспользует
 * `JsonFunctions.stringify`, чтобы печать и перечисление шли одинаково (как в JS).
 */
export class ObjectFunctions extends StackVariable {
    constructor() {
        super(VariableType.vtObject, true);
    }

    funcInvoke_keysReturn = () => VariableType.vtArray;

    funcInvoke_keys(...args: unknown[]): StackVariable {
        const ctx = this.getContext();
        const keys = this.orderedEntries(args[0]).map(([key]) => new StackVariableString(false, key, ctx));
        return new StackVariableArray(false, keys, ctx);
    }

    funcInvoke_valuesReturn = () => VariableType.vtArray;

    funcInvoke_values(...args: unknown[]): StackVariable {
        const ctx = this.getContext();
        const values = this.orderedEntries(args[0]).map(([, value]) => value);
        return new StackVariableArray(false, values, ctx);
    }

    funcInvoke_entriesReturn = () => VariableType.vtArray;

    funcInvoke_entries(...args: unknown[]): StackVariable {
        const ctx = this.getContext();
        const entries = this.orderedEntries(args[0]).map(([key, value]) =>
            new StackVariableArray(false, [new StackVariableString(false, key, ctx), value], ctx));
        return new StackVariableArray(false, entries, ctx);
    }

    /**
     * `Object.get(target, path [, default])` — безопасный доступ по пути с точками
     * (`"user.address.city"`, индексы массива тоже). Шаг отсутствует/упёрся в скаляр →
     * default (или undefined). null — допустимое значение.
     */
    funcInvoke_getReturn = () => VariableType.vtObject;

    funcInvoke_get(...args: unknown[]): StackVariable {
        const target = args[0];
        const pathVar = args[1];
        const def = args[2];

        const defaultValue = def instanceof StackVariable ? def : new StackVariableUndefined(false);

        if (!(target instanceof StackVariable) || !(pathVar instanceof StackVariable)) {
            return defaultValue;
        }

        const resolved = this.resolvePath(target, ObjectFunctions.pathToString(pathVar));

        return resolved.type === VariableType.vtUndefined ? defaultValue : resolved;
    }

    /** `Object.has(target, path)` — есть ли значение по пути (не undefined). */
    funcInvoke_hasReturn = () => VariableType.vtBoolean;

    funcInvoke_has(...args: unknown[]): boolean {
        const target = args[0];
        const pathVar = args[1];

        if (!(target instanceof StackVariable) || !(pathVar instanceof StackVariable)) {
            return false;
        }

        return this.resolvePath(target, ObjectFunctions.pathToString(pathVar)).type !== VariableType.vtUndefined;
    }

    /**
     * `Object.assign(target, ...sources)` — копирует ключи источников в target (правый
     * побеждает), изменяет и возвращает target. target должен быть объектом или массивом.
     */
    funcInvoke_assignReturn = () => VariableType.vtObject;

    funcInvoke_assign(...args: unknown[]): StackVariable {
        let target = args[0];
        if (target instanceof StackVariableRef) {
            target = target.refValue;
        }
        if (!(target instanceof StackVariable)) {
            return new StackVariableUndefined(false);
        }

        if (target instanceof StackVariablePlainObject) {
            const obj = target;
            for (let i = 1; i < args.length; i++) {
                for (const [key, value] of this.orderedEntries(args[i])) {
                    obj.setProperty(key, value);
                }
            }
        } else if (target instanceof StackVariableArray) {
            const arr = target;
            for (let i = 1; i < args.length; i++) {
                for (const [key, value] of this.orderedEntries(args[i])) {
                    //Через Map напрямую (как PHP offsetSet) — мимо length-логики setProperty.
                    arr.value.set(key, value);
                }
            }
        }

        return target;
    }

    /**
     * `Object.fromEntries(pairs)` — собирает объект из массива пар `[ключ, значение]`
     * (обратное к `Object.entries`). Способ построить объект без литерала `{}`.
     */
    funcInvoke_fromEntriesReturn = () => VariableType.vtObject;

    funcInvoke_fromEntries(...args: unknown[]): StackVariable {
        const object = new StackVariablePlainObject(false, this.getContext());

        let pairs = args[0];
        if (pairs instanceof StackVariableRef) {
            pairs = pairs.refValue;
        }

        if (pairs instanceof StackVariable && pairs.type === VariableType.vtArray) {
            for (const pair of (pairs.value as Map<string, StackVariable>).values()) {
                let p: unknown = pair;
                if (p instanceof StackVariableRef) {
                    p = p.refValue;
                }
                if (p instanceof StackVariableArray) {
                    const keyVar = p.value.get('0');
                    const valueVar = p.value.get('1') ?? new StackVariableUndefined(false);
                    object.setProperty(keyVar ? ObjectFunctions.pathToString(keyVar) : '', valueVar);
                }
            }
        }

        return object;
    }

    /** `Object.removeKey(obj, key)` — НОВЫЙ объект без ключа `key`. Вход не меняется. */
    funcInvoke_removeKeyReturn = () => VariableType.vtObject;

    funcInvoke_removeKey(...args: unknown[]): StackVariable {
        const object = new StackVariablePlainObject(false, this.getContext());
        const drop = args[1] instanceof StackVariable ? ObjectFunctions.pathToString(args[1]) : '';
        for (const [key, value] of this.orderedEntries(args[0])) {
            if (key !== drop) {
                object.setProperty(key, value);
            }
        }
        return object;
    }

    /**
     * `Object.pick(obj, keys)` — НОВЫЙ объект только с перечисленными ключами (`keys` —
     * массив), в JS-каноничном порядке исходного объекта. Отсутствующие ключи пропускаются.
     */
    funcInvoke_pickReturn = () => VariableType.vtObject;

    funcInvoke_pick(...args: unknown[]): StackVariable {
        const object = new StackVariablePlainObject(false, this.getContext());
        const wanted = this.keysSet(args[1]);
        for (const [key, value] of this.orderedEntries(args[0])) {
            if (wanted.has(key)) {
                object.setProperty(key, value);
            }
        }
        return object;
    }

    /** `Object.omit(obj, keys)` — НОВЫЙ объект без перечисленных ключей (`keys` — массив). */
    funcInvoke_omitReturn = () => VariableType.vtObject;

    funcInvoke_omit(...args: unknown[]): StackVariable {
        const object = new StackVariablePlainObject(false, this.getContext());
        const drop = this.keysSet(args[1]);
        for (const [key, value] of this.orderedEntries(args[0])) {
            if (!drop.has(key)) {
                object.setProperty(key, value);
            }
        }
        return object;
    }

    /**
     * `Object.merge(...objects)` — глубокое слияние в НОВЫЙ объект (правый побеждает).
     * Вложенные объекты сливаются рекурсивно; массивы и скаляры — заменяются (как `assign`).
     * Входы не меняются.
     */
    funcInvoke_mergeReturn = () => VariableType.vtObject;

    funcInvoke_merge(...args: unknown[]): StackVariable {
        const object = new StackVariablePlainObject(false, this.getContext());
        for (const source of args) {
            this.mergeInto(object, source);
        }
        return object;
    }

    /**
     * `Object.isEmpty(x)` — «пусто ли значение»: истина для null/undefined, пустой строки,
     * пустого массива и пустого объекта. Число (включая 0), булево (включая false), функция,
     * хост-объект (дата и т.п.), непустые строка/массив/объект — НЕ пусто.
     */
    funcInvoke_isEmptyReturn = () => VariableType.vtBoolean;

    funcInvoke_isEmpty(...args: unknown[]): boolean {
        let value: unknown = args[0];
        if (value instanceof StackVariableRef) {
            value = value.refValue;
        }
        if (!(value instanceof StackVariable)) {
            return true;
        }

        const type = value.type;
        if (type === VariableType.vtNull || type === VariableType.vtUndefined || type === VariableType.vtVoid) {
            return true;
        }
        if (type === VariableType.vtString) {
            return value.value === '';
        }
        if (value instanceof StackVariableArray) {
            return (value.value as Map<string, StackVariable>).size === 0;
        }
        if (value instanceof StackVariablePlainObject) {
            return Object.keys(value.value as Record<string, unknown>).length === 0;
        }

        return false;
    }

    /** Набор строковых ключей из массива-аргумента (для pick/omit). */
    private keysSet(keysVar: unknown): Set<string> {
        let v: unknown = keysVar;
        if (v instanceof StackVariableRef) {
            v = v.refValue;
        }
        const set = new Set<string>();
        if (v instanceof StackVariable && v.type === VariableType.vtArray) {
            for (const item of (v.value as Map<string, StackVariable>).values()) {
                let it: unknown = item;
                if (it instanceof StackVariableRef) {
                    it = it.refValue;
                }
                if (it instanceof StackVariable) {
                    set.add(ObjectFunctions.pathToString(it));
                }
            }
        }
        return set;
    }

    /**
     * Глубокое слияние `source` в `target`: обе стороны-объекты сливаются рекурсивно,
     * иначе значение из source заменяет.
     */
    private mergeInto(target: StackVariablePlainObject, source: unknown): void {
        for (const [key, rawValue] of this.orderedEntries(source)) {
            let value: unknown = rawValue;
            if (value instanceof StackVariableRef) {
                value = value.refValue;
            }
            const existing = (target.value as Record<string, unknown>)[key];
            if (existing instanceof StackVariablePlainObject && value instanceof StackVariablePlainObject) {
                const merged = new StackVariablePlainObject(false, this.getContext());
                this.mergeInto(merged, existing);
                this.mergeInto(merged, value);
                target.setProperty(key, merged);
            } else if (value instanceof StackVariable) {
                target.setProperty(key, value);
            }
        }
    }

    private static pathToString(value: StackVariable): string {
        const asString = value.castAs(VariableType.vtString);
        return asString ? String(asString.value) : '';
    }

    /**
     * Идёт по пути из ключей (через точку) внутрь объекта/массива. Возвращает значение
     * или undefined, если шаг отсутствует или упёрся в скаляр. Массив читаем напрямую
     * из Map (как PHP offsetGet), мимо length-логики getProperty.
     */
    private resolvePath(target: StackVariable, path: string): StackVariable {
        let current: StackVariable = target instanceof StackVariableRef ? target.refValue as StackVariable : target;

        for (const part of path.split('.')) {
            if (current instanceof StackVariableArray) {
                const next = current.value.get(part);
                current = next instanceof StackVariable ? next : new StackVariableUndefined(false);
            } else if (current.type === VariableType.vtObject) {
                const next = current.getProperty(part);
                current = next instanceof StackVariable ? next : new StackVariableUndefined(false);
            } else {
                return new StackVariableUndefined(false);
            }
            if (current instanceof StackVariableRef) {
                current = current.refValue as StackVariable;
            }
        }

        return current;
    }

    /**
     * Пары «строковый ключ → значение» объекта/массива в JS-порядке ключей.
     * Примитив → пусто: перечислимых ключей нет.
     */
    private orderedEntries(input: unknown): [string, StackVariable][] {
        let value: unknown = input;
        if (value instanceof StackVariableRef) {
            value = value.refValue;
        }
        if (!(value instanceof StackVariable)) {
            return [];
        }
        //Строка перечислима по символам (как JS): ключи "0".."n-1", значения — символы.
        //Идём по код-поинтам (Array.from), как charAt/SubString.
        if (value.type === VariableType.vtString) {
            const ctx = this.getContext();
            return Array.from(value.value as string).map((char, index) =>
                [String(index), new StackVariableString(false, char, ctx)] as [string, StackVariable]);
        }

        if (value.type !== VariableType.vtArray && value.type !== VariableType.vtObject) {
            return [];
        }

        let pairs: [string, StackVariable][];
        if (value instanceof StackVariableArray) {
            pairs = Array.from((value.value as Map<string, StackVariable>).entries());
        } else {
            //plain-объект и хост-объект хранят значения в обычном объекте (Record).
            const record = value.value as Record<string, unknown>;
            pairs = Object.keys(record).map(key => [key, record[key] as StackVariable]);
        }

        const map = new Map<string, StackVariable>(pairs);
        const result: [string, StackVariable][] = [];
        for (const key of ObjectFunctions.orderedKeys(Array.from(map.keys()))) {
            const item = map.get(key);
            if (item instanceof StackVariable) {
                result.push([key, item]);
            }
        }
        return result;
    }

    /**
     * Ключ — «индекс массива» в смысле JS: каноничная запись целого 0..2^32-2.
     */
    static isArrayIndexKey(key: string): boolean {
        if (key === '0') {
            return true;
        }
        return /^[1-9][0-9]*$/.test(key) && Number(key) < 4294967295;
    }

    /**
     * Порядок ключей объекта как в JS: целые индексы по возрастанию, затем прочие в
     * порядке вставки. Единая точка для Object.keys/values/entries и JSON.stringify.
     */
    static orderedKeys(keys: string[]): string[] {
        const indices: string[] = [];
        const others: string[] = [];

        for (const key of keys) {
            if (ObjectFunctions.isArrayIndexKey(key)) {
                indices.push(key);
            } else {
                others.push(key);
            }
        }

        indices.sort((a, b) => Number(a) - Number(b));

        return [...indices, ...others];
    }
}
