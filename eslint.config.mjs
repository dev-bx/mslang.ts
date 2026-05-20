import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', '*.config.*'],
    },
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            // Поверхностные «дешёвые» правила. Не превращаем lint в боль —
            // ловим то, что реально вредит: мёртвый код, забытые отладочные
            // выводы, недостижимые ветки.
            'no-unreachable': 'error',
            'no-undef': 'off', // TS сам это проверяет
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-debugger': 'error',
            'no-console': ['warn', { allow: ['error', 'warn'] }],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^(_|t$)',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['warn', 'smart'],
        },
    },
];
