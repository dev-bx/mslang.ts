import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',  // Точка входа
      name: 'DevBX.MSLang',
      fileName: (format) => `mslang.${format}.js`,  // Имя выходных файлов
      formats: ['umd'],       // Только UMD для браузера
    },
    rollupOptions: {
      external: [],  // Нет внешних зависимостей
      output: {
        globals: {},  // Пусто, т.к. нет externals
      },
    },
    target: 'es2015',  // Цель для браузера
    minify: false,     // Отключите минификацию для отладки (опционально)
    sourcemap: true,   // Генерировать source maps
  },
});