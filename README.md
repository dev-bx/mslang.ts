# MSLang

Маленький встраиваемый язык скриптов на TypeScript, без внешних зависимостей. Собирается в одиночный UMD-файл (`dist/mslang.umd.js`, глобальное имя `DevBX.MSLang`) и в ESM (`dist/mslang.es.js`). Предназначен для запуска скриптов в браузере в рамках Bitrix DevBx, но работает и в Node.

У MSLang есть **зеркальная PHP-реализация** в [mslang.php](https://github.com/dev-bx/mslang.php) (см. ниже). Один и тот же исходник выполняется в обоих интерпретаторах с одинаковым результатом — это часть контракта проекта и проверяется в CI.

## Установка

```bash
npm install devbx.mslang
```

Или подключи `dist/mslang.umd.js` тегом `<script>` — будет доступен глобальный объект `DevBX.MSLang`.

## Быстрый старт

```ts
import {
    CodeLexer, CodeParser, Interpreter, ContextInterpreter,
    LexerTypeArray, LexerType,
} from 'devbx.mslang';

const lexer = new CodeLexer('return 1 + 2;');
const parser = new CodeParser(lexer);
const nodeList = [];
parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

const interpreter = new Interpreter();
interpreter.registerHandlers();

const ctx = new ContextInterpreter(nodeList, interpreter);
ctx.registerConst();

const result = ctx.exec(true);
console.log(result?.value); // 3
```

В UMD-сборке те же классы лежат в `DevBX.MSLang`:

```html
<script src="dist/mslang.umd.js"></script>
<script>
    const { CodeLexer, CodeParser, Interpreter, ContextInterpreter,
            LexerTypeArray, LexerType } = DevBX.MSLang;
    // ...
</script>
```

## Что умеет

- Литералы: числа, строки (одинарные/двойные кавычки), `true`/`false`/`null`/`undefined`/`NaN`/`Infinity`
- Арифметика, сравнения, логика, побитовое `&`, инкремент/декремент
- `if/else`, `switch/case/default` (с проваливанием), `for`, `while`, `break`, `continue`, `return`
- `try/catch/finally`, `throw`, `new Error(...)`, иерархии ошибок через `class MyError extends Error`
- Пользовательские функции с замыканиями и function-выражения (`x = function() { ... }`)
- Классы: `class Name [extends Parent] { constructor(...) {} method(...) {} }`, `new`, `this`, `super(...)`, `super.method(...)`, `instanceof`
- Function-конструктор старого JS-стиля: `function Foo(args) { this.x = ...; this.method = function() {...}; }` + `new Foo(...)`
- Массивы, доступ по индексу, ассоциативные ключи, `length`, распаковка (`...arr`)
- Объекты-хосты с методами и свойствами (`DateTime`, `Math`, плюс твои)
- Вызов через пространство имён (`Class::fn()`) и через метод (`obj.fn()`)
- Встраивание кода в текст через `{` / `}` (лексер распознаёт их как `ltStartCode`/`ltEndCode`)

Подробное описание языка, типов и приведений — в [MSLang.md](MSLang.md).

## Зеркало с PHP

PHP-реализация MSLang в [mslang.php](https://github.com/dev-bx/mslang.php) (`src/`) — **эталон** проекта. TypeScript-проект зеркалит PHP бит-в-бит:

- Имена классов: `CodeLexer`, `CodeParser`, `Interpreter`, `ContextInterpreter`, все `StackVariable*`, `MathFunctions`, `FunctionEntry`, `FunctionParameter`.
- Числовые значения констант (`VariableType`, `LexerType`, `NodeType`, `CompareType`, `InterpreterNodeType`, `ContextType`) — совпадают.
- Набор и имена тестов — совпадают (108/108).

Это проверяется тестом `npm run test:mirror` (читает оба набора файлов и валится при первом расхождении) и cross-runtime тестами в `tests/cross.ts` (тот же скрипт прогоняется через PHP и сверяется с эталоном).

Правило процесса: любая новая возможность делается **сначала в PHP**, затем 1:1 переносится в TS. Подробности — в [CONTRIBUTING.md](CONTRIBUTING.md).

## Тесты

```bash
npm test               # основной набор (75 тестов)
npm run test:bugs      # тесты-ловушки на известные баги (13)
npm run test:mirror    # зеркальная сверка констант TS↔PHP (19)
npm run test:cross     # cross-runtime сверка результатов (20)
npm run test:all       # всё вместе
npm run test:fuzz      # фаззер
npm run bench          # бенчмарки
```

PHP-сторона (в соседнем репозитории [mslang.php](https://github.com/dev-bx/mslang.php)):

```bash
cd /path/to/mslang.php && composer test
```

## Сборка

```bash
npm run build          # tsc + vite build → dist/{mslang.es.js, mslang.umd.js, types/}
```

## Лицензия

ISC. См. [LICENSE](LICENSE).
