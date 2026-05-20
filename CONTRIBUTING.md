# CONTRIBUTING

Этот документ описывает, как правильно вносить изменения в MSLang. Главное правило: проект **зеркальный**, реализация живёт одновременно в TypeScript и в PHP, и обе обязаны вести себя одинаково.

## Где что лежит

| Часть              | TypeScript                            | PHP                                                                       |
|--------------------|---------------------------------------|---------------------------------------------------------------------------|
| Исходники          | `src/`                                | `../php/src/`                                                              |
| Тесты              | `tests/tests.ts`                      | `../php/tests/Test.php`                                                    |
| Тесты-ловушки      | `tests/bugs.ts`                       | `../php/tests/TestBugs.php`                                                |
| Cross-runtime      | `tests/cross.ts` + `tests/scripts/`   | `../php/tests/CrossRuntimeTest.php` (использует те же `scripts/`)          |
| Сторож констант    | `tests/mirror.ts`                     | —                                                                          |
| Lint               | `eslint.config.mjs` → `npm run lint`  | `phpstan.neon` → `composer lint`                                           |

## Главное правило: PHP — эталон

Любая новая возможность (фича, обработчик узла, метод на `StackVariable*`, константа, изменение алгоритма) делается **сначала в PHP**, затем 1-в-1 переносится в TS.

Отклонения допустимы только там, где их вынуждает специфика языка:
- `mb_strlen` в PHP ↔ `string.length` в TS,
- `array_slice` ↔ `Array.prototype.slice`,
- `setTimestamp($seconds)` в PHP принимает секунды напрямую ↔ в JS `new Date(ms)` хочет миллисекунды.

Если в TS появилось что-то, чего нет в PHP, — это ошибка процесса. Сначала добавь в PHP, потом сюда.

## Жёсткие правила

1. **Константы совпадают бит-в-бит.** `VariableType`, `LexerType`, `NodeType`, `CompareType`, `InterpreterNodeType`, `ContextType` — численные значения и имена должны быть одинаковы. Сторожит `npm run test:mirror`.
2. **Набор обработчиков узлов одинаков.** Любой `NodeType`, у которого есть `registerNodeHandler` в одной реализации, должен иметь обработчик и в другой. Сторожит тот же `mirror`.
3. **Набор методов `funcInvoke*` у пары классов одинаков.** Если в `StackVariableArray` появился новый метод — добавь в обе реализации. Сторожит `mirror`.
4. **Поведенческие тесты сторожат идентичный результат.** Кладёшь `tests/scripts/NAME.msl` + `NAME.expected`, оба runner'а (TS и PHP) обязаны вернуть `expected`. Любое расхождение — это баг.

## Что запускать перед коммитом

TypeScript:
```bash
npm install
npx tsc --noEmit
npm run lint
npm test
npm run test:bugs
npm run test:mirror
npm run test:cross
```

PHP (в соседнем репозитории [mslang.php](https://github.com/dev-bx/mslang.php)):
```bash
composer install
composer lint   # phpstan
composer test   # phpunit
```

Всё это запускается автоматически в CI на каждом push/PR — см. `.github/workflows/ci.yml`.

## Стиль кода

- Файлы — UTF-8, LF, 4 пробела (см. `.editorconfig`).
- Ошибки в рантайме — только через `LexerException`, `ParserException`, `InterpreterException`, `MSLangException` (с позицией курсора, где уместно). Голые `throw new Error()` запрещены — это техдолг.
- Сообщения исключений писать одинаково в TS и PHP (тесты сверяются по regex).
- Комментарии в исходниках на русском (так исторически).

## Как добавить новый узел / оператор / метод

1. **PHP.** Добавь `const ntFoo` в `NodeType.php`, обработчик в `Interpreter.php`, парсинг в `CodeParser.php`. Если это новый метод на `StackVariable*` — добавь `funcInvoke_foo()` / `funcInvokeFoo()`.
2. **PHP тесты.** Положи `testMSLang0XX_Foo` в `Test.php`. Если поведение должно совпадать с TS — также `tests/scripts/0XX-foo.msl` + `.expected`.
3. **TS.** Зеркали в `src/parser.ts` (`NodeType`), `src/interpreter.ts` (handler), и т.д. Зеркальный тест констант скажет, если число не совпало.
4. **TS тесты.** Зеркальный тест в `tests/tests.ts`.
5. **CI.** Если оба ряда тестов прошли локально — пушь.

## Известные ограничения

- `switch`/`case` зарезервированы в лексере, но не реализованы в парсере. Если будем брать — обновить обе реализации одновременно.
- `Math.acosh(2)` даёт `1.3169578969248168` в PHP и `…66` в TS — это разница в реализации `acosh` стандартными библиотеками. Считается известным расхождением (см. `Test::testMSLang025`).
- PHP PHPStan настроен на **уровень 7** с baseline (`phpstan-baseline.neon`): 476 старых ошибок заморожены, новый код проверяется строго. Когда правишь старый код — старайся убирать соответствующие записи из baseline, чтобы он постепенно сжимался.
