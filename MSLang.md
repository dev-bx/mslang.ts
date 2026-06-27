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
| объект    | `vtObject`      | `{a: 1}`, `DateTime`| Литерал `{...}`, из `JSON.parse` или от хоста      |
| функция   | `vtFunction`    | —                  | Возвращается из `obj.method`, отдельно не создаётся|

## Операторы

- Арифметика: `+`, `-`, `*`, `/`, `%`, `&`
- Сравнения: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Логика: `&&`, `||`, `!` — как в JS: `&&`/`||` возвращают САМ операнд и коротко
  замыкаются (`6 && 1 → 1`, `0 || "x" → "x"`, `false && f() → f не вызывается`); `!` даёт булево.
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

// методы высшего порядка (колбэк-функция; колбэк получает (элемент, индекс, массив))
a.map(function(x){ return x * 2; })           // [2, 4, 6]
a.filter(function(x){ return x % 2 == 0; })   // [2]
a.reduce(function(acc, x){ return acc + x; }, 0)  // сумма
a.forEach(function(x){ /* побочный эффект */ })
a.find(function(x){ return x > 1; })          // первый подходящий элемент (иначе undefined)
a.findIndex(function(x){ return x > 1; })     // индекс первого подходящего (иначе -1)
a.some(function(x){ return x > 2; })          // есть ли хоть один
a.every(function(x){ return x > 0; })         // все ли подходят

// списочные методы (без колбэка)
a.slice(1, 3)              // новый срез (как JS); a не меняется
a.splice(1, 2, "x")        // удаляет 2 c позиции 1, вставляет "x"; ВОЗВРАЩАЕТ удалённые; меняет a
a.sort()                   // сортировка по СТРОКОВОМУ виду (компаратор JS по умолчанию); меняет a
[1, [2, [3]]].flat(2)      // [1, 2, 3]
Array.isArray(a)           // true
Array.from("abc")          // ["a", "b", "c"]  (из строки — по символам; из массива — копия)
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
"a,b,c".split(",")         // ["a", "b", "c"]   (обратное к join)
"a,b,c".split(",", 2)      // ["a", "b"]        (limit отбрасывает остаток, как JS)
"abc".split("")            // ["a", "b", "c"]   (по символам)
"x-y-x".replace("x", "Z")  // "Z-y-x"           (первое вхождение, литерально)
"x-y-x".replaceAll("x","Z")// "Z-y-Z"           (все вхождения)
"ab".repeat(3)             // "ababab"
"abcde".slice(1, -1)       // "bcd"  (end не включается; отрицательный индекс — от конца)
"42".padStart(5, "0")      // "00042"  (дополнить слева до длины)
"42".padEnd(5, "0")        // "42000"
"  hi  ".trimStart()       // "hi  "   (обрезать пробелы слева)
"  hi  ".trimEnd()         // "  hi"
```

`split`/`replace`/`replaceAll` работают с обычными строками (регулярных выражений пока нет).
`slice` режет по символам с JS-семантикой (в отличие от `SubString`, где второй аргумент — длина).

## Числа и Math

```mslang
NaN.isNaN                  // true
Infinity.isFinite          // false
(1/0).isFinite             // false
(10).ToString()            // "10"
(3.14159).toFixed(2)       // "3.14"  (фиксированное число знаков; деньги/проценты)
(2.5).toFixed(0)           // "3"     (половина округляется вверх)

Number.parseInt("120 руб") // 120     (ведущее целое из «грязной» строки)
Number.parseInt("0x1A")    // 26
Number.parseFloat("12.5px")// 12.5
Number.isInteger(5)        // true    (строго: "5" → false, без приведения)
Number.isNaN(0 / 0)        // true
Number.isFinite(1 / 0)     // false

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

### Числовая модель — IEEE-754 / JS

