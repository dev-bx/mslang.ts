/*
 * Поведенческие cross-runtime тесты.
 *
 * Каждая пара tests/scripts/NAME.msl + NAME.expected.
 * Содержимое скрипта выполняется TS-интерпретатором, результат сравнивается
 * с эталоном в .expected (JSON-литерал: число, строка в кавычках, true/false/null).
 *
 * Чтобы убедиться, что и PHP даёт такой же результат, в зеркале лежит
 * tests/cross/CrossRuntimeTest.php — он использует тот же набор скриптов.
 *
 * Запуск: npx tsx tests/cross.ts (или npm run test:cross)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    CodeLexer, CodeParser, Interpreter, ContextInterpreter,
    LexerTypeArray, LexerType, ParseNode,
} from '../src';
import {unwrap} from './_unwrap';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, 'scripts');

function executeScript(source: string): unknown {
    const lexer = new CodeLexer(source);
    const parser = new CodeParser(lexer);
    const nodeList: ParseNode[] = [];
    parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

    const interpreter = new Interpreter();
    interpreter.registerHandlers();

    const context = new ContextInterpreter(nodeList, interpreter);
    context.registerConst();

    return context.exec(true);
}


const files = fs.readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.msl')).sort();

for (const file of files) {
    const name = file.replace(/\.msl$/, '');
    test(`cross_${name}`, () => {
        const source = fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8');
        const expectedRaw = fs.readFileSync(path.join(SCRIPTS_DIR, name + '.expected'), 'utf-8').trim();
        const expected = JSON.parse(expectedRaw);

        const actual = unwrap(executeScript(source));

        assert.deepStrictEqual(actual, expected);
    });
}
