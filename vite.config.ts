import {defineConfig} from 'vite';

// Собираем оба формата:
//   mslang.umd.js — для подключения <script src="..."> и глобального DevBX.MSLang;
//   mslang.es.js  — для `import` в современных проектах через "exports" в package.json.
export default defineConfig({
    // Имена классов и функций сохраняются при минификации: funcEntryCache ключуется по
    // this.constructor.name (src/stackvariable.ts) — без имён классы получили бы чужую
    // таблицу методов.
    esbuild: {
        keepNames: true,
    },
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'DevBX.MSLang',
            fileName: (format) => `mslang.${format}.js`,
            formats: ['umd', 'es'],
        },
        rollupOptions: {
            external: [],
            output: {
                globals: {},
            },
        },
        // tsc заранее положил декларации в dist/types/, не стирать их.
        emptyOutDir: false,
        // es2020 нужен для BigInt (64-битные битовые операции) и прочих фич.
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: false,
    },
});