У MSLang один числовой тип. Поведение чисел следует стандарту IEEE-754 и JavaScript (решение от 2026-06-13). Оба движка (TS и PHP) обязаны давать здесь одинаковый результат:

- Деление на ноль не бросает: `5/0 → Infinity`, `-5/0 → -Infinity`, `0/0 → NaN`.
- Остаток `%` — вещественный: `(7/2) % 2 → 1.5`; `7 % 0 → NaN`.
- `Math.round` округляет половины к плюс-бесконечности: `round(-2.5) → -2`, `round(-0.5) → 0`, `round(2.5) → 3`.
- Строка превращается в число по правилам JS `Number()`: `"0x1A" → 26`, `"  5  " → 5`, `"" → 0`, `"Infinity" → Infinity`, всё прочее → `NaN`.
- Две числовые строки в `==` сравниваются как строки: `"1" == "01" → false`.
- Битовые `& | ^` и сдвиги — 64-битные (внутри через BigInt), а не 32-битные как в обычном JS: `0x100000000 | 1 → 4294967297`.

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

DateTime.fromTimestamp(1700000000)                 // дата из unix-времени (секунды)
dt.format("YYYY-MM-DD HH:mm:ss")                   // дата → строка по шаблону
dt.format("DD.MM.YYYY")                            // "14.11.2023"
DateTime.parse("14.03.2024", "DD.MM.YYYY")         // строка → дата по тому же шаблону
```

Шаблон `format`/`parse` — без локали. Токены: `YYYY` (год, 4 знака), `MM` (месяц 01-12),
`DD` (день), `HH` (час 00-23), `mm` (минута), `ss` (секунда); регистр важен (`MM`≠`mm`).
Прочие символы — буквально. Компоненты берутся в зоне из конфига (по умолчанию UTC).

## JSON

```mslang
JSON.parse('{"name":"Аня","age":30}').name    // "Аня"
JSON.parse('[10,20,30]')[1]                    // 20
JSON.parse('{"a":{"b":42}}').a.b               // 42
JSON.parse('plain', "default")                 // "default" (при ошибке разбора)

