# MSLang — справка по языку

Краткое описание языка. Подробности и крайние случаи — в тестах (`tests/tests.ts`, `tests/Test.php`).

## Запуск

Минимальный TS-пример:

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

В браузере подключи `dist/mslang.umd.js` — глобальный объект `DevBX.MSLang` экспортирует те же классы.

## Типы значений

| Тип       | `VariableType`  | Пример литерала    | Заметки                                            |
|-----------|-----------------|--------------------|----------------------------------------------------|
| undefined | `vtUndefined`   | `undefined`        | Свойство, которого нет; не путать с `null`         |
| void      | `vtVoid`        | (результат без `return`) | Пустой результат скрипта                    |
| null      | `vtNull`        | `null`             |                                                    |
| число     | `vtNumber`      | `42`, `3.14`       | `vtInteger`/`vtFloat` — алиасы того же значения    |
| строка    | `vtString`      | `"abc"`, `'abc'`   | Двойные и одинарные кавычки                        |
| булево    | `vtBoolean`     | `true`, `false`    |                                                    |
| массив    | `vtArray`       | `[1,2,3]`          | Также ассоциативный: `["k1" => 10]`                |
| объект    | `vtObject`      | `DateTime`, `Math` | Создаётся хостом, не литералом                     |
| функция   | `vtFunction`    | —                  | Возвращается из `obj.method`, отдельно не создаётся|

## Операторы

- Арифметика: `+`, `-`, `*`, `/`, `%`, `&`
- Сравнения: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Логика: `&&`, `||`, `!`
- Унарные: `+a`, `-a`, `++a`, `a++`, `--a`, `a--`, `!a`
- Присваивание: `a = 5`, `a[0] = 5`, `a.prop = 5`, `a.length = N`
- Каскадное присваивание: `a = b = 10`, `a[0] = a[1] = 5`
- Spread в аргументах: `f(...arr)`
- Spread в литерале массива: `[1, ...arr, 4]`

## Управление потоком

```mslang
if (a == 10) { ... } else { ... }

for (i = 0; i < 10; i++) { ... }

while (cond) { ... }

break;
continue;

return value;
```

Одна инструкция в теле без `{}`:

```mslang
for (i = 0; i < n; i++) sum = sum + i;
```

## Массивы

```mslang
a = [1, 2, 3];
a.length              // 3
a[0]                  // 1
a[a.length-1]         // 3
a.length = 2;         // усечение → [1, 2]
a[100] = "x";         // разреженный массив, length = 3 (count элементов)

// ассоциативные
b = ["key" => 10, "other" => 20];
b["key"]              // 10
b.keys()              // ["key", "other"]
b.values()            // [10, 20]

// методы
[1,2,3].push(4)       // вернёт 4 (новый length), [1,2,3,4]
[1,2,3].pop()         // 3
[1,2,3].shift()       // 1
[1,2,3].unshift(0)    // 4 (новый length), [0,1,2,3]
[1,2,3].join("-")     // "1-2-3"
[1,2,3].concat([4,5]).join()  // "1,2,3,4,5"
[1,2,3].reverse()     // [3,2,1]
[1,2,3].indexOf(2)    // 1
[1,2,3].contains(2)   // true
[1,2,3].flip()        // ["1" => 0, "2" => 1, "3" => 2]
[1,2,3].count()       // 3
```

## Строки

```mslang
"hello".length             // 5
"hello".indexOf("l")       // 2
"hello".indexOf("l", 3)    // 3
"hello".Contains("ll")     // true
"hello".StartsWith("he")   // true
"hello".EndsWith("lo")     // true
"hello".ToUpper()          // "HELLO"
"hello".ToLower()          // "hello"
"  abc  ".Trim()           // "abc"
"hello".SubString(1, 3)    // "el"
"a".Concat("b", "c", 1)    // "abc1"
```

## Числа и Math

