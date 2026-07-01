// Зеркало PHP Version: версия (MAJOR.MINOR.PATCH) и дата ревизии. Обе константы
// двигает scripts/bump-version.mjs (npm run version:bump). VERSION при сборке ещё
// и подтягивается из package.json через scripts/sync-version.mjs — на случай, если
// их забыли свести вручную. Версия языка общая с PHP-эталоном (сверяет mirror_Version).
export const Version = {
    VERSION: '2.1.0',
    REVISION: '2026-07-01',

    getFullVersion(): string {
        return `${this.VERSION} (${this.REVISION})`;
    },
};
