#!/usr/bin/env node
/*
 * Поднимает версию языка: пишет version в package.json и переносит её в
 * src/version.ts (VERSION), плюс проставляет REVISION = сегодня.
 *
 * Версия языка — общая с PHP-эталоном (mslang.php). Здесь — зеркало: подними до
 * того же числа, что и в эталоне. Равенство VERSION/REVISION между репозиториями
 * сторожит mirror-тест (mirror_Version в tests/mirror.ts).
 *
 * Запуск:
 *   npm run version:bump -- patch              # 2.0.0 → 2.0.1 (багфикс под спецификацию)
 *   npm run version:bump -- minor              # 2.0.0 → 2.1.0 (новая фича/встроенный namespace)
 *   npm run version:bump -- major              # 2.0.0 → 3.0.0 (слом семантики языка)
 *   npm run version:bump -- 2.0.1              # выставить точное число (зеркалим эталон)
 *   npm run version:bump -- 2.0.1 2026-06-30   # ещё и точную дату ревизии (зеркало с другого дня)
 *
 * Второй аргумент (дата) нужен, когда зеркалишь правку не в тот же день, что и
 * эталон: чтобы REVISION совпала с эталоном, а не уехала на день вперёд.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const arg = process.argv[2];
const dateArg = process.argv[3];

if (!arg || arg === '-h' || arg === '--help') {
    console.error('Использование: npm run version:bump -- patch|minor|major|X.Y.Z [YYYY-MM-DD]');
    process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgFile = path.join(root, 'package.json');
const versionFile = path.join(root, 'src', 'version.ts');

let pkgText = readFileSync(pkgFile, 'utf-8');
const cur = pkgText.match(/"version":\s*"(\d+)\.(\d+)\.(\d+)"/);
if (!cur) {
    console.error('Не нашёл текущий "version" в package.json');
    process.exit(1);
}
let [major, minor, patch] = [Number(cur[1]), Number(cur[2]), Number(cur[3])];

let version;
const exact = arg.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (exact) {
    version = `${exact[1]}.${exact[2]}.${exact[3]}`;
} else if (arg === 'major') {
    version = `${major + 1}.0.0`;
} else if (arg === 'minor') {
    version = `${major}.${minor + 1}.0`;
} else if (arg === 'patch') {
    version = `${major}.${minor}.${patch + 1}`;
} else {
    console.error(`Непонятный аргумент: ${arg} (нужно patch|minor|major|X.Y.Z)`);
    process.exit(2);
}

if (dateArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    console.error(`Дата должна быть в формате YYYY-MM-DD, дано: ${dateArg}`);
    process.exit(2);
}
const revision = dateArg ?? new Date().toISOString().slice(0, 10);

pkgText = pkgText.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`);
writeFileSync(pkgFile, pkgText);

let vsrc = readFileSync(versionFile, 'utf-8');
vsrc = vsrc.replace(/VERSION:\s*'[^']*'/, `VERSION: '${version}'`);
vsrc = vsrc.replace(/REVISION:\s*'[^']*'/, `REVISION: '${revision}'`);
writeFileSync(versionFile, vsrc);

console.log(`package.json + version.ts → ${version} (${revision})`);
console.log(`Версия языка общая с эталоном — проверь, что в mslang.php то же число (php bin/bump.php ${version} ${revision}).`);
