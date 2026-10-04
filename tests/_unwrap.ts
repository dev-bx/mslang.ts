/*
 * Общее превращение StackVariable* в простое JS-значение для сравнения результатов
 * (кросс-сценарии и фаззер). Зеркало unwrap() в php/tests/fuzz.php и
 * php/tests/CrossRuntimeTest.php: отсутствие (null/undefined/void) → null,
 * NaN/±Infinity → строки (JSON их не держит), -0 → 0, объект → "<object>",
 * ссылки разворачиваются,
 * массивы — рекурсивно.
 */
import {StackVariable, StackVariableArray, VariableType} from '../src';

export function unwrap(v: unknown): unknown {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && 'refValue' in (v as object)) {
        v = (v as {refValue: unknown}).refValue;
    }
    if (v instanceof StackVariableArray) {
        const r: unknown[] = [];
        v.value.forEach(inner => r.push(unwrap(inner)));
        return r;
    }
    if (v instanceof StackVariable) {
        const type = v.type;
        if (type === VariableType.vtNull || type === VariableType.vtUndefined || type === VariableType.vtVoid) {
            return null;
        }
        //Внутренности объекта у движков разные — сравниваем только факт «объект».
        if (type === VariableType.vtObject) return '<object>';
        const val = v.value;
        if (typeof val === 'number') {
            if (Number.isNaN(val)) return 'NaN';
            if (!Number.isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
            if (Object.is(val, -0)) return 0;
        }
        return val;
    }
    return v;
}
