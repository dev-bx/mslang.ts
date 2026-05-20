import {defineConfig} from 'vite';

// Собираем оба формата:
//   mslang.umd.js — для подключения <script src="..."> и глобального DevBX.MSLang;
//   mslang.es.js  — для `import` в современных проектах через "exports" в package.json.
export default defineConfig({
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
        target: 'es2015',
        minify: false,
        sourcemap: true,
    },
});
