#!/usr/bin/env node
/*
 * Подставляет в src/version.ts:
 *   Num   — последний git-тег (без префикса v) или version из package.json,
 *   Build — дата сборки в формате YYYY-MM-DD.
 *
 * Запускается перед `vite build`. Скрипт идемпотентный: если src/version.ts
 * уже содержит нужные значения, ничего не пишет (чтобы не дёргать mtime).
 */
import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(root, 'src', 'version.ts');

function gitDescribe() {
    try {
        return execSync('git describe --tags --abbrev=0', {cwd: root, stdio: ['ignore', 'pipe', 'ignore']})
            .toString().trim().replace(/^v/, '');
    } catch {
        return null;
    }
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));
const num = gitDescribe() ?? pkg.version ?? '0.0.0';
const build = new Date().toISOString().slice(0, 10);

const next = `export const Version = {
    Num: '${num}',
    Build: '${build}',
};
`;

const current = readFileSync(versionFile, 'utf-8');
if (current === next) {
    process.exit(0);
}

writeFileSync(versionFile, next);
console.log(`version.ts → ${num} (build ${build})`);
