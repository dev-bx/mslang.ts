/*
 * Тесты-ловушки на найденные ошибки реализации MSLang.
 *
 * Каждый тест проверяет ПРАВИЛЬНОЕ поведение. Пока баг не исправлен — тест падает
 * и показывает ошибку. После починки тест станет зелёным.
 *
 * Файл tests/tests.ts трогать нельзя: он стережёт обратную совместимость.
 * Этот файл — отдельный, для подтверждения багов и их будущих исправлений.
 *
 * Запуск: npx tsx tests/bugs.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    VariableType, StackVariableBoolean, CodeLexer, CodeParser,
    LexerTypeArray, Interpreter, ContextInterpreter, LexerType, StackVariableArray,
    ParseNode, StackVariableUndefined, FunctionEntry, ContextException,
    ParserCursorException, ParserNodeException,
} from "../src";
import {FunctionParameter} from "../src/functionparameter";

function createCodeContext(text: string) {
    const lexer = new CodeLexer(text);
    const parser = new CodeParser(lexer);

    const nodeList: ParseNode[] = [];

    parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

    const interpreter = new Interpreter();
    interpreter.registerHandlers();

    const context = new ContextInterpreter(nodeList, interpreter);
    context.registerConst();

    return context;
}

function executeReturnCode(text: string) {
    return createCodeContext(text).exec(true);
}

// --- КРИТИЧНЫЕ ---

// Баг 1: нет обработчика ntWhile — любой while падает при выполнении.
test('Bug01_While', () => {
    const returnVal = executeReturnCode('x = 0; while (x < 3) { x++; } return x;');
    assert.strictEqual(3, returnVal?.value);
});

// Баг 2: нет обработчика ntMod — оператор % парсится, но не исполняется.
test('Bug02_Modulo', () => {
    const returnVal = executeReturnCode('return 10 % 3;');
    assert.strictEqual(1, returnVal?.value);
});

// Баг 3: нет обработчика ntBitAnd — оператор & парсится, но не исполняется.
test('Bug03_BitwiseAnd', () => {
    const returnVal = executeReturnCode('return 6 & 2;');
    assert.strictEqual(2, returnVal?.value);
});

// Баг 4: приведение булева к числу перевёрнуто (stackvariableboolean.ts:32).
// true должно давать 1, false — 0.
test('Bug04_BooleanToNumber', () => {
    const bTrue = new StackVariableBoolean(true, true);
    assert.strictEqual(1, bTrue.castAs(VariableType.vtNumber)?.value);

    const bFalse = new StackVariableBoolean(true, false);
    assert.strictEqual(0, bFalse.castAs(VariableType.vtNumber)?.value);
});

// Баг 5: splice портит дерево разбора (interpreter.ts:1321).
// Массив с парами «ключ => значение» внутри цикла на второй итерации
// собирается неверно, потому что splice вырезал дочерние узлы из дерева.
//
// Возврат идёт через переменную, поэтому returnVal — это прокси-обёртка
// StackVariableRef, и обычный instanceof StackVariableArray не сработает.
// Проверяем по имени класса (прокси прозрачно отдаёт constructor) и по
// прокидываемому свойству .value.
test('Bug05_ArrayKeyValueInLoop', () => {
    const returnVal = executeReturnCode(`
        a = 0;
        for (i = 0; i < 2; i++)
        {
            a = ['x' => 10, 'y' => 20];
        }
        return a;
    `) as unknown as { constructor: { name: string }, value: Map<string, { value: unknown }> };

    assert.strictEqual('StackVariableArray', returnVal?.constructor?.name);
    assert.strictEqual(2, returnVal?.value?.size);
    assert.strictEqual(10, returnVal?.value?.get('x')?.value);
    assert.strictEqual(20, returnVal?.value?.get('y')?.value);
});

// Баг 6: в VariableType значения 3 и 5 при пропущенном 4 — дыра в наборе значений.
test('Bug06_VariableTypeNoGap', () => {
    const nums = Object.values(VariableType).filter(v => typeof v === 'number') as number[];
    const uniq = [...new Set(nums)].sort((a, b) => a - b);

    for (let i = 1; i < uniq.length; i++) {
        assert.strictEqual(uniq[i], uniq[i - 1] + 1, 'в значениях VariableType есть пропуск');
    }
});

// --- СРЕДНИЕ ---

// Баг 7: комментарий // в конце файла без перевода строки ломает разбор.
test('Bug07_CommentAtEof', () => {
    const returnVal = executeReturnCode('return 1;// комментарий в конце');
    assert.strictEqual(1, returnVal?.value);
});

// Баг 8: число с точкой после узла логики/как значение ключа массива
// не разбирается (parser.ts:304), хотя то же самое с целым числом проходит.
// Здесь [0 => 1] разбирается, а [0 => 1.5] падает с «Parse expression failed».
test('Bug08_FloatAsArrayValue', () => {
    const returnVal = executeReturnCode('return [0 => 1.5];');
    assert.strictEqual(true, returnVal instanceof StackVariableArray);
    if (returnVal instanceof StackVariableArray) {
        assert.strictEqual(1.5, returnVal.value.get('0')?.value);
    }
});

// Баг 9: getRequiredCount обрывается на первом необязательном параметре
// и не считает обязательные параметры после него (functionentry.ts:56).
test('Bug09_GetRequiredCount', () => {
    const fe = new FunctionEntry('t', VariableType.vtVoid, () => {});
    fe.addParameter(new FunctionParameter('a', VariableType.vtNumber, true));
    fe.addParameter(new FunctionParameter('b', VariableType.vtNumber, false));
    fe.addParameter(new FunctionParameter('c', VariableType.vtNumber, true));

    assert.strictEqual(2, fe.getRequiredCount());
});

// Баг 10: у StackVariableUndefined нет castAs — приведение undefined к строке
// должно давать "undefined", а не падать/возвращать null.
test('Bug10_UndefinedCastAs', () => {
    const u = new StackVariableUndefined(true);
    const asString = u.castAs(VariableType.vtString);
    assert.strictEqual('undefined', asString?.value);
});

// Баг 11: свойства даты считают секунды как миллисекунды (stackvariabledatetime.ts).
// DateTime.Now.Year должен давать текущий год, а не 1970.
test('Bug11_DateTimeYear', () => {
    const expectedYear = new Date().getFullYear();
    const returnVal = executeReturnCode('return DateTime.Now.Year;');
    assert.strictEqual(expectedYear, returnVal?.value);
});

// --- РАБОЧИЕ ПРОВЕРКИ РЯДОМ С БАГАМИ ---
//
// Эти тесты СЕЙЧАС ПРОХОДЯТ. Они проверяют близкое поведение, которое в отчёте
// тоже было под подозрением, но на деле работает. Держим их, чтобы:
//   1. отметить границу бага — что именно ломается, а что нет;
//   2. поймать поломку, если будущая правка заденет рабочий случай.

// Рядом с багом 8: дробь как ПРАВЫЙ операнд сравнения разбирается нормально
// (ломается только дробь после && и как значение ключа массива — см. BUG-08).
test('Ok01_FloatAfterCompare', () => {
    const returnVal = executeReturnCode('return 1 < 2.5;');
    assert.strictEqual(true, returnVal?.value);
});

// Рядом с багом про управление потоком: break во вложенных циклах
// прерывает только внутренний цикл, внешний продолжается — работает верно.
test('Ok02_NestedBreak', () => {
    const returnVal = executeReturnCode(`
        outer = 0;
        for (i = 0; i < 3; i++)
        {
            for (j = 0; j < 5; j++)
            {
                if (j == 2)
                    break;
            }
            outer++;
        }
        return outer;
    `);
    assert.strictEqual(3, returnVal?.value);
});

// Класс: внутренний return из конструктора игнорируется — `new` всегда
// возвращает свежий instance, даже если автор написал `return 0;`. Это
// зеркало JS-семантики; в этапе 1 мы возвращаем instance безусловно.
test('Bug12_CtorReturnPrimitiveIgnored', () => {
    const returnVal = executeReturnCode(`
        class C {
            constructor() {
                this.x = 42;
                return 0;
            }
        }
        return new C().x;
    `);
    assert.strictEqual(42, returnVal?.value);
});

// Класс: this в обычной функции, не вызванной как метод, — это ошибка
// выполнения (а не undefined).
test('Bug13_ThisInPlainFunctionFails', () => {
    assert.throws(() => {
        executeReturnCode(`
            function f() {
                return this.x;
            }
            return f();
        `);
    }, /'this' is not available/);
});

// Класс: метод может рекурсивно вызвать this.method() — каждый кадр
// видит свой this. Используем this.n / this.acc как состояние, а не
// локальные переменные. Скобки `{ ... }` после if — обязательны: без них
// ловится отдельный baseline-баг (статусы после `if (...) stmt;` теряются;
// воспроизводится и на обычных user functions, лечится в их задаче).
test('Bug14_ClassMethodRecursionThroughThis', () => {
    const returnVal = executeReturnCode(`
        class C {
            constructor(n) { this.n = n; this.acc = 0; }
            run() {
                if (this.n <= 0) {
                    return this.acc;
                }
                this.acc = this.acc + this.n;
                this.n = this.n - 1;
                return this.run();
            }
        }
        return new C(4).run();
    `);
    // 4 + 3 + 2 + 1 = 10
    assert.strictEqual(10, returnVal?.value);
});

// Баг: `if (cond) stmt;` без `{}` внутри пользовательской функции
// продолжал «жрать» следующие statement-ы как часть then-блока, и
// локальные переменные после if терялись. Исправлено через параметр
// singleStatement в parseCode для inline-формы if/else/for/while.
test('Bug15_InlineIfDoesNotEatNextStatement', () => {
    const returnVal = executeReturnCode(`
        function f(n) {
            if (n <= 0) return -2;
            a = 1;
            return a;
        }
        return f(3);
    `);
    assert.strictEqual(1, returnVal?.value);
});

// Баг 15b: каскад if-ов без {} для каждого case — типичная
// switch-подмена через несколько последовательных if. Должны
// выполниться все, и сохранить локальную, которую они меняют.
test('Bug15_InlineIfChainKeepsLocals', () => {
    const returnVal = executeReturnCode(`
        function rate(tier) {
            r = 0;
            if (tier == "silver") r = 3;
            if (tier == "gold")   r = 7;
            if (tier == "vip")    r = 12;
            return r;
        }
        return rate("gold");
    `);
    assert.strictEqual(7, returnVal?.value);
});

// Баг 18: значения объектов и параметров «утекали» из вложенных блоков.
//
// Три тесно связанных под-бага:
//
//   а) popExecutionStack не умел пробрасывать новую ссылку на объект
//      от блока к parent. Для vtObject createVariable выкидывал
//      «Unknown variable type 7», а в else-ветке (одинаковый тип)
//      vtObject стоял в skip-листе. В результате `s = s.add(part)`
//      в цикле не доходил до выхода из функции.
//
//   б) `arr.push(param)` сохранял в массив сам StackVariableRef-параметр
//      функции, а не значение под ним. После возврата из функции
//      Ref становился stale (получали undefined). То же для index-assign
//      и для array literal.
//
//   в) `t = part;` где part — let-локалка вложенного блока сохранял в
//      долгоживущую t сам Ref на part. cloneVariable для vtObject
//      возвращает сам объект без разворота — потому Ref пробрасывался
//      дальше и умирал вместе со scope блока.

test('Bug18a_ReassignObjectInsideLoop', () => {
    const r = executeReturnCode(`
        class Money {
            constructor(a) { this.a = a; }
            add(o) { return new Money(this.a + o.a); }
        }
        class C {
            constructor() { this.items = []; }
            addItem(v) { this.items.push(v); }
            sum() {
                let s = new Money(0);
                let i = 0;
                while (i < this.items.length) {
                    s = s.add(this.items[i]);
                    i = i + 1;
                }
                return s;
            }
        }
        let c = new C();
        c.addItem(new Money(10));
        c.addItem(new Money(20));
        return c.sum().a;
    `);
    assert.strictEqual(30, r?.value);
});

test('Bug18a_LetNullThenObjectAcrossLoop', () => {
    const r = executeReturnCode(`
        class M { constructor(a) { this.a = a; } pct(p) { return new M(this.a * p / 100); } }
        function f(arr) {
            let total = null;
            let j = 0;
            while (j < arr.length) {
                let line = arr[j];
                let part = line.pct(19);
                if (total == null) { total = part; } else { total = total.add(part); }
                j = j + 1;
            }
            return total;
        }
        let arr = [];
        arr.push(new M(100));
        let r = f(arr);
        if (r == null) { return "NULL"; }
        return r.a;
    `);
    assert.strictEqual(19, r?.value);
});

test('Bug18b_PushParameterToGlobalArray', () => {
    const r = executeReturnCode(`
        let arr = [];
        function add(x) { arr.push(x); }
        add(7);
        add(8);
        return arr.length + "/" + arr[0] + "/" + arr[1];
    `);
    assert.strictEqual('2/7/8', r?.value);
});

test('Bug18b_PushParameterToFieldArrayInsideMethod', () => {
    const r = executeReturnCode(`
        class A {
            constructor() { this.arr = []; }
            add(x) { this.arr.push(x); }
        }
        let a = new A();
        a.add(7);
        a.add(8);
        return a.arr[0] + "/" + a.arr[1];
    `);
    assert.strictEqual('7/8', r?.value);
});

test('Bug18b_IndexAssignParameterInMethod', () => {
    const r = executeReturnCode(`
        class A {
            constructor() { this.arr = [0, 0]; }
            setIdx(i, x) { this.arr[i] = x; }
        }
        let a = new A();
        a.setIdx(0, 7);
        a.setIdx(1, 8);
        return a.arr[0] + "/" + a.arr[1];
    `);
    assert.strictEqual('7/8', r?.value);
});

test('Bug18b_ArrayLiteralWithParameters', () => {
    const r = executeReturnCode(`
        function makeArr(x, y) { return [x, y]; }
        let a = makeArr(7, 8);
        return a.length + "/" + a[0] + "/" + a[1];
    `);
    assert.strictEqual('2/7/8', r?.value);
});

test('Bug18c_AssignFromBlockLocalLet', () => {
    const r = executeReturnCode(`
        class M { constructor(a) { this.a = a; } pct(p) { return new M(this.a * p / 100); } }
        function f(arr) {
            let t = null;
            let i = 0;
            while (i < arr.length) {
                let line = arr[i];
                let part = line.pct(19);
                t = part;
                i = i + 1;
            }
            return t;
        }
        let arr = [new M(100)];
        let r = f(arr);
        return r.a;
    `);
    assert.strictEqual(19, r?.value);
});

// Лексер: полный JS-набор числовых литералов (Bug19).
//
// До правки лексер падал на hex (0xFF), binary (0b1010), octal (0o755),
// научной нотации (1e3, 1.5e-3) и numeric separators (1_000_000).

test('Bug19_HexLiteral', () => {
    assert.strictEqual(255, executeReturnCode('return 0xFF;')?.value);
    assert.strictEqual(66,  executeReturnCode('return 0x42;')?.value);
    assert.strictEqual(3735928559, executeReturnCode('return 0XdeadBEEF;')?.value);
});

test('Bug19_BinaryLiteral', () => {
    assert.strictEqual(10,  executeReturnCode('return 0b1010;')?.value);
    assert.strictEqual(255, executeReturnCode('return 0B11111111;')?.value);
});

test('Bug19_OctalLiteral', () => {
    assert.strictEqual(493, executeReturnCode('return 0o755;')?.value);
    assert.strictEqual(511, executeReturnCode('return 0O777;')?.value);
});

test('Bug19_ScientificLiteral', () => {
    assert.strictEqual(1000,         executeReturnCode('return 1e3;')?.value);
    assert.strictEqual(0.0015,       executeReturnCode('return 1.5e-3;')?.value);
    assert.strictEqual(25000000000,  executeReturnCode('return 2.5E+10;')?.value);
});

test('Bug19_NumericSeparators', () => {
    assert.strictEqual(1000000,      executeReturnCode('return 1_000_000;')?.value);
    assert.strictEqual(65451,        executeReturnCode('return 0xFF_AB;')?.value);
    assert.strictEqual(165,          executeReturnCode('return 0b1010_0101;')?.value);
    assert.strictEqual(125500000000, executeReturnCode('return 1_2.5_5e+1_0;')?.value);
});

test('Bug19_RejectsEmptyExponent', () => {
    assert.throws(() => executeReturnCode('return 1e;'));
});

test('Bug19_RejectsEmptyHex', () => {
    assert.throws(() => executeReturnCode('return 0x;'));
});

test('Bug19_RejectsTrailingSeparator', () => {
    // '1_' — не разделитель: '_' допустим только МЕЖДУ цифрами.
    assert.throws(() => executeReturnCode('return 1_;'));
});

test('Bug19_RejectsDoubleSeparator', () => {
    assert.throws(() => executeReturnCode('return 1__2;'));
});

// Баг 20: post-processing приоритета операторов в parseExpression не цеплял
// к высокоприоритетному операнду «хвостовые» операции — [idx], .method(),
// Class::fn(). Из-за этого `a.m[0] * b.m[0]` и `a.val() * b.val()` ломались.

test('Bug20_FieldArrayIndexInMul', () => {
    const r = executeReturnCode(`
        class A { constructor(arr) { this.m = arr; } }
        function dot(a, b) {
            let s = 0;
            let k = 0;
            while (k < 4) { s = s + a.m[k] * b.m[k]; k = k + 1; }
            return s;
        }
        let a = new A([1, 2, 3, 4]);
        let b = new A([5, 6, 7, 8]);
        return dot(a, b);
    `);
    // 1*5 + 2*6 + 3*7 + 4*8 = 70
    assert.strictEqual(70, r?.value);
});

test('Bug20_MethodCallInMul', () => {
    const r = executeReturnCode(`
        class A { val() { return 5; } }
        let a = new A();
        let b = new A();
        return a.val() * b.val();
    `);
    assert.strictEqual(25, r?.value);
});

test('Bug20_BracketAndMethodMixed', () => {
    const r = executeReturnCode(`
        class A {
            constructor() { this.arr = []; this.arr.push(2); this.arr.push(3); }
            val() { return 5; }
        }
        let a = new A();
        let b = new A();
        return a.arr[0] * b.val() + a.val() * b.arr[1];
    `);
    // 2*5 + 5*3 = 25
    assert.strictEqual(25, r?.value);
});

// Баг 21: continue внутри while.
// В TS это уже работало (whileHandler ставил _codeData['continue']), но в
// PHP-эталоне не было — теперь синхронизировано. Регрессии остаются для
// зеркальности и защиты от регрессии в обе стороны.

test('Bug21_ContinueInsideWhile', () => {
    const r = executeReturnCode(`
        let s = 0;
        let i = 0;
        while (i < 10) {
            i = i + 1;
            if (i == 5) { continue; }
            s = s + i;
        }
        return s;
    `);
    // 1+2+3+4+6+7+8+9+10 = 50
    assert.strictEqual(50, r?.value);
});

test('Bug21_ContinueNestedInsideWhile', () => {
    const r = executeReturnCode(`
        let s = 0;
        let i = 0;
        while (i < 5) {
            i = i + 1;
            let j = 0;
            while (j < 3) {
                j = j + 1;
                if (j == 2) { continue; }
                s = s + 1;
            }
        }
        return s;
    `);
    // 5 итераций i * 2 успешных тика j = 10
    assert.strictEqual(10, r?.value);
});

// Баг 22: индексация массива целым double-числом.
// В TS это работало благодаря тому, что Map-ключ приводится к строке
// автоматически (JS-семантика). PHP-сторона была строже, и нужно было
// явное приведение. Регрессии для зеркальности.

test('Bug22_FloatIndexFromMathFloor', () => {
    const r = executeReturnCode(`
        let arr = [10, 20, 30, 40];
        let i = Math.floor(2.7);
        return arr[i];
    `);
    assert.strictEqual(30, r?.value);
});

test('Bug22_FloatIndexAssignWithMathFloor', () => {
    const r = executeReturnCode(`
        let arr = [0, 0, 0, 0];
        let i = Math.floor(1.8);
        arr[i] = 99;
        return arr[1];
    `);
    assert.strictEqual(99, r?.value);
});

// === Расширение языка для BMP/3D (Feat23-31) ===
//
// Девять связанных фич, добавленных одним пакетом: битовые `|`/`^`/`<<`/`>>`/`>>>`,
// compound-assign `+=`/`-=`/`*=`/`/=`/`%=`, тернарный `?:`, стандартный
// `for(init;cond;incr)`, `for-of`, `charCodeAt`/`String.fromCharCode`,
// `Math.trunc`/`Math.sign`, `Array.fill`/`Array.includes`, rest-параметры
// `function f(...args)`.

test('Feat23_BitwiseOps', () => {
    assert.strictEqual(5,   executeReturnCode('return 1 | 4;')?.value);
    assert.strictEqual(240, executeReturnCode('return 0xFF ^ 0x0F;')?.value);
    assert.strictEqual(256, executeReturnCode('return 1 << 8;')?.value);
    assert.strictEqual(4,   executeReturnCode('return 16 >> 2;')?.value);
    assert.strictEqual(4294967295, executeReturnCode('let x = -1; return x >>> 0;')?.value);
    //Упаковка 24-bit RGB как в BMP.
    assert.strictEqual(0x123456, executeReturnCode('let r = 0x12; let g = 0x34; let b = 0x56; return (r << 16) | (g << 8) | b;')?.value);
});

test('Feat24_CompoundAssign', () => {
    assert.strictEqual(8,  executeReturnCode('let a = 5;  a += 3; return a;')?.value);
    assert.strictEqual(7,  executeReturnCode('let a = 10; a -= 3; return a;')?.value);
    assert.strictEqual(20, executeReturnCode('let a = 5;  a *= 4; return a;')?.value);
    assert.strictEqual(5,  executeReturnCode('let a = 20; a /= 4; return a;')?.value);
    assert.strictEqual(2,  executeReturnCode('let a = 17; a %= 5; return a;')?.value);
    assert.strictEqual('abcd', executeReturnCode('let s = "ab"; s += "cd"; return s;')?.value);
    assert.strictEqual('x5',   executeReturnCode('let s = "x";  s += 5;    return s;')?.value);
});

test('Feat25_Ternary', () => {
    assert.strictEqual('y',  executeReturnCode('return true ? "y" : "n";')?.value);
    assert.strictEqual('n',  executeReturnCode('return false ? "y" : "n";')?.value);
    assert.strictEqual(20,   executeReturnCode('let n = 10; return n > 5 ? n * 2 : -n;')?.value);
    assert.strictEqual(3,    executeReturnCode('let x = -3; return x < 0 ? -x : x;')?.value);
    assert.strictEqual('ok', executeReturnCode('let n = 5; return n > 0 && n < 10 ? "ok" : "no";')?.value);
});

test('Feat26_ForStandardWithLet', () => {
    assert.strictEqual(10, executeReturnCode('let s = 0; for (let i = 0; i < 5; i++) { s = s + i; } return s;')?.value);
    assert.strictEqual(6,  executeReturnCode('let t = 0; for (var j = 0; j < 4; j++) { t += j; } return t;')?.value);
});

test('Feat27_ForOf', () => {
    assert.strictEqual(10, executeReturnCode('let s = 0; for (let x of [1, 2, 3, 4]) { s = s + x; } return s;')?.value);
    assert.strictEqual(60, executeReturnCode('let arr = [10, 20, 30]; let t = 0; for (let v of arr) { t += v; } return t;')?.value);
    assert.strictEqual(9,  executeReturnCode('let s = 0; for (let x of [1, 2, 3, 4, 5]) { if (x % 2 == 0) continue; s = s + x; } return s;')?.value);
    assert.strictEqual(3,  executeReturnCode('let s = 0; for (let x of [1, 2, 3, 4, 5]) { if (x == 3) break; s += x; } return s;')?.value);
    assert.strictEqual('abc', executeReturnCode('let s = ""; for (let c of ["a", "b", "c"]) { s += c; } return s;')?.value);
});

test('Feat28_StringCharCodeAt', () => {
    assert.strictEqual(65,  executeReturnCode('return "ABC".charCodeAt(0);')?.value);
    assert.strictEqual(101, executeReturnCode('return "hello".charCodeAt(1);')?.value);
    assert.strictEqual('A', executeReturnCode('return "ABC".charAt(0);')?.value);
});

test('Feat28_StringFromCharCode', () => {
    assert.strictEqual('ABC', executeReturnCode('return String.fromCharCode(65, 66, 67);')?.value);
    assert.strictEqual('hi',  executeReturnCode('return String.fromCharCode(104, 105);')?.value);
});

test('Feat29_MathTruncSign', () => {
    assert.strictEqual(2,  executeReturnCode('return Math.trunc(2.7);')?.value);
    assert.strictEqual(-2, executeReturnCode('return Math.trunc(-2.7);')?.value);
    assert.strictEqual(1,  executeReturnCode('return Math.sign(5);')?.value);
    assert.strictEqual(-1, executeReturnCode('return Math.sign(-3.5);')?.value);
    assert.strictEqual(0,  executeReturnCode('return Math.sign(0);')?.value);
});

test('Feat30_ArrayFillIncludes', () => {
    assert.strictEqual('7,7,7,7', executeReturnCode('let a = [0,0,0,0]; a.fill(7); return a.join(",");')?.value);
    assert.strictEqual('0,9,9,0', executeReturnCode('let a = [0,0,0,0]; a.fill(9, 1, 3); return a.join(",");')?.value);
    assert.strictEqual(true,  executeReturnCode('return [1, 2, 3].includes(2);')?.value);
    assert.strictEqual(false, executeReturnCode('return [1, 2, 3].includes(99);')?.value);
});

test('Feat31_RestParameters', () => {
    assert.strictEqual(15, executeReturnCode('function sum(...args) { let s = 0; for (let v of args) { s += v; } return s; } return sum(1, 2, 3, 4, 5);')?.value);
    assert.strictEqual('test:3', executeReturnCode('function info(name, ...rest) { return name + ":" + rest.length; } return info("test", 1, 2, 3);')?.value);
    assert.strictEqual(0, executeReturnCode('function f(...a) { return a.length; } return f();')?.value);
});

// Bug: funcEntryCache захватывал в closure Proxy (StackVariableRef.getProxy()),
// созданный для первого вызывающего. Если этим вызывающим была short-lived
// let-переменная внутри constructor класса, после выхода из constructor scope
// её refValue становился undefined, и следующий любой вызов того же метода —
// даже на совершенно другом объекте — крашился с
// "Reflect.get called on non-object". Фикс: в _getFunctionEntry разворачиваем
// Proxy через `this.refValue` и захватываем в closure живой объект.
test('Bug_FuncEntryCache_ProxyOnDeadScope', () => {
    // Минимальный repro: первый push в ctor через local let-array, потом push
    // на внешнем массиве. Раньше падало на втором push.
    const r = executeReturnCode(`
        class A {
            constructor() {
                let p = [];
                for (let i = 0; i < 5; i++) { p.push(0); }
                this.p = p;
            }
        }
        let a = new A();
        let outer = [];
        outer.push(1);
        outer.push(2);
        return outer.length + a.p.length;
    `);
    assert.strictEqual(7, r?.value);
});

// ─────────────────────────────────────────────────────────────────────────────
// P0: числовая модель IEEE-754/JS и сопутствующие фиксы (зеркало TestBugs.php).
// Решение от 2026-06-13: эталон — спецификация (IEEE/JS), PHP-first как багфикс.
// Подробности и матрица — в ROADMAP.md (§2, §2бис).
// ─────────────────────────────────────────────────────────────────────────────

test('P0_01_NumericStringEquality', () => {
    // Две числовые строки сравниваются как строки (JS), а не численно (PHP ==).
    assert.strictEqual(false, executeReturnCode('return "1" == "01";')?.value);
    assert.strictEqual(false, executeReturnCode('return "10" == "1e1";')?.value);
    assert.strictEqual(true,  executeReturnCode('return "abc" == "abc";')?.value);
    assert.strictEqual(true,  executeReturnCode('return "1" != "01";')?.value);
});

test('P0_02_SubStringLength', () => {
    // Второй аргумент — длина (mb_substr), а не конечный индекс (JS substring).
    assert.strictEqual('bcd',  executeReturnCode('return "abcdef".SubString(1,3);')?.value);
    assert.strictEqual('de',   executeReturnCode('return "abcdef".SubString(-3,2);')?.value);
    assert.strictEqual('cdef', executeReturnCode('return "abcdef".SubString(2);')?.value);
});

test('P0_03_DivisionByZeroIEEE', () => {
    // Деление на ноль по IEEE: ±Infinity / NaN, а не общий INF.
    assert.strictEqual(false, executeReturnCode('return (5/0).isFinite;')?.value);
    assert.strictEqual(true,  executeReturnCode('return (-5/0) < 0;')?.value);
    assert.strictEqual(true,  executeReturnCode('return (0/0).isNaN;')?.value);
    assert.strictEqual(2,     executeReturnCode('return 4/2;')?.value);
});

test('P0_04_ModuloFloat', () => {
    // Остаток вещественный (fmod); делитель 0 → NaN; целые остаются целыми.
    assert.strictEqual(1.5,  executeReturnCode('return (7/2) % 2;')?.value);
    assert.strictEqual(true, executeReturnCode('return (7 % 0).isNaN;')?.value);
    assert.strictEqual(1,    executeReturnCode('return 10 % 3;')?.value);
});

test('P0_05_StringToNumberJS', () => {
    // Строка → число по правилам JS Number(): hex/bin/Infinity, trim, пустая → 0.
    assert.strictEqual(26,    executeReturnCode('return "0x1A" - 0;')?.value);
    assert.strictEqual(false, executeReturnCode('return ("Infinity" - 0).isFinite;')?.value);
    assert.strictEqual(0,     executeReturnCode('return "" - 0;')?.value);
    assert.strictEqual(5,     executeReturnCode('return "  5  " - 0;')?.value);
    assert.strictEqual(true,  executeReturnCode('return ("abc" - 0).isNaN;')?.value);
});

test('P0_06_ArrayMembershipStrict', () => {
    // Членство по строгому равенству значений: null/bool работают, без приведения к строке.
    assert.strictEqual(true,  executeReturnCode('return [1, null].Contains(null);')?.value);
    assert.strictEqual(false, executeReturnCode('return [1, 2].Contains(null);')?.value);
    assert.strictEqual(0,     executeReturnCode('return [true, false].IndexOf(true);')?.value);
    assert.strictEqual(false, executeReturnCode('return [1].Contains("1");')?.value);
});

test('P0_07_RoundHalfUp', () => {
    // Math.round округляет половины к +∞ (JS), а не от нуля (PHP round).
    assert.strictEqual(-2, executeReturnCode('return Math.round(-2.5);')?.value);
    // Math.round(-0.5) в JS даёт -0; прибавляем +0 — это тот же ноль (SameValue
    // в strictEqual иначе различил бы -0 и +0; в PHP floor даёт сразу +0).
    assert.strictEqual(0,  (executeReturnCode('return Math.round(-0.5);')?.value as number) + 0);
    assert.strictEqual(3,  executeReturnCode('return Math.round(2.5);')?.value);
});

test('P0_08_FromCharCodeCodePoint', () => {
    // Сборка по код-поинту (mb_chr): астральные символы не теряются.
    assert.strictEqual('я',  executeReturnCode('return String.fromCharCode(1103);')?.value);
    assert.strictEqual('😀', executeReturnCode('return String.fromCharCode(128512);')?.value);
});

test('P0_09_NewArrayInvalidThrows', () => {
    // Недопустимая длина → бросает, а не молча создаёт [NaN].
    assert.strictEqual(3, executeReturnCode('return new Array(3).length;')?.value);
    assert.throws(() => executeReturnCode('return new Array(NaN);'));
    assert.throws(() => executeReturnCode('return new Array("abc");'));
});

test('P0_10_DateTimeTimeIsNumber', () => {
    // .Time — число (секунды от полуночи), а не объект DateTime.
    assert.strictEqual(3723, executeReturnCode('return DateTime.Today.AddHours(1).AddMinutes(2).AddSeconds(3).Time;')?.value);
    assert.strictEqual(3601, executeReturnCode('return DateTime.Today.AddHours(1).Time + 1;')?.value);
});

test('P0_11_VoidCoercion', () => {
    // Возврат без значения (void): к числу → NaN, к булеву → false.
    assert.strictEqual(true, executeReturnCode('function f() {} return (f() + 1).isNaN;')?.value);
    assert.strictEqual('f',  executeReturnCode('function f() {} if (f()) { return "t"; } return "f";')?.value);
});

test('P0_20_Bitwise64Bit', () => {
    // Битовые операции 64-битные (через BigInt), а не 32-битные.
    assert.strictEqual(4294967297, executeReturnCode('return 0x100000000 | 1;')?.value);
    assert.strictEqual(240,        executeReturnCode('return 0x1FF & 0xF0;')?.value);
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-21: зеркало пропущенных PHP-тестов TestBugs.php (Bug16/Bug17/Bug22).
// Поведение в TS уже верное — это добивка тест-парности до 1:1 с эталоном.
// ─────────────────────────────────────────────────────────────────────────────

test('Bug16_MulDivChainAfterPlus', () => {
    assert.strictEqual(2, executeReturnCode('return 1 + 2 * 3 / 6;')?.value);
});
test('Bug16_MulMulChainAfterPlus', () => {
    assert.strictEqual(25, executeReturnCode('return 1 + 2 * 3 * 4;')?.value);
});
test('Bug16_TaxFormula', () => {
    // Реальный сценарий, на котором баг был пойман.
    assert.strictEqual(1020, executeReturnCode('return 850 + 850 * 20 / 100;')?.value);
});
test('Bug16_TwoTermsHighPriority', () => {
    // `a*b + c*d` — два независимых высокоприоритетных блока вокруг `+`.
    assert.strictEqual(26, executeReturnCode('return 2 * 3 + 4 * 5;')?.value);
});
test('Bug16_DivThenMulLeftToRight', () => {
    // Левая ассоциативность `/` и `*` — `20/4*2` = 10, а не 2.5.
    assert.strictEqual(10, executeReturnCode('return 20 / 4 * 2;')?.value);
});
test('Bug16_MixWithMinus', () => {
    // 100 - 50 + 4 = 54
    assert.strictEqual(54, executeReturnCode('return 100 - 10 * 5 + 8 / 2;')?.value);
});
test('Bug16_ModInChain', () => {
    // 17%5=2, 2*2=4, 10+4=14
    assert.strictEqual(14, executeReturnCode('return 10 + 17 % 5 * 2;')?.value);
});

test('Bug17_LetNullThenReassignTopLevel', () => {
    assert.strictEqual(10, executeReturnCode('let off = null; off = 10; return off;')?.value);
});
test('Bug17_LetNullThenReassignInFunction', () => {
    const r = executeReturnCode(`
        function pick(x) {
            let off = null;
            if (x > 0) { off = "pos"; }
            else { off = "neg"; }
            return off;
        }
        return pick(5) + "/" + pick(-1);
    `);
    assert.strictEqual('pos/neg', r?.value);
});
test('Bug17_VarNullThenReassign', () => {
    assert.strictEqual(42, executeReturnCode('var off = null; off = 42; return off;')?.value);
});
test('Bug17_LetNullStaysReassignableAcrossBlocks', () => {
    const r = executeReturnCode(`
        let off = null;
        if (true) {
            off = 1;
        }
        off = off + 5;
        return off;
    `);
    assert.strictEqual(6, r?.value);
});
test('Bug17_GlobalNullStillConst', () => {
    // Зеркало PHP expectException(ContextException) (P1-5).
    assert.throws(() => executeReturnCode('null = 10; return null;'), ContextException);
});
test('Bug17_ConstNullStaysConst', () => {
    assert.throws(() => executeReturnCode('const off = null; off = 10; return off;'), ContextException);
});

test('Bug22_FloatIndexFromArithmetic', () => {
    // length=5, half=2.5; arr[2.5] не должен падать TypeError-ом, даёт nullish.
    const v = executeReturnCode(`
        let arr = [];
        let i = 0;
        while (i < 5) { arr.push(i * 10); i = i + 1; }
        let half = arr.length / 2;
        return arr[half];
    `)?.value;
    assert.ok(v === undefined || v === null);
});

// P1-22: зеркало PHP Test.php testMSLang077_VarRedeclaresLetFails. Поведение уже
// покрыто 077_LetRedeclarationInSameBlockFails в tests.ts (заморожен) — здесь
// добивка парности по имени с эталоном.
test('077_VarRedeclaresLetFails', () => {
    assert.throws(() => executeReturnCode('let x = 1; let x = 2; return x;'),
        /Identifier 'x' has already been declared/);
});

// ─────────────────────────────────────────────────────────────────────────────
// P1 батч B: парсер (зеркало TestBugs.php).
// ─────────────────────────────────────────────────────────────────────────────

test('P1_01_AssocArrayWithArrayValue', () => {
    // ['k' => [1,2,3]] — литерал-массив как значение ассоц-ключа (P1-1, PHP-first).
    assert.strictEqual(3, executeReturnCode("let m = ['a' => [1,2,3]]; return m['a'].length;")?.value);
    assert.strictEqual(1, executeReturnCode("return ['k' => [1,2,3]]['k'][0];")?.value);
});

test('P1_02_ForNonBooleanConditionThrows', () => {
    // Голое небулевое условие for бросает, как PHP (P1-2/P1-3).
    assert.throws(() => executeReturnCode('let n = 3; for (let i = 0; n; i = i + 1) { }'),
        /For compare invalid variable type/);
    // Нормальные формы по-прежнему работают.
    assert.strictEqual(10, executeReturnCode('let s = 0; for (let i = 0; i < 5; i = i + 1) { s = s + i; } return s;')?.value);
});

test('P1_04_ReservedWordAsIdentifierThrows', () => {
    // Зарезервированное слово как голый идентификатор — ошибка (P1-4).
    assert.throws(() => executeReturnCode('let y = clone + 1; return y;'),
        /Using reserved word/);
});

test('P1_07_ErrorMessageHasLineColPrefix', () => {
    // К сообщениям лексера/парсера/интерпретатора приписывается [строка:столбец] (P1-7).
    const grabMessage = (src: string): string => {
        try { executeReturnCode(src); return ''; } catch (e) { return (e as Error).message; }
    };
    assert.match(grabMessage('let y = clone + 1; return y;'), /^\[1:9\] Using reserved word/);
    assert.match(grabMessage('return 0x;'), /^\[1:9\] Parse numeric failed/);
    assert.match(grabMessage('return 5 + undefinedVar2;'), /^\[1:12\] variable not defined/);
});

test('P1_13_ObjectCastsToStringBracket', () => {
    // str += obj → '[object]' (StackVariableObject.castAs), а не падение (P1-13).
    const r = executeReturnCode('class C { constructor() { this.x = 1; } } let o = new C(); let s = "v:"; s += o; return s;');
    assert.strictEqual('v:[object]', r?.value);
});

test('P1_06_08_ParserExceptionTypes', () => {
    // Узловая ошибка → ParserNodeException, позиционная → ParserCursorException (P1-6/P1-8).
    assert.throws(() => executeReturnCode('return 1 + * 2;'), ParserNodeException);
    assert.throws(() => executeReturnCode('let y = clone + 1;'), ParserCursorException);
});
