/*
 * Фаззер: генерирует случайные короткие MSLang-выражения, выполняет в TS,
 * пишет пары {script, result} в JSONL. PHP-runner (tests/fuzz.php) читает
 * этот файл, выполняет те же скрипты, и сравнивает результаты.
 *
 * Запуск (TS-сторона генерирует, PHP-сторона проверяет):
 *   npx tsx tests/fuzz.ts --count 200 --seed 42 > /tmp/fuzz.jsonl
 *   php ../devbx.core/tests/fuzz.php /tmp/fuzz.jsonl
 *
 * При расхождении PHP-runner печатает строки, где результат отличается,
 * и выходит с ненулевым кодом. По умолчанию --count 100.
 */
import {
    CodeLexer, CodeParser, Interpreter, ContextInterpreter,
    LexerTypeArray, LexerType, ParseNode, StackVariableArray,
    StackVariableNull, StackVariableUndefined, VariableType,
} from '../src';

function arg(name: string, def: string): string {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 ? process.argv[i + 1] : def;
}
const COUNT = parseInt(arg('count', '100'), 10);
const SEED = parseInt(arg('seed', '1'), 10);

// mulberry32 — нужен только для TS, чтобы воспроизводить ту же генерацию
// при одинаковом seed. PHP читает уже сгенерированные скрипты.
function makePrng(seed: number) {
    let s = seed >>> 0;
    return function (): number {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rand = makePrng(SEED);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const int = () => Math.floor(rand() * 21) - 10;

function genExpr(depth = 0): string {
    if (depth >= 3 || rand() < 0.4) {
        const k = pick(['int', 'bool', 'null', 'str']);
        if (k === 'int') return String(int());
        if (k === 'bool') return rand() < 0.5 ? 'true' : 'false';
        if (k === 'null') return 'null';
        return JSON.stringify(['a', 'b', 'ab', '1', ''][Math.floor(rand() * 5)]);
    }
    // Опускаем потенциально расходящиеся операции (% при 0, < null, etc) — это
    // отдельные направления, для них есть отдельные тесты. Берём базовые.
    const op = pick(['+', '-', '*', '==', '!=', '&&', '||']);
    return `(${genExpr(depth + 1)} ${op} ${genExpr(depth + 1)})`;
}

function genScript(): string {
    return 'return ' + genExpr() + ';';
}

function executeScript(source: string): unknown {
    try {
        const lexer = new CodeLexer(source);
        const parser = new CodeParser(lexer);
        const nodeList: ParseNode[] = [];
        parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

        const interpreter = new Interpreter();
        interpreter.registerHandlers();

        const ctx = new ContextInterpreter(nodeList, interpreter);
        ctx.registerConst();

        return unwrap(ctx.exec(true));
    } catch {
        return {error: true};
    }
}

function unwrap(v: unknown): unknown {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && 'refValue' in (v as object)) {
        v = (v as { refValue: unknown }).refValue;
    }
    if (v instanceof StackVariableArray) {
        const r: unknown[] = [];
        v.value.forEach(inner => r.push(unwrap(inner)));
        return r;
    }
    if (v instanceof StackVariableUndefined) return null;
    if (v instanceof StackVariableNull) return null;
    if (v instanceof StackVariable) {
        if (v.type === VariableType.vtVoid) return null;
        let val = v.value;
        if (typeof val === 'number' && !Number.isFinite(val)) {
            val = Number.isNaN(val) ? 'NaN' : val > 0 ? 'Infinity' : '-Infinity';
        }
        return val;
    }
    return v;
}

for (let i = 0; i < COUNT; i++) {
    const src = genScript();
    const result = executeScript(src);
    process.stdout.write(JSON.stringify({src, ts: result}) + '\n');
}
