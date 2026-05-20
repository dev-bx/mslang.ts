/*
 * Бенчмарки MSLang. Это не CI-проверки — лишь точка отсчёта для
 * оптимизаций. Цифры стартовые, без сравнения с порогом.
 *
 * Запуск: npx tsx tests/bench.ts
 */
import {
    CodeLexer, CodeParser, Interpreter, ContextInterpreter,
    LexerTypeArray, LexerType, ParseNode,
} from '../src';

interface BenchResult {
    name: string;
    runs: number;
    ms: number;
    msPerRun: number;
}

function bench(name: string, runs: number, fn: () => void): BenchResult {
    // прогрев — JIT и кэши
    for (let i = 0; i < 100; i++) fn();

    const start = performance.now();
    for (let i = 0; i < runs; i++) fn();
    const ms = performance.now() - start;

    return {name, runs, ms, msPerRun: ms / runs};
}

function parse(source: string): ParseNode[] {
    const lexer = new CodeLexer(source);
    const parser = new CodeParser(lexer);
    const nodeList: ParseNode[] = [];
    parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));
    return nodeList;
}

function build(nodeList: ParseNode[]): ContextInterpreter {
    const interpreter = new Interpreter();
    interpreter.registerHandlers();
    const ctx = new ContextInterpreter(nodeList, interpreter);
    ctx.registerConst();
    return ctx;
}

function exec(source: string) {
    const nodeList = parse(source);
    return build(nodeList).exec(true);
}

// --- сценарии ---

const HOT_LOOP = `
    a = 0;
    for (i = 0; i < 1000; i++) {
        a = a + i;
    }
    return a;
`;

const STRING_CONCAT = `
    s = "";
    for (i = 0; i < 100; i++) {
        s = s + "x";
    }
    return s;
`;

const ARRAY_PUSH = `
    a = [];
    for (i = 0; i < 200; i++) {
        a.push(i);
    }
    return a.Count();
`;

const ARITHMETIC = `return (1 + 2) * 3 - 4 / 2 + (10 % 3);`;

const COMPLEX_BOOL = `return (1 == 1) && (2 != 3) || ((4 < 5) && !(6 > 7));`;

const results: BenchResult[] = [];

results.push(bench('parse (arithmetic)', 1000, () => parse(ARITHMETIC)));
results.push(bench('parse (hot loop)', 1000, () => parse(HOT_LOOP)));

// Парсинг + выполнение в каждом запуске
results.push(bench('exec (arithmetic)', 1000, () => exec(ARITHMETIC)));
results.push(bench('exec (complex bool)', 1000, () => exec(COMPLEX_BOOL)));
results.push(bench('exec (hot loop 1000×)', 50, () => exec(HOT_LOOP)));
results.push(bench('exec (string concat 100×)', 50, () => exec(STRING_CONCAT)));
results.push(bench('exec (array push 200×)', 50, () => exec(ARRAY_PUSH)));

// Только выполнение (без парсинга)
const arithmeticAst = parse(ARITHMETIC);
results.push(bench('exec only (arithmetic, parsed once)', 1000, () => build(arithmeticAst).exec(true)));

const loopAst = parse(HOT_LOOP);
results.push(bench('exec only (hot loop 1000×, parsed once)', 50, () => build(loopAst).exec(true)));

// --- вывод ---
console.log('\n=== MSLang benchmarks ===');
console.log('runs\tms total\tms/run\tname');
for (const r of results) {
    console.log(`${r.runs}\t${r.ms.toFixed(1)}\t\t${r.msPerRun.toFixed(3)}\t${r.name}`);
}
