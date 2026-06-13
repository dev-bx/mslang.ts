#!/usr/bin/env node
/*
 * Синхронизирует VERSION в src/version.ts с последним git-тегом (без префикса v)
 * или version из package.json. REVISION (дата релиза) — ручная константа, скрипт
 * её НЕ трогает, чтобы `vite build` не пачкал дерево датой сборки.
 *
 * Зеркало PHP Version (VERSION/REVISION/getFullVersion). Идемпотентный: пишет,
 * только если VERSION реально изменился.
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
const version = gitDescribe() ?? pkg.version ?? '0.0.0';

const current = readFileSync(versionFile, 'utf-8');
const next = current.replace(/VERSION:\s*'[^']*'/, `VERSION: '${version}'`);

if (current === next) {
    process.exit(0);
}

writeFileSync(versionFile, next);
console.log(`version.ts → VERSION ${version}`);
