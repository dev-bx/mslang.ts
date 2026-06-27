/*
 * Зеркало PHP-семантики, на которой опирается базовое сравнение и приведение.
 *
 * MSLang в PHP-версии использует нативный PHP `==`, а его правила для
 * null/bool/NaN отличаются от JS `==`. Чтобы один и тот же скрипт работал
 * одинаково в обоих интерпретаторах, TS должен явно повторить PHP-правила.
 *
 * Эталон — PHP 8.x (PHP 8 изменил loose equality "0" == false и подобное).
 */

/**
 * Бросает значение в bool по PHP-правилам. Главные отличия от Boolean(v) в JS:
 *  - NaN → true (PHP так делает, с warning'ом, но возвращает true);
 *  - пустой Map/массив → false; непустой → true;
 *  - строка "0" → false; пустая строка → false; всё остальное → true.
 *
 * ВНИМАНИЕ: это приведение ТОЛЬКО для loose equality `==` (`x == true`, `0 == ""`).
 * Это НЕ истинность языка в условиях. Истинность в `if`/`while`/`?:`/`!x`/`&&`/`||`
 * и колбэках `filter`/`find` считает `Interpreter.isTruthy` ПО JS (там NaN — ложь,
 * пустой массив — истина). Не подменяй одно другим: значения тут специально расходятся.
 */
export function phpToBool(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') {
        // PHP: any non-zero number is true. NaN считается truthy (см. PHP behavior).
        if (Number.isNaN(v)) return true;
        return v !== 0;
    }
    if (typeof v === 'string') return v !== '' && v !== '0';
    if (v instanceof Map) return v.size > 0;
    if (Array.isArray(v)) return v.length > 0;
    // объекты (включая StackVariableDateTime/Math) — truthy
    return true;
}

/**
 * Пытается разобрать строку как число по PHP-правилам:
 *   "" → 0,
 *   "  123 " → 123,
 *   "1.5" / "-1.5e2" → числа,
 *   "abc" → null (не числовая строка).
 *
 * Используется в loose-equal: число vs строка, если строка не числовая, PHP 8
 * сравнивает их как строки.
 */
export function phpParseNumericString(s: string): number | null {
    const t = s.trim();
    // PHP 8: пустая строка НЕ числовая (была числовой в PHP 7) — для loose equality
    // это значит, что число vs "" сравнивается как строки.
    if (t === '') return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
    return null;
}

/**
 * Зеркало PHP loose equality (`==`) для значений MSLang-уровня:
 * примитивы (number, string, boolean, null) и Map (массивы).
 */
export function phpLooseEqual(a: unknown, b: unknown): boolean {
    const aN = a === null || a === undefined;
    const bN = b === null || b === undefined;

    if (aN && bN) return true;
    // PHP 8: null/undefined против строки сравнивается КАК СТРОКИ (null → ""),
    // поэтому null == "" истина, но null == "0" ложь (а !toBool("0") дал бы истину).
    // Для bool/числа/массива null ведёт себя как «ложь равна ложному» — там оставляем !toBool.
    if (aN) return typeof b === 'string' ? b === '' : !phpToBool(b);
    if (bN) return typeof a === 'string' ? a === '' : !phpToBool(a);

    // Любая сторона — bool: кастуем оба в bool и сравниваем.
    if (typeof a === 'boolean' || typeof b === 'boolean') {
        return phpToBool(a) === phpToBool(b);
    }

    // Оба числа: NaN не равен ничему (включая себе).
    if (typeof a === 'number' && typeof b === 'number') {
        if (Number.isNaN(a) || Number.isNaN(b)) return false;
        return a === b;
    }

    // Число vs строка: PHP 8 — если строка числовая, сравниваем как числа;
    // иначе сравниваем как строки.
    if (typeof a === 'number' && typeof b === 'string') {
        const n = phpParseNumericString(b);
        if (n === null) return String(a) === b;
        if (Number.isNaN(a) || Number.isNaN(n)) return false;
        return a === n;
    }
    if (typeof b === 'number' && typeof a === 'string') return phpLooseEqual(b, a);

    // Обе строки.
    if (typeof a === 'string' && typeof b === 'string') return a === b;

    // Map (наши массивы) — поэлементно по ключам.
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [k, v] of a) {
            if (!b.has(k)) return false;
            if (!phpLooseEqual(v, b.get(k))) return false;
        }
        return true;
    }

    // Всё остальное — строгое равенство ссылок.
    return a === b;
}
