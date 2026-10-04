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
import {Version} from '../src/version';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TS_ROOT = path.resolve(__dirname, '../src');
const PHP_ROOT = process.env.MSLANG_PHP_ROOT
    ?? path.resolve(__dirname, '../../php/src');

// Если PHP-зеркала рядом нет (например, в CI без чекаута соседнего репо),
// зеркальные тесты пропускаем — иначе они падают на ENOENT и красят всю
// сборку. Локально папка обычно есть.
const PHP_AVAILABLE = fs.existsSync(PHP_ROOT);
if (!PHP_AVAILABLE) {
    console.warn(`[mirror] PHP-зеркало не найдено в ${PHP_ROOT}, тесты пропущены.`);
    console.warn('[mirror] Чтобы прогнать, склонируй mslang.php рядом или задай MSLANG_PHP_ROOT.');
}

// PHP: вытаскиваем константы вида `const Имя = число;`
function readPhpConsts(file: string): Record<string, number> {
    const text = fs.readFileSync(path.join(PHP_ROOT, file), 'utf-8');
    const out: Record<string, number> = {};
    for (const m of text.matchAll(/const\s+(\w+)\s*=\s*(-?\d+)\s*;/g)) {
        out[m[1]] = parseInt(m[2], 10);
    }
    //Пустой разбор — ошибка, а не тихий успех: формат записи мог смениться в обоих файлах сразу.
    assert.ok(Object.keys(out).length > 0, `В ${file} не найдено ни одной числовой константы`);
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
        assert.ok(Object.keys(out).length > 0, `${name}: в ${filePath} не разобрано ни одной константы`);
        return out;
    }

    m = text.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)^\\s*\\}`, 'm'));
    if (m) {
        for (const e of m[1].matchAll(/['"](\w+)['"]\s*:\s*(-?\d+)/g))
            out[e[1]] = parseInt(e[2], 10);
        assert.ok(Object.keys(out).length > 0, `${name}: в ${filePath} не разобрано ни одной константы`);
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

// Строковые коды ошибок: PHP `const Имя = 'значение';` против TS `Имя: 'значение',`
// внутри `export const ErrorCode = {...}`. Пустой разбор — ошибка, а не тихий успех.
test('mirror_ErrorCode', {skip: !PHP_AVAILABLE}, () => {
    const phpText = fs.readFileSync(path.join(PHP_ROOT, 'Exception/ErrorCode.php'), 'utf-8');
    const php: Record<string, string> = {};
    for (const m of phpText.matchAll(/const\s+(\w+)\s*=\s*'([^']*)'\s*;/g)) php[m[1]] = m[2];

    const tsText = fs.readFileSync(path.join(TS_ROOT, 'exceptions.ts'), 'utf-8');
    const block = tsText.match(/export const ErrorCode = \{([\s\S]*?)^\} as const;/m);
    assert.ok(block, 'В exceptions.ts не найден блок ErrorCode');
    const ts: Record<string, string> = {};
    for (const m of block[1].matchAll(/^\s*(\w+):\s*'([^']*)',/gm)) ts[m[1]] = m[2];

    assert.ok(Object.keys(php).length > 0, 'В ErrorCode.php не найдено ни одной константы');
    assert.deepStrictEqual(ts, php, 'ErrorCode: наборы TS и PHP расходятся');
});

test('mirror_VariableType', {skip: !PHP_AVAILABLE}, () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'variabletype.ts'), 'VariableType'),
        readPhpConsts('VariableType.php'),
        'VariableType',
    );
});

test('mirror_LexerType', {skip: !PHP_AVAILABLE}, () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'lexer.ts'), 'LexerType'),
        readPhpConsts('LexerType.php'),
        'LexerType',
    );
});

test('mirror_NodeType', {skip: !PHP_AVAILABLE}, () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'parser.ts'), 'NodeType'),
        readPhpConsts('NodeType.php'),
        'NodeType',
    );
});

test('mirror_CompareType', {skip: !PHP_AVAILABLE}, () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'parser.ts'), 'CompareType'),
        readPhpConsts('CompareType.php'),
        'CompareType',
    );
});

test('mirror_InterpreterNodeType', {skip: !PHP_AVAILABLE}, () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'interpreternodetype.ts'), 'InterpreterNodeType'),
        readPhpConsts('InterpreterNodeType.php'),
        'InterpreterNodeType',
    );
});

test('mirror_ContextType', {skip: !PHP_AVAILABLE}, () => {
    compareConsts(
        readTsConsts(path.join(TS_ROOT, 'contexttype.ts'), 'ContextType'),
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

test('mirror_handlers — какие NodeType зарегистрированы в обоих интерпретаторах', {skip: !PHP_AVAILABLE}, () => {
    const tsH = readTsHandlers();
    const phpH = readPhpHandlers();
    assert.ok(tsH.size > 0 && phpH.size > 0, `Не найдено ни одной регистрации обработчика: TS=${tsH.size} PHP=${phpH.size}`);

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
    assert.ok(out.size > 0 || !/function\s+funcInvoke/.test(text), `${file}: методы funcInvoke есть, но не разобраны`);
    return out;
}

function readTsFuncInvokes(file: string): Set<string> {
    const text = fs.readFileSync(path.join(TS_ROOT, file), 'utf-8');
    const out = new Set<string>();
    for (const m of text.matchAll(/funcInvoke(_)?(\w+?)(?:Args|Return)?\s*[(=]/g)) {
        out.add(normalize(m[2]));
    }
    assert.ok(out.size > 0 || !/funcInvoke\w*\s*[(=]/.test(text), `${file}: методы funcInvoke есть, но не разобраны`);
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
    ['arrayconstructor.ts',       'ArrayConstructor.php'],
    ['stackvariableplainobject.ts', 'StackVariablePlainObject.php'],
    ['mathfunctions.ts',          'MathFunctions.php'],
    ['numberfunctions.ts',        'NumberFunctions.php'],
    ['objectfunctions.ts',        'ObjectFunctions.php'],
    ['jsonfunctions.ts',          'JsonFunctions.php'],
    ['base64functions.ts',        'Base64Functions.php'],
    ['urlfunctions.ts',           'UrlFunctions.php'],
    ['hashfunctions.ts',          'HashFunctions.php'],
];

for (const [tsFile, phpFile] of STACK_VAR_PAIRS) {
    test(`mirror_funcInvoke_${tsFile.replace(/\.ts$/, '')}`, {skip: !PHP_AVAILABLE}, () => {
        const ts = readTsFuncInvokes(tsFile);
        const php = readPhpFuncInvokes(phpFile);

        const onlyTs = [...ts].filter(x => !php.has(x)).sort();
        const onlyPhp = [...php].filter(x => !ts.has(x)).sort();

        assert.deepStrictEqual(onlyTs, [], `${tsFile}: funcInvoke только в TS: ${onlyTs.join(', ')}`);
        assert.deepStrictEqual(onlyPhp, [], `${phpFile}: funcInvoke только в PHP: ${onlyPhp.join(', ')}`);
    });
}

// --- Зеркало версии ---
// VERSION/REVISION в TS version.ts и PHP Version.php обязаны совпадать.
function readVersionFields(text: string): {version: string | null, revision: string | null} {
    const v = text.match(/VERSION\s*[=:]\s*'([^']*)'/);
    const r = text.match(/REVISION\s*[=:]\s*'([^']*)'/);
    return {version: v?.[1] ?? null, revision: r?.[1] ?? null};
}

test('mirror_Version — VERSION/REVISION совпадают', {skip: !PHP_AVAILABLE}, () => {
    const ts = readVersionFields(fs.readFileSync(path.join(TS_ROOT, 'version.ts'), 'utf-8'));
    const php = readVersionFields(fs.readFileSync(path.join(PHP_ROOT, 'Version.php'), 'utf-8'));

    //null === null — не совпадение, а потерянный разбор (формат записи сменился).
    assert.ok(ts.version && ts.revision && php.version && php.revision, 'VERSION/REVISION не разобраны в одном из файлов');
    assert.strictEqual(ts.version, php.version, `VERSION: TS=${ts.version} PHP=${php.version}`);
    assert.strictEqual(ts.revision, php.revision, `REVISION: TS=${ts.revision} PHP=${php.revision}`);
});

test('mirror_Version — getFullVersion даёт ту же строку', {skip: !PHP_AVAILABLE}, () => {
    //PHP: sprintf('<формат>', VERSION, REVISION) — подставляем значения в формат и сверяем с TS.
    const phpText = fs.readFileSync(path.join(PHP_ROOT, 'Version.php'), 'utf-8');
    const format = phpText.match(/getFullVersion[\s\S]*?sprintf\(\s*'([^']*)'\s*,\s*static::VERSION\s*,\s*static::REVISION\s*\)/);
    assert.ok(format, 'В Version.php не найден sprintf(формат, VERSION, REVISION) в getFullVersion');
    const php = readVersionFields(phpText);
    const expected = format[1].replace('%s', String(php.version)).replace('%s', String(php.revision));

    assert.strictEqual(Version.getFullVersion(), expected);
});

// --- Зеркало набора тестов ---
// Имена тест-кейсов в tests.ts/bugs.ts и Test.php/TestBugs.php обязаны совпадать
// один-в-один (после снятия префикса testMSLang/test). Это автоматически ловит
// пропуски тестов с любой стороны. limits.ts исключён: там русские описания, а в
// PHP — английские имена методов (зеркалятся по порядку/содержанию, не по имени).
function readTsTestNames(files: string[]): Set<string> {
    const out = new Set<string>();
    for (const f of files) {
        const text = fs.readFileSync(path.join(__dirname, f), 'utf-8');
        for (const m of text.matchAll(/(?:^|\n)\s*test\(\s*'([^']+)'/g)) {
            out.add(m[1]);
        }
    }
    return out;
}

function readPhpTestNames(files: string[]): Set<string> {
    const out = new Set<string>();
    for (const f of files) {
        const text = fs.readFileSync(path.join(PHP_ROOT, '..', 'tests', f), 'utf-8');
        for (const m of text.matchAll(/function\s+test(\w+)\s*\(/g)) {
            out.add(m[1].replace(/^MSLang/, ''));
        }
    }
    return out;
}

//Сверка по ПАРАМ файлов, а не по объединению: переезд теста в другой файл одной
//стороны тоже расхождение (раньше 077_VarRedeclaresLetFails жил в bugs.ts и в Test.php).
for (const [tsFile, phpFile] of [['tests.ts', 'Test.php'], ['bugs.ts', 'TestBugs.php']]) {
    test(`mirror_test_parity — имена тест-кейсов совпадают (${tsFile} ↔ ${phpFile})`, {skip: !PHP_AVAILABLE}, () => {
        const ts = readTsTestNames([tsFile]);
        const php = readPhpTestNames([phpFile]);
        assert.ok(ts.size > 0 && php.size > 0, `Не найдено тестов: ${tsFile}=${ts.size} ${phpFile}=${php.size}`);

        const onlyTs = [...ts].filter(x => !php.has(x)).sort();
        const onlyPhp = [...php].filter(x => !ts.has(x)).sort();

        assert.deepStrictEqual(onlyTs, [], `тест только в ${tsFile}: ${onlyTs.join(', ')}`);
        assert.deepStrictEqual(onlyPhp, [], `тест только в ${phpFile}: ${onlyPhp.join(', ')}`);
    });
}

//limits.ts ↔ TestLimits.php: имена разные (русские описания против английских имён
//методов), поэтому сверяем хотя бы число тестов.
test('mirror_test_parity — число тестов совпадает (limits.ts ↔ TestLimits.php)', {skip: !PHP_AVAILABLE}, () => {
    const ts = readTsTestNames(['limits.ts']);
    const php = readPhpTestNames(['TestLimits.php']);

    assert.ok(ts.size > 0, 'В limits.ts не найдено тестов');
    assert.strictEqual(ts.size, php.size, `limits.ts: ${ts.size} тестов, TestLimits.php: ${php.size}`);
});
