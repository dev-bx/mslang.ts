/*
 * Зеркальная проверка констант: значения и имена в TS и PHP должны совпадать
 * один-в-один. Любое расхождение в нумерации недопустимо — иначе один и тот же
 * исходник MSLang на двух интерпретаторах поведёт себя по-разному.
 *
 * Запуск: npx tsx tests/mirror.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TS_ROOT = path.resolve(__dirname, '../src');
const PHP_ROOT = path.resolve(__dirname, '../../devbx.core/local/modules/devbx.core/lib/MSLang');

// PHP: вытаскиваем константы вида `const Имя = число;`
function readPhpConsts(file: string): Record<string, number> {
    const text = fs.readFileSync(path.join(PHP_ROOT, file), 'utf-8');
    const out: Record<string, number> = {};
    for (const m of text.matchAll(/const\s+(\w+)\s*=\s*(-?\d+)\s*;/g)) {
        out[m[1]] = parseInt(m[2], 10);
    }
    return out;
}

// TS: парсим либо `enum X { Y = N }`, либо `const X = { 'Y': N }`.
function readTsConsts(filePath: string, name: string): Record<string, number> {
    const text = fs.readFileSync(filePath, 'utf-8');
    const out: Record<string, number> = {};

    let m = text.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
    if (m) {
        for (const e of m[1].matchAll(/^\s*(\w+)\s*=\s*(-?\d+)/gm))
            out[e[1]] = parseInt(e[2], 10);
        return out;
    }

    m = text.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)^\\s*\\}`, 'm'));
    if (m) {
        for (const e of m[1].matchAll(/['"](\w+)['"]\s*:\s*(-?\d+)/g))
            out[e[1]] = parseInt(e[2], 10);
        return out;
    }
    throw new Error(`Failed to find constants for ${name} in ${filePath}`);
}

function compareConsts(ts: Record<string, number>, php: Record<string, number>, label: string) {
    const tsKeys = Object.keys(ts).sort();
    const phpKeys = Object.keys(php).sort();

    const missingInTs = phpKeys.filter(k => !(k in ts));
    const missingInPhp = tsKeys.filter(k => !(k in php));

    assert.deepStrictEqual(
        missingInTs, [],
        `${label}: в TS нет констант, которые есть в PHP: ${missingInTs.join(', ')}`,
    );
    assert.deepStrictEqual(
        missingInPhp, [],
        `${label}: в PHP нет констант, которые есть в TS: ${missingInPhp.join(', ')}`,
    );

    const mismatches: string[] = [];
    for (const k of tsKeys) {
        if (ts[k] !== php[k]) {
            mismatches.push(`${k}: TS=${ts[k]} PHP=${php[k]}`);
        }
    }
    assert.deepStrictEqual(mismatches, [], `${label}: расхождения значений:\n  ${mismatches.join('\n  ')}`);
}

test('mirror_VariableType', () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'variabletype.ts'), 'VariableType'),
        readPhpConsts('VariableType.php'),
        'VariableType',
    );
});

test('mirror_LexerType', () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'lexer.ts'), 'LexerType'),
        readPhpConsts('LexerType.php'),
        'LexerType',
    );
});

test('mirror_NodeType', () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'parser.ts'), 'NodeType'),
        readPhpConsts('NodeType.php'),
        'NodeType',
    );
});

test('mirror_CompareType', () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'parser.ts'), 'CompareType'),
        readPhpConsts('CompareType.php'),
        'CompareType',
    );
});

test('mirror_InterpreterNodeType', () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'interpreter.ts'), 'InterpreterNodeType'),
        readPhpConsts('InterpreterNodeType.php'),
        'InterpreterNodeType',
    );
});

test('mirror_ContextType', () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'interpreter.ts'), 'ContextType'),
        readPhpConsts('ContextType.php'),
        'ContextType',
    );
});

// --- Зеркало регистраций обработчиков ---
// Сторожим, чтобы для каждого NodeType/InterpreterNodeType, который имеет
// handler в одной реализации, такой же handler был в другой.

function readPhpHandlers(): Set<string> {
    const text = fs.readFileSync(path.join(PHP_ROOT, 'Interpreter.php'), 'utf-8');
    const out = new Set<string>();
    // registerNodeHandler(NodeType::ntFoo, ...) или (InterpreterNodeType::ntBar, ...)
    for (const m of text.matchAll(/registerNodeHandler\s*\(\s*(?:NodeType|InterpreterNodeType)::(\w+)\s*,/g)) {
        out.add(m[1]);
    }
    return out;
}

function readTsHandlers(): Set<string> {
    const text = fs.readFileSync(path.join(TS_ROOT, 'interpreter.ts'), 'utf-8');
    const out = new Set<string>();
    for (const m of text.matchAll(/registerNodeHandler\s*\(\s*(?:NodeType|InterpreterNodeType)\.(\w+)/g)) {
        out.add(m[1]);
    }
    return out;
}

test('mirror_handlers — какие NodeType зарегистрированы в обоих интерпретаторах', () => {
    const tsH = readTsHandlers();
    const phpH = readPhpHandlers();

    const onlyTs = [...tsH].filter(x => !phpH.has(x)).sort();
    const onlyPhp = [...phpH].filter(x => !tsH.has(x)).sort();

    assert.deepStrictEqual(onlyTs, [], `Handler только в TS, нет в PHP: ${onlyTs.join(', ')}`);
    assert.deepStrictEqual(onlyPhp, [], `Handler только в PHP, нет в TS: ${onlyPhp.join(', ')}`);
});

// --- Зеркало funcInvoke* методов ---
// Сторожим, чтобы у одинаковых StackVariable*-классов набор методов и свойств
// был одинаковый. Без аргументов — только имена. Не идеально, но ловит классы
// расхождений вроде «в TS добавили indexOf, в PHP нет».

// Нормализует имя метода: «funcInvoke_abs»/«funcInvokeAbs» → «abs» (нижний регистр первой буквы).
// PHP может писать оба варианта, TS использует подчёркивание для lowercase-имён.
function normalize(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

function readPhpFuncInvokes(file: string): Set<string> {
    const text = fs.readFileSync(path.join(PHP_ROOT, file), 'utf-8');
    const out = new Set<string>();
    for (const m of text.matchAll(/function\s+funcInvoke(_)?(\w+?)(?:Args|Return)?\s*\(/g)) {
        out.add(normalize(m[2]));
    }
    return out;
}

function readTsFuncInvokes(file: string): Set<string> {
    const text = fs.readFileSync(path.join(TS_ROOT, file), 'utf-8');
    const out = new Set<string>();
    for (const m of text.matchAll(/funcInvoke(_)?(\w+?)(?:Args|Return)?\s*[(=]/g)) {
        out.add(normalize(m[2]));
    }
    return out;
}

const STACK_VAR_PAIRS = [
    ['stackvariable.ts',          'StackVariable.php'],
    ['stackvariablestring.ts',    'StackVariableString.php'],
    ['stackvariablenumber.ts',    'StackVariableNumber.php'],
    ['stackvariableboolean.ts',   'StackVariableBoolean.php'],
    ['stackvariablearray.ts',     'StackVariableArray.php'],
    ['stackvariableobject.ts',    'StackVariableObject.php'],
    ['stackvariablenull.ts',      'StackVariableNull.php'],
    ['stackvariableundefined.ts', 'StackVariableUndefined.php'],
    ['stackvariablefunction.ts',  'StackVariableFunction.php'],
    ['stackvariabledatetime.ts',  'StackVariableDateTime.php'],
    ['stackvariableref.ts',       'StackVariableRef.php'],
    ['mathfunctions.ts',          'MathFunctions.php'],
];

for (const [tsFile, phpFile] of STACK_VAR_PAIRS) {
    test(`mirror_funcInvoke_${tsFile.replace(/\.ts$/, '')}`, () => {
        const ts = readTsFuncInvokes(tsFile);
        const php = readPhpFuncInvokes(phpFile);

        const onlyTs = [...ts].filter(x => !php.has(x)).sort();
        const onlyPhp = [...php].filter(x => !ts.has(x)).sort();

        assert.deepStrictEqual(onlyTs, [], `${tsFile}: funcInvoke только в TS: ${onlyTs.join(', ')}`);
        assert.deepStrictEqual(onlyPhp, [], `${phpFile}: funcInvoke только в PHP: ${onlyPhp.join(', ')}`);
    });
}
