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
        // es2020 нужен для BigInt (64-битные битовые операции) и прочих фич.
        target: 'es2020',
        // Минификация выключена сознательно: при включении сначала нужен
        // keep_classnames/keepNames (funcEntryCache опирается на constructor.name).
        minify: false,
        // Не публикуем sourcemap (~1.2 МБ): сборка не минифицирована и читаема и так.
        sourcemap: false,
    },
});
