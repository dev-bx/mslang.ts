#!/usr/bin/env node
/*
 * Подтягивает VERSION в src/version.ts из version в package.json — на случай,
 * если их забыли свести вручную (обычно это делает scripts/bump-version.mjs).
 * REVISION (дата релиза) — отдельная константа, скрипт её НЕ трогает, чтобы
 * `vite build` не пачкал дерево датой сборки.
 *
 * Источник истины версии в этом репозитории — package.json (его двигает бамп).
 * Git-тег источником НЕ считаем: после бампа свежего тега может не быть, и тогда
 * старый тег вернул бы устаревшую версию. Зеркало PHP Version. Перезаписывает,
 * только если VERSION реально разошёлся.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(root, 'src', 'version.ts');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));
const version = pkg.version ?? '0.0.0';

const current = readFileSync(versionFile, 'utf-8');
const next = current.replace(/VERSION:\s*'[^']*'/, `VERSION: '${version}'`);

if (current === next) {
    process.exit(0);
}

writeFileSync(versionFile, next);
console.log(`version.ts → VERSION ${version}`);