JSON.stringify(["id" => 1, "ok" => true])      // '{"id":1,"ok":true}'
JSON.stringify([1, 2, 3])                       // '[1,2,3]'
JSON.stringify(JSON.parse('{}'))                // '{}' (пустой объект и [] различаются)
JSON.stringify(0.1 + 0.2)                       // '0.30000000000000004'
```

- `JSON.parse(text [, default])` — разбирает строку JSON. Объект `{...}` становится объектом
  (тип `vtObject`, доступ `obj.key` и `obj["key"]`), массив `[...]` — массивом. При ошибке
  разбора возвращает `default` (если задан), иначе `undefined`; валидный `null` ошибкой не считается.
- `JSON.stringify(value)` — собирает компактную строку JSON. Список печатается как `[...]`,
  ассоциативный массив-карта и объект — как `{...}`. Числа печатаются как JS (`Number.toString`);
  `NaN`/`Infinity` → `null`; `undefined` в массиве → `null`, у ключа объекта — ключ выбрасывается.
  Кириллица и прочий не-ASCII — сырым UTF-8 (без `\u`), слэш не экранируется. Порядок ключей — как
  в JS: целые индексы по возрастанию, затем прочие по порядку вставки.

Объект — отдельный тип значения (внутри `StackVariablePlainObject`, по типу `vtObject`). Его
даёт литерал `{...}`, `JSON.parse` или хост.

## Литерал объекта

```mslang
{a: 1, b: 2}                       // ключ-имя
{"a-b": 1, "2": "x"}               // ключ-строка
{x: 1 + 2, y: cond ? "a" : "b"}    // значение — любое выражение
{user: {name: "Аня"}, ids: [1,2]}  // вложенность
{}                                 // пустой объект (не пустой массив)
o = {a: 1}; o.a                    // доступ через .key и o["key"]
```

Запись `{ key: value, ... }` строит тот же объект, что и `JSON.parse` (`StackVariablePlainObject`,
тип `vtObject`). Ключ — имя (`a`) или строка (`"a"`); значение — любое выражение. Висячая запятая
допустима; при повторном ключе побеждает последний (как в JS). Ключ — это имя буквально, а не
значение переменной с тем же именем. Порядок ключей при печати через `JSON.stringify` —
JS-каноничный (целые индексы по возрастанию, затем по вставке).

Развязка с блоком кода — по позиции, как в JS: `{` в начале инструкции это блок (тело `if`/`for`/
функции), а `{` там, где ждут значение (после `=`, `return`, `(`, `,`, `?`/`:`) — литерал объекта.
Поэтому объект-инструкцию заворачивают в скобки: `({a: 1})`. Ключи-числа без кавычек (`{1: x}`),
сокращённую запись (`{a}`) и вычисляемые ключи (`{[e]: x}`) пока не поддерживаем — используй строку.

## Перебор объекта (Object)

```mslang
o = JSON.parse('{"a": 1, "b": 2}');
Object.keys(o)        // ["a", "b"]
Object.values(o)      // [1, 2]
Object.entries(o)     // [["a", 1], ["b", 2]]

// полный обход: ключи + цикл + доступ по ключу
ks = Object.keys(o);
for (i = 0; i < ks.length; i++) { s = s + ks[i] + "=" + o[ks[i]] + ";"; }

// безопасный доступ по пути, проверка, слияние, сборка из пар
data = JSON.parse('{"user": {"city": "Москва"}}');
Object.get(data, "user.city", "нет")     // "Москва" (или default, если пути нет)
Object.has(data, "user.city")            // true
Object.assign(JSON.parse('{}'), a, b)    // слить карты в новый объект (правый побеждает)
Object.fromEntries([["a", 1], ["b", 2]]) // {"a":1,"b":2} — собрать объект из пар (без литерала)
```

`Object.keys/values/entries` работают с объектом (из `JSON.parse`), ассоциативным
массивом-картой, списком и строкой (перечисляется по символам, как в JS). Порядок ключей —
как в JS: целые индексы по возрастанию, затем прочие по порядку вставки. Не объект/массив/строка
→ пустой массив.

```mslang
Object.removeKey({a:1, b:2}, "a")        // {"b":2} — новый объект без ключа
Object.pick({a:1, b:2, c:3}, ["a","c"])  // {"a":1,"c":3} — только перечисленные ключи
Object.omit({a:1, b:2, c:3}, ["b"])      // {"a":1,"c":3} — без перечисленных ключей
Object.merge({a:{x:1}}, {a:{y:2}})       // {"a":{"x":1,"y":2}} — ГЛУБОКОЕ слияние (правый побеждает)
Object.isEmpty([])                        // true (пусто: null/undefined/""/[]/{}; 0 и false — НЕ пусто)
```

`removeKey/pick/omit/merge` возвращают НОВЫЙ объект, вход не меняют. `merge` сливает вложенные
объекты рекурсивно; массивы и скаляры — заменяет.

## typeof

```mslang
typeof 5            // "number"
typeof "x"          // "string"
typeof true         // "boolean"
typeof null         // "object" (как в JS)
typeof [1,2]        // "object"
typeof {a:1}        // "object"
typeof undefined    // "undefined"
typeof foo          // "function" (если foo — функция)
```

Унарный префиксный оператор как в JS (тот же приоритет, что у `!`): `typeof 1 + "!"` это
`(typeof 1) + "!"` → `"number!"`. Слово `typeof` зарезервировано.

## Форматирование чисел

```mslang
Number.roundTo(3.14159, 2)              // 3.14 (ЧИСЛО; округление как у toFixed)
Number.format(1234567.89, 2)           // "1,234,567.89" (строка, группировка по 3)
Number.format(1234567.89, 2, ",", " ") // "1 234 567,89" (свои разделители: дробь, тысячи)
```

`format` — без локали: разделители задаются явно (по умолчанию `.` и `,`). Округление — через
тот же `toFixed`, поэтому совпадает с `roundTo` и `num.toFixed(d)`.

## Кодировки и хэши

```mslang
Base64.encode("Hello")   // "SGVsbG8=" (base64 от UTF-8 байт)
Base64.decode("SGVsbG8=")// "Hello"
Url.encode("a b&c=д")    // "a%20b%26c%3D%D0%B4" (как JS encodeURIComponent)
Url.decode("a%20b")      // "a b"
Hash.md5("abc")          // "900150983cd24fb0d6963f7d28e17f72" (hex, 32 знака)
Hash.sha1("abc")         // "a9993e364706816aba3e25717850c26c9cd0d89d" (hex, 40 знаков)
Hash.crc32("abc")        // 891568578 (беззнаковое число 0..2^32-1)
```

`Url.encode` оставляет незакодированными `A-Za-z0-9-_.!~*'()`, всё прочее — `%XX` от UTF-8 байт.
`Base64`/`Url` round-trip'ят текст точно. Хэши считаются по UTF-8 байтам строки.

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
!![]                     // true   (любой массив — истина, как в JS)
!![1]                    // true
!!(0/0)                  // false  (NaN — ложь, как в JS)
!!null                   // false
```

Истинность — ровно как в JS: ложь только у `0`, `-0`, `NaN`, `""`, `null`,
`undefined`, `false`; всё прочее (любой массив, объект, строка `"0"`, дата,
хост-объект) — истина. Эту проверку даёт одна точка `Interpreter.isTruthy`,
поэтому `!x`, `if`/`while`/`for`, `?:`, `&&`/`||` и колбэки `filter`/`find`
видят одну и ту же истину. Это НЕ то же, что приведение в `==` (там NaN и
пустой массив ведут себя по правилам PHP — см. «Числовая модель»).

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

Интерпретатор — обходчик дерева (tree-walker) с `for`/`while`, поэтому скрипты от пользователя
надо запускать с бюджетом: иначе кривой `while (true) {}` повесит воркер. В `ContextInterpreter`
три независимых лимита (по умолчанию все выключены, `0` = без ограничения). Любой превышенный
бросает `ResourceLimitException`:

- `setLimitExecInstruction(n)` — максимум шагов интерпретатора. → `Execution limit [n] exceeded`.
- `setLimitExecTimeMs(ms)` — предельное время выполнения в миллисекундах (дедлайн по стенным
  часам). → `Execution time limit [ms] exceeded`.
- `setLimitAllocBytes(bytes)` — бюджет на создаваемые данные (строки/массивы/объекты).
  → `Allocation limit [n] exceeded`.

```ts
context.setLimitExecInstruction(100000);      // не больше 100k шагов
context.setLimitExecTimeMs(50);               // и не дольше 50 мс
context.setLimitAllocBytes(8 * 1024 * 1024);  // и не больше 8 МБ данных
context.exec(true);  // бросит ResourceLimitException при превышении любого из лимитов
```

Это и есть механизм песочницы: для недоверенных скриптов выставляй все три. Лимиты живут на
контексте, поэтому действуют и при повторном выполнении заранее разобранного скрипта (см. ниже).

## Детерминизм и кэширование (встраивание)

**Разбор отделён от выполнения.** Лексер+парсер дают плоский `ParseNode[]` — это «скомпилированный»
скрипт; интерпретатор его выполняет. Один и тот же `nodeList` можно выполнять много раз в РАЗНЫХ
свежих контекстах: всё состояние живёт в `ContextInterpreter`, сами узлы при выполнении не меняются.
Поэтому компилируй раз на версию скрипта и кэшируй `ParseNode[]` по хешу исходника, а на каждое
событие создавай новый контекст (на масштабе десятков тысяч запусков в день это снимает разбор с
горячего пути):

```ts
// один раз на версию скрипта — закэшируй nodeList по hash(src)
const lexer = new CodeLexer(src);
const parser = new CodeParser(lexer);
const nodeList: ParseNode[] = [];
parser.parseCode(nodeList, true, true, LexerTypeArray.one(LexerType.ltEof));

// на каждый запуск — свежий контекст, тот же nodeList и interpreter
const context = new ContextInterpreter(nodeList, interpreter);
context.registerConst();
const result = context.exec(true);
```

**Детерминизм (реплей, тесты).** `registerConst()` подключает в том числе НЕдетерминированные
встроенные функции: `Math.random()` (в PHP и JS разные источники — значения не совпадают между
движками и не повторяются между запусками), `DateTime.Now`/`DateTime.Today` (системные часы),
`debug(...)` (вывод в консоль). Свои хост-функции тоже регистрируй только чистые. Если важны
воспроизводимость и одинаковость движков — не полагайся на эти функции: время и случайность
подавай в скрипт снаружи как хост-значения (`setVariable`/конфиг). Отдельного API «зафиксировать
часы у `DateTime.Now`» или «режим без `Math.random`» сейчас нет — для строгой песочницы регистрируй
нужный чистый набор сам, не вызывая общий `registerConst()`. Бит-в-бит совпадения PHP↔TS гарантирует
ВСЁ, кроме `Math.random` (см. «Совместимость TS ↔ PHP»).

## Конфиг и `Env`

`ContextInterpreter` держит конфиг (хост-настройки), доступный скрипту через глобал `Env` (только чтение):

- `setConfigValue(key, value)` / `setConfig({...})` — задать значения для этого контекста;
- `getConfigValue(key, default)` — прочитать;
- `ContextInterpreter.setDefaultConfigValue(key, value)` — дефолт для всех контекстов.

Из скрипта: `Env.key` (неизвестный ключ → `undefined`).

```ts
const ctx = createCodeContext('return "app: " + Env.appName;');
ctx.setConfigValue('appName', 'shop');
ctx.exec(true);   // "app: shop"
```

### Таймзона

Ключ `timezone` — смещение от UTC, **только числовое** (чтобы JS и PHP не расходились на именованных зонах и DST). По умолчанию `0` (UTC). Принимает:

- целое число минут: `180` (UTC+3), `-300` (UTC-5);
- строку: `"+03:00"`, `"+0300"`, `"+03"`, `"180"`, `"UTC"`, `"Z"`.

Именованная зона (`"Europe/Moscow"`) или мусор — ошибка `Invalid timezone: "..."` (бросается при использовании `DateTime`).

Геттеры `DateTime` (`Year`/`Hour`/…/`Time`), `toString` и `toPrimitive` считаются в зоне конфига детерминированно — один и тот же момент даёт одинаковый результат в TS и PHP. `toPrimitive` → ISO 8601 с числовым смещением, напр. `2024-06-01T15:10:00+03:00`.

```ts
const ctx = createCodeContext('return DateTime.Now.Hour;');
ctx.setConfigValue('timezone', 180);   // UTC+3
```

## Совместимость TS ↔ PHP

Гарантируется через CI: для каждого скрипта в `tests/scripts/` оба интерпретатора обязаны вернуть одно и то же значение. См. `CONTRIBUTING.md`.

Единственное намеренное исключение — `Math.random()`: в PHP и в JS это разные источники
случайности, поэтому значения между движками не совпадают (и не повторяются между запусками).
Если нужна одинаковость движков или воспроизводимость — не используй `Math.random()`, а подавай
случайность снаружи как хост-значение. Всё остальное (числа, строки, даты, JSON, `Base64`/`Url`,
хэши `md5`/`sha1`/`crc32`, порядок ключей объекта) совпадает бит-в-бит.
