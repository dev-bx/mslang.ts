/*
 * Фаззер: генерирует случайные короткие MSLang-выражения, выполняет в TS,
 * пишет пары {script, result} в JSONL. PHP-runner (tests/fuzz.php) читает
 * этот файл, выполняет те же скрипты, и сравнивает результаты.
 *
 * Запуск (TS-сторона генерирует, PHP-сторона проверяет):
 *   npx tsx tests/fuzz.ts --count 200 --seed 42 > /tmp/fuzz.jsonl
 *   php ../php/tests/fuzz.php /tmp/fuzz.jsonl
 *
 * При расхождении PHP-runner печатает строки, где результат отличается,
 * и выходит с ненулевым кодом. По умолчанию --count 100.
 */
import {MSLangException, Script} from '../src';
import {unwrap} from './_unwrap';

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

// Генератор с типами: при строгой семантике (3.0.0) смешение типов почти всегда даёт
// ошибку, поэтому основная масса выражений собрана по типам — числовые, строковые и
// булевы, — а доля намеренно смешанных проверяет, что движки бросают ОДНУ И ТУ ЖЕ ошибку.

function genNum(depth = 0): string {
    if (depth >= 3 || rand() < 0.35) {
        const r = rand();
        if (r < 0.6) return String(int());
        if (r < 0.8) return (int() / 4).toString();
        return pick(['0', '1', '(0/0)', '(1/0)']);
    }
    if (rand() < 0.1) return `-(${genNum(depth + 1)})`;
    const op = pick(['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>']);
    return `(${genNum(depth + 1)} ${op} ${genNum(depth + 1)})`;
}

function genStr(depth = 0): string {
    if (depth >= 3 || rand() < 0.4) {
        if (rand() < 0.3) return `(${genNum(depth + 1)}).toString()`;
        return JSON.stringify(pick(['a', 'b', 'ab', '1', '', 'абв']));
    }
    return `(${genStr(depth + 1)} + ${genStr(depth + 1)})`;
}

function genBool(depth = 0): string {
    if (depth >= 3 || rand() < 0.3) {
        const r = rand();
        if (r < 0.3) return pick(['true', 'false']);
        if (r < 0.7) return `(${genNum(depth + 1)} ${pick(['<', '>', '<=', '>=', '==', '!='])} ${genNum(depth + 1)})`;
        return `(${genStr(depth + 1)} ${pick(['==', '!='])} ${genStr(depth + 1)})`;
    }
    const r = rand();
    if (r < 0.15) return `!${genBool(depth + 1)}`;
    if (r < 0.3) return `(${genBool(depth + 1)} ? ${genBool(depth + 1)} : ${genBool(depth + 1)})`;
    return `(${genBool(depth + 1)} ${pick(['&&', '||'])} ${genBool(depth + 1)})`;
}

// Смешанные выражения — значения любых типов через любые операторы (ожидаемо ошибки).
function genAny(depth = 0): string {
    if (depth >= 2 || rand() < 0.4) {
        return pick([String(int()), 'true', 'false', 'null', '"a"', '""', '[1]', '{a: 1}']);
    }
    const op = pick(['+', '-', '*', '/', '%', '==', '!=', '<', '>', '&&', '||', '??']);
    return `(${genAny(depth + 1)} ${op} ${genAny(depth + 1)})`;
}

function genScript(): string {
    const r = rand();
    const expr = r < 0.35 ? genNum() : r < 0.55 ? genStr() : r < 0.85 ? genBool() : genAny();
    return 'return ' + expr + ';';
}

// Результат или {error: <код>} — коды ошибок обязаны совпадать в движках.
function executeScript(source: string): unknown {
    try {
        return unwrap(Script.parseProgram(source).createContext().exec(true));
    } catch (e) {
        return {error: e instanceof MSLangException ? e.getErrorCode() : 'HostError'};
    }
}

for (let i = 0; i < COUNT; i++) {
    const src = genScript();
    const result = executeScript(src);
    process.stdout.write(JSON.stringify({src, ts: result}) + '\n');
}