```mslang
NaN.isNaN                  // true
Infinity.isFinite          // false
(1/0).isFinite             // false
(10).ToString()            // "10"

Math.PI
Math.E
Math.abs(-7)
Math.sqrt(2)
Math.pow(2, 10)
Math.max(1, 2, 3, ...arr)
Math.floor(1.7)
Math.round(1.5)
Math.random()
```

## Даты

```mslang
DateTime.Now                  // текущая дата+время как объект (секунды unix)
DateTime.Today                // полночь сегодня
DateTime.Now.Year             // 2026
DateTime.Now.Month            // 1..12
DateTime.Now.Day              // 1..31
DateTime.Now.Hour
DateTime.Now.Minute
DateTime.Now.DayOfWeek        // 0=воскресенье..6=суббота
DateTime.Today.AddDays(1)     // завтрашняя полночь
DateTime.Today.AddHours(9)
DateTime.Today.AddMinutes(15)
DateTime.Today.AddSeconds(30)
DateTime.Now > "2000-01-01 12:00:00"   // сравнение со строкой-датой
```

## Приведение типов (главные правила)

`+` — особый: если хоть один операнд после приведения к собственному типу — строка, обе стороны кастуются в строку и склеиваются. Иначе оба приводятся к числу.

```mslang
"a" + 1                  // "a1"
null + 5                 // 5
true + 5                 // 6     (true → 1, false → 0)
[1,2] + 1                // "1,21"    ([1,2].toPrimitive() = "1,2")
"val-" + [1,2]           // "val-array"  ([1,2].castAs(string) = "array")
```

`-`, `*`, `/`, `%`, `&` — всегда числовые. Строки и булевы кастуются в число (или NaN).

```mslang
"10" - 5                 // 5
true * 5                 // 5
"abc" - 5                // NaN
"7" & 3                  // 3
```

Унарные `+a`, `-a` — приводят к числу.

`!a`, `!!a` — приводят к булеву.

```mslang
!!""                     // false
!!"x"                    // true
!![]                     // false
!![1]                    // true
!!null                   // false
```

## Хост-объекты (интеграция с приложением)

Чтобы пробросить объект приложения в скрипт:

```ts
class Fields extends StackVariable {
    constructor() { super(VariableType.vtObject, true); }
    getProperty(name: string) {
        if (name === 'Number1') return new StackVariableNumber(true, 42);
        return undefined;
    }
    setProperty(name: string, value: StackVariable) { /* ... */ }
}

const ctx = createCodeContext('return Fields.Number1 + 1;');
ctx.setVariable('Fields', new Fields());
ctx.exec(true);   // 43
```

Чтобы пробросить функцию хоста — `StackVariableFunction` с `FunctionEntry` + `FunctionParameter`:

```ts
const fn = new FunctionEntry('greet', VariableType.vtString, (name: string) => 'Hello, ' + name);
fn.addParameter(new FunctionParameter('name', VariableType.vtString, true));
ctx.setVariable('greet', new StackVariableFunction(fn, null));
```

## Что ещё не сделано

- Регулярные выражения — нет.
- Импорт модулей — нет.

(`switch/case`, пользовательские функции, `try/catch/finally`, `throw`, `new Error()`, классы — `class Name [extends Parent] { ... }`, `new`, `this`, `super(...)`, `super.method(...)`, `instanceof`, иерархии ошибок через `class MyError extends Error`, function-конструктор старого JS-стиля — уже реализованы.)

## Лимиты выполнения

В `ContextInterpreter` есть `setLimitExecInstruction(n)` — после `n` шагов интерпретатор бросит `Execution limit ... exceeded`. По умолчанию ограничения нет. Используй, если запускаешь скрипты от пользователя.

```ts
const ctx = createCodeContext('for(i=0; i<1000000000; i++) {}');
ctx.setLimitExecInstruction(10000);
ctx.exec(true);  // бросит исключение после 10000 шагов
```

## Совместимость TS ↔ PHP

Гарантируется через CI: для каждого скрипта в `tests/scripts/` оба интерпретатора обязаны вернуть одно и то же значение. См. `CONTRIBUTING.md`.
