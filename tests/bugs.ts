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
    ParseNode, StackVariableUndefined, FunctionEntry,
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
