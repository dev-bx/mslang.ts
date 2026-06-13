/*
 * Ресурсные лимиты песочницы (инструкции / время / создаваемые данные).
 * Зеркало PHP tests/TestLimits.php.
 *
 * Запуск: npm run test:limits
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CodeLexer, CodeParser, LexerTypeArray, LexerType, Interpreter, ContextInterpreter, ResourceLimitException,
} from "../src";
import {ParseNode} from "../src/parser";

function createCodeContext(text: string): ContextInterpreter {
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

// --- Лимит инструкций ---

//Лимит срабатывает ПОСЛЕ исчерпания бюджета, а не на первой инструкции.
test('лимит инструкций: короткий скрипт проходит', () => {
    const context = createCodeContext('let x = 1 + 2; return x;');
    context.setLimitExecInstruction(10000);
    const result = context.exec(true);
    assert.equal(result?.value, 3);
});

test('лимит инструкций: бесконечный цикл останавливается', () => {
    const context = createCodeContext('let i = 0; while (true) { i = i + 1; }');
    context.setLimitExecInstruction(10000);
    assert.throws(() => context.exec(true), (e: unknown) =>
        e instanceof ResourceLimitException && /Execution limit/.test((e as Error).message));
});

//Скриптовый try/catch НЕ ловит остановку по лимиту — иначе скрипт перехватил бы
//её и продолжил работу, обнулив смысл песочницы.
test('лимит инструкций: try/catch скрипта не перехватывает', () => {
    const context = createCodeContext('try { while (true) { } } catch (e) { return "caught"; } return "done";');
    context.setLimitExecInstruction(10000);
    assert.throws(() => context.exec(true), ResourceLimitException);
});

// --- Лимит времени ---

test('лимит времени: короткий скрипт проходит', () => {
    const context = createCodeContext('let x = "a" + "b"; return x;');
    context.setLimitExecTimeMs(5000);
    const result = context.exec(true);
    assert.equal(result?.value, 'ab');
});

test('лимит времени: долгий цикл останавливается около лимита', () => {
    //Без лимита инструкций цикл остановит только время (лимит 50 мс).
    const context = createCodeContext('let i = 0; while (true) { i = i + 1; }');
    context.setLimitExecTimeMs(50);
    const start = Date.now();
    assert.throws(() => context.exec(true), (e: unknown) =>
        e instanceof ResourceLimitException && /Execution time limit/.test((e as Error).message));
    //Должны остановиться около лимита, а не висеть (широкий запас на CI).
    assert.ok(Date.now() - start < 5000);
});

// --- Бюджет создаваемых данных ---

test('бюджет данных: обычные строки проходят', () => {
    const context = createCodeContext('let s = "hello" + " " + "world"; return s;');
    context.setLimitAllocBytes(1024 * 1024);
    const result = context.exec(true);
    assert.equal(result?.value, 'hello world');
});

//Классическая атака на память: удвоение строки в цикле укладывается в бюджет
//инструкций (30 итераций), но раздувает память до гигабайта. Бюджет данных ловит.
test('бюджет данных: удвоение строки в цикле останавливается', () => {
    const context = createCodeContext('let s = "xxxxxxxxxxxxxxxx"; let i = 0; while (i < 30) { s = s + s; i = i + 1; } return s;');
    context.setLimitExecInstruction(1000000);
    context.setLimitAllocBytes(1024 * 1024); //1 МБ
    assert.throws(() => context.exec(true), (e: unknown) =>
        e instanceof ResourceLimitException && /Allocation limit/.test((e as Error).message));
});

test('бюджет данных: new Array(огромное N) останавливается до материализации', () => {
    const context = createCodeContext('let a = new Array(100000000); return a.length;');
    context.setLimitAllocBytes(1024 * 1024);
    assert.throws(() => context.exec(true), (e: unknown) =>
        e instanceof ResourceLimitException && /Allocation limit/.test((e as Error).message));
});

test('бюджет данных: счётчик создания растёт', () => {
    const context = createCodeContext('let s = "abc" + "def"; return s;');
    context.setLimitAllocBytes(1024 * 1024);
    context.exec(true);
    //Создана как минимум строка-результат склейки (6 байт).
    assert.ok(context.getAllocatedBytes() >= 6);
});

//Без лимитов поведение прежнее: ничего не считается фатальным.
test('без лимитов поведение прежнее', () => {
    const context = createCodeContext('let s = "a"; let i = 0; while (i < 100) { s = s + "b"; i = i + 1; } return s.length;');
    const result = context.exec(true);
    assert.equal(result?.value, 101);
});

//P1-10: Array-методы, отдающие новый массив, тоже списывают бюджет данных.
test('бюджет данных: Array.keys/values списываются', () => {
    const context = createCodeContext('let a = [10, 20, 30]; let k = a.keys(); let v = a.values(); return 1;');
    context.exec(true);
    //keys и values создают по 3-элементному массиву → не меньше 6*16 байт (совпадает с PHP).
    assert.ok(context.getAllocatedBytes() >= 96);
});
