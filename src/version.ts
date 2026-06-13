// Зеркало PHP Version: версия (MAJOR.MINOR.PATCH) и дата ревизии — ручные
// константы. VERSION синхронизируется из package.json/git-тега скриптом
// scripts/sync-version.mjs; REVISION правится вручную при релизе.
export const Version = {
    VERSION: '2.0.0',
    REVISION: '2026-06-14',

    getFullVersion(): string {
        return `${this.VERSION} (${this.REVISION})`;
    },
};
