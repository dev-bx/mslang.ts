<!--
  Сгенерировано кросс-аудитом PHP↔TS зеркал MSLang.
  Дата: 2026-06-13 | Ветка: feature/sandbox-limits
  Базовые метрики на момент аудита:
    TS  — tests 194 / bugs 52 / limits 10 (все зелёные); mirror-тест констант зелёный.
    PHP — 308 тестов зелёные (1 предупреждение: NAN→int cast Interpreter.php:1747).
  Метод: 27 модульных срезов с состязательной проверкой критичных находок,
         фазы оптимизаций (35 возможностей) и тест-парности, синтез с критиком.
  Подтверждено независимой перепроверкой по строкам: P0-2, P0-3, P0-11, битовые 32/64.
  Это план, а не применённые правки. Правило №0: PHP — эталон, правки PHP-first где указано.
-->

# ROADMAP: выравнивание TS-зеркала MSLang с PHP-эталоном

> Правило №0 действует везде: **PHP — единственный эталон**. TS обязан повторять PHP бит-в-бит (имена полей, состав childItems, имена обработчиков, числовые значения констант, алгоритмы, тексты/коды ошибок). Отклонения допустимы только там, где их вынуждает специфика языка (`mb_strlen` против `string.length`, `Proxy` для передачи по ссылке, `null` против `undefined` и т.п.). Каждая правка ниже указывает, **какой репозиторий правится первым**.

---

## 1. Резюме здоровья парности

Числовые таблицы констант (`VariableType`, `LexerType`, `NodeType`, `CompareType`, `InterpreterNodeType`, `ContextType`) совпадают бит-в-бит — зеркальный тест констант (`npm run test:mirror`) зелёный. Ядро лексера, парсера, диспетчеризации стек-машины, поток управления (try/catch/switch/for/while/return) и лимиты песочницы перенесены аккуратно. Но накопился набор подтверждённых расхождений поведения, которые на одном и том же исходнике MSLang дают **разный результат** в двух движках: усечённый/смещённый `SubString`, текстовое сравнение двух числовых строк, деление на ноль, целочисленный остаток `%`, приведение строки к числу, потеря символов вне BMP в `fromCharCode`, неверный тип у свойства `.Time`, отсутствие класса `StackVariableVoid`. Отдельно — пропуски тестов (bugs.ts отстал 52 против 65), сломанный фаззер (главный инструмент поиска расхождений сейчас бесполезен), а также вопрос разъезда версии (по итогам разбора — гигиена метаданных, не дефект рантайма).

Светофор по модулям (🟢 совпадает / 🟡 мелкий дрейф / 🔴 есть подтверждённое расхождение поведения или критичный пропуск):

| Модуль | Статус | Короткий комментарий |
|---|---|---|
| Лексер (tokenization) | 🟡 | Числа/таблицы совпадают; теряется префикс `[line:col]`, расходятся тексты ошибок |
| Парсер: ядро/приоритеты | 🟡 | Выключена проверка зарезервированных слов; лишние ветки `EndCompareType` и `ntArrayPushSeparatorKey` |
| Парсер: литералы | 🔴 | Литерал-массив как значение ассоциативного ключа (`['k' => [1,2,3]]`) разбирается по-разному |
| Парсер: операторы/инструкции | 🔴 | `for` через `parseCompare` вместо `parseExpression` — голое небулевое условие даёт разный результат |
| Интерпретатор: диспетчеризация | 🟡 | Совпадает; нет класса `ContextException` (бросается базовый) |
| Интерпретатор: операторы/приведения | 🔴 | Деление на ноль, остаток `%`, строка→число, битовые 32 против 64 бит расходятся |
| ContextInterpreter: состояние/области | 🟢 | Высокая зеркальность, отличия вынуждены языком |
| Интерпретатор: классы/super/this | 🟢 | Точное зеркало, mirror-тест 19/19 |
| Интерпретатор: поток управления | 🟢 | Полная зеркальность |
| Интерпретатор: лимиты песочницы | 🟢 | Точное зеркало, 9/9 тестов |
| StackVariable (base) | 🔴 | Нет `offsetGet`/`offsetSet`; опечатка `constructor.name`; мелкие отличия диспетчера свойств |
| StackVariableArray | 🔴 | `contains`/`indexOf` падают на null-игле; новые массивы не списывают бюджет данных |
| StackVariableString | 🔴 | `SubString` (длина против конечного индекса), `charCodeAt`/`charAt`, строка→число |
| StackVariableNumber | 🟡 | `compare` бросает голый `Error`; потерян ранний `return $this` |
| StackVariableClass | 🟢 | Ядро совпадает; отличия — общесистемная конвенция исключений |
| StackVariableDateTime | 🔴 | `.Time` отдаёт DateTime вместо числа; формат `toPrimitive`; рассинхрон таймзоны |
| StackVariableRef | 🟡 | Нет защиты `getRefValue` от исчезнувшей переменной; нет контекста |
| StackVariableUserFunction | 🟡 | rest-массив не списывает бюджет данных |
| StackVariable мелкие (void/object) | 🔴 | Нет класса `StackVariableVoid`; `StackVariableObject` не переопределяет `castAs` |
| MathFunctions | 🔴 | `round` отрицательных половин расходится |
| StringStaticFunctions | 🔴 | `fromCharCode` теряет символы вне BMP |
| ArrayConstructor + Builtin | 🔴 | `new Array(NaN/Infinity/"abc")` возвращает массив вместо ошибки; нет интерфейса builtin |
| phpsemantics / loose equality | 🔴 | Две числовые строки сравниваются текстом, а не как числа |
| ParseNode / типы узлов | 🟡 | Обратный порядок поиска имени; голый `Error` в `nodeChildren` |
| Исключения | 🔴 | Нет `ContextException`/`ParserNodeException`; переименован `ParserCursorException`; нет префикса `[line:col]` |
| Version + публичный интерфейс | 🟡 | Разъезд имён полей/значений версии (метаданные); нет `getFullVersion` |

---

## 2. P0 — критические расхождения

Сюда входят только находки, **подтверждённые прямой проверкой** (`verdict.isReal === true`) и дающие разный результат на валидном входе.

> **Обновление от 2026-06-13 (решение владельца).** Эталон — это спецификация поведения, а не реализация PHP. Числовая модель MSLang — **IEEE-754 / JS**. Строковое приведение к числу и сравнение числовых строк — тоже по JS. Битовые — 64-битные через BigInt в обоих движках. Это переставляет направление правок: там, где TS уже верен по спецификации, а ошибается PHP, правка идёт **в PHP первой как багфикс** (это не «PHP под TS», а исправление PHP по спецификации).

Итоговое направление по каждому P0 (верна эта таблица; карточки ниже сохранены ради точных локаций `file:line`, и где их совет «правка только TS» противоречит таблице — верна таблица):

| P0 | Что | Спецификация (как надо) | Кто отступает → правка |
|---|---|---|---|
| P0-1 | `"1" == "01"` | `false` (строки как строки, JS) | PHP даёт `true` → **fix PHP** |
| P0-2 | `'abcdef'.SubString(1,3)` | `'bcd'` (2-й арг = длина) | TS даёт `'bc'` → **fix TS** (+ имя метода) |
| P0-3 | `-5/0` · `0/0` · `5/0` | `-Inf` · `NaN` · `+Inf` (IEEE) | PHP даёт `INF` всем → **fix PHP** |
| P0-4 | `(7/2)%2` · `7%0` | `1.5` · `NaN` (fmod) | PHP усекает к int / бросает → **fix PHP** |
| P0-5 | `"0x1A"→число` · `"Infinity"` | `26` · `Infinity` (JS `Number()`) | PHP даёт `NaN` → **fix PHP** |
| P0-6 | `[1,null].Contains(null)` · `IndexOf(true)` | `true` · `0` (по равенству) | PHP `false` / TS бросает → **fix both** |
| P0-7 | `round(-2.5)` · `round(-0.5)` | `-2` · `0` (half-up, JS) | PHP даёт `-3` / `-1` → **fix PHP** |
| P0-8 | `fromCharCode(128512)` | `😀` (код-поинт) | TS даёт мусор → **fix TS** (→ `fromCodePoint`) |
| P0-9 | `new Array(NaN/Inf/"abc")` | `throw` | TS возвращает массив → **fix TS** |
| P0-10 | `dt.Time` | число | TS даёт объект → **fix TS** |
| P0-11 | `castAs(void→number/bool)` | `NaN` / `false` | TS: нет класса `StackVariableVoid` → **fix TS** |
| P0-12 | сломанный фаззер | работает | TS-тулинг → **fix TS** (импорт) |
| P1-20 | `0x100000000 \| 1` | 64-бит (`4294967297`) | оба расходятся → **fix both** (BigInt) |

Под итоговой моделью **в PHP-эталоне правятся: P0-1, P0-3, P0-4, P0-5, P0-7**; **обе стороны: P0-6**; **в TS: P0-2, P0-8, P0-9, P0-10, P0-11, P0-12, P1-20**. (Уточнение по факту реализации: битовые `P1-20` в PHP уже 64-битные — менялся только TS на BigInt; `P0-9` дополнительно убрал предупреждения `(int)NAN` в PHP-эталоне.) Полная матрица зеркальных тестов — в разделе «2бис».

> **✅ Реализовано 2026-06-13.** Все P0 исправлены PHP-first как багфиксы, закрыты зеркальными тестами в `bugs.ts`/`TestBugs.php`, оба набора зелёные, кросс-движковые результаты совпадают. Детали — в §2бис. Карточки P0-1…P0-12 ниже сохранены как исторический разбор (их совет «правка только TS» там, где модель решила иначе, отменён таблицей выше).

Открытый вопрос (вне P0): полная JS-модель равенства затрагивает и смешанные случаи (`null == 0`, `NaN == true`) — это отдельная развилка, выходящая за рамки P0; пока не трогаем, выносится отдельным решением владельца.

### P0-1. Две числовые строки сравниваются текстом, а не как числа
- **Где:** `src/phpsemantics.ts:85` (`if (typeof a==='string' && typeof b==='string') return a === b;`). Эталон — нативный PHP `==` через `php/src/StackVariable.php:303`.
- **Симптом (прогон обоих движков):** `"1"=="01"`, `"10"=="1e1"`, `"1.0"=="1"`, `"007"=="7"` — PHP `true`, TS `false`; зеркально `!=` даёт обратное. Бьёт по `==`, `!=` и `switch/case` (через `compare ctEqual`).
- **Почему не специфика языка:** в `phpsemantics.ts` уже есть `phpParseNumericString` (используется в ветке число-vs-строка), её просто не применили к ветке строка-vs-строка.
- **Правка (только TS):** при двух строках сначала разобрать обе через `phpParseNumericString`; если обе — числа, сравнивать численно (`na === nb`), иначе текстом `a === b`. NaN-проверку из черновика рекомендации **не добавлять** — это мёртвый код (`phpParseNumericString` не возвращает NaN).
- **Готово, когда:** добавлены зеркальные тесты `"1"=="01"`→true, `"10"=="1e1"`→true, `"007"=="7"`→true, `"abc"=="abc"`→true, `"abc"=="abcd"`→false и их `!=`-варианты в `tests/tests.ts` и `php/tests/Test.php`; оба зелёные.

### P0-2. `SubString`: второй аргумент — длина (PHP) против конечного индекса (TS)
- **Где:** `src/stackvariablestring.ts:213-225` (`this.value.substring(start, end)`). Эталон — `php/src/StackVariableString.php:92-95` (`mb_substr($value, $start, $end)`, где третий параметр — длина).
- **Симптом:** `'abcdef'.SubString(1,3)` — PHP `'bcd'`, TS `'bc'`; `'abcdef'.SubString(-3,2)` — PHP `'de'`, TS `'c'`. Текущие тесты совпадают случайно (только `start=0` или без второго аргумента).
- **Доп. отклонение в той же функции:** TS вручную нормализует отрицательный `start` (`start = this.value.length+start`), чего PHP не делает — он отдаёт сырой отрицательный `start` в `mb_substr`.
- **Правка (только TS):** воспроизвести `mb_substr` (start как смещение, второй параметр как **длина**, поддержка отрицательного start и отрицательной длины), а не голый `substring`/`substr`.
- **Готово, когда:** добавлены зеркальные тесты `SubString(start, len)` при `start != 0` и заданной длине, в т.ч. отрицательный start; совпадают в обоих движках.

### P0-3. Деление на ноль
- **Где:** `src/interpreter.ts:884` (`leftTmp.value / rightTmp.value`). Эталон — `php/src/Interpreter.php:619-623` (при `rightTmp == 0` результат всегда `INF`).
- **Симптом:** `-5/0` — PHP `INF`, TS `-Infinity`; `0/0` — PHP `INF`, TS `NaN`. `5/0` совпадает.
- **Правка (только TS):** перед делением `if (rightTmp.value === 0) variable = createVariable(vtNumber, Infinity); else …`.
- **Готово, когда:** тесты на `-5/0`, `0/0`, `5/0` зелёные в обоих движках.

### P0-4. Остаток `%`: целочисленный (PHP) против плавающего (TS)
- **Где:** `src/interpreter.ts:903` (`(leftTmp.value) % (rightTmp.value)`). Эталон — `php/src/Interpreter.php:1683` (PHP `%` усекает оба операнда к int).
- **Симптом:** `(7/2) % 2` — PHP `1`, TS `1.5`; `7 % 0` — PHP `DivisionByZeroError`, TS `NaN`. Достижимо без дробных литералов, т.к. `/` даёт float.
- **Правка (только TS):** `Math.trunc(left) % Math.trunc(right)`; делитель 0 обработать как в PHP (сверить точный текст/код ошибки с эталоном).
- **Готово, когда:** тесты на `(7/2) % 2`, `-7.5 % 2`, `7 % 0` зелёные в обоих движках.

### P0-5. Строка → число: `is_numeric`+`trim` (PHP) против голого `Number()` (TS)
- **Где:** `src/stackvariablestring.ts:89-90` (`Number(this.value)`). Эталон — `php/src/StackVariableString.php:156-163` (trim; пусто→0; `is_numeric`?`(float)`:`NaN`).
- **Симптом:** `'0x1A'`→PHP `NaN`/TS `26`; `'0b101'`→PHP `NaN`/TS `5`; `'Infinity'`→PHP `NaN`/TS `Infinity`. Кормит все арифметические операторы над строковыми операндами.
- **Правка (только TS):** trim; пустая→0; проверка в духе `is_numeric` (десятичный/экспоненциальный формат, без hex/bin/oct/`Infinity`); иначе `NaN`.
- **Готово, когда:** зеркальные тесты на `'0x1A'`, `'0b101'`, `'Infinity'`, обычные `'10'`/`'1e3'`/`'abc'` зелёные.

### P0-6. `Array.contains`/`indexOf` падают на null-игле и иначе сравнивают булевы
- **Где:** `src/stackvariablearray.ts:157` и `:193` (`(searchValue as string).toString()`). Эталон — `php/src/StackVariableArray.php:86,110` (нативный `(string)`-каст).
- **Симптом:** `[1,null].Contains(null)` — PHP `false`, TS **бросает** `Cannot read properties of null (reading 'toString')`; `[true,false].IndexOf(true)` — PHP `-1`, TS `0`.
- **Правка (только TS):** привести иглу к строке по правилам PHP `(string)`: `null`/`false`→`''`, `true`→`'1'`, число — как PHP. Удобно через общий хелпер в `phpsemantics.ts`.
- **Готово, когда:** зеркальные тесты на null-иглу и bool-иглу для `Contains`/`IndexOf` зелёные.

### P0-7. `Math.round` отрицательных половин (правка идёт первой в **PHP**)
- **Где:** PHP `php/src/MathFunctions.php:203-206` (`round()` — от нуля), TS `src/mathfunctions.ts:400-403` (`Math.round` — к +∞).
- **Симптом:** `round(-2.5)` — PHP `-3`, TS `-2`; `round(-0.5)` — PHP `-1`, TS `-0`.
- **Особый случай направления:** проект сознательно зеркалит JS-семантику `Math` (так уже подогнаны `trunc`/`sign`/`acosh` — PHP под JS). Поэтому **эталоном здесь выбрана JS-семантика `Math.round`**, и правка PHP-first: в `MathFunctions.php` сделать `round` как `floor($x + 0.5)` (half-up). TS уже соответствует и **не меняется**.
- **Готово, когда:** PHP даёт `round(-2.5)`→`-2` (`floor(-2.5+0.5)=floor(-2)=-2`) **и** `round(-0.5)`→`0` (`floor(-0.5+0.5)=floor(0)=0`); добавлены зеркальные тесты `Math.round(-2.5)` и `Math.round(-0.5)` в оба набора, проверяющие обе границы.

### P0-8. `String.fromCharCode` теряет символы вне BMP
- **Где:** `src/stringstaticfunctions.ts:27` (`String.fromCharCode(code | 0)`). Эталон — `php/src/StringStaticFunctions.php:44-46` (`mb_chr`).
- **Симптом:** код `128512` (😀) — PHP «😀», TS мусорный код-юнит. ASCII совпадает.
- **Правка (только TS):** `String.fromCodePoint` вместо `fromCharCode`; приведение к целому `Math.trunc(Number(n.value))` (не `| 0`); guard на недопустимый код (`i < 0 || i > 0x10FFFF` → пропуск/`''`, как `mb_chr → false`).
- **Готово, когда:** зеркальные тесты на BMP-символ (`1103`→`'я'`) и astral (`128512`→`'😀'`) в `tests/bugs.ts` и `php/tests/TestBugs.php`.

### P0-9. `new Array(NaN / Infinity / "abc")` возвращает массив из 1 элемента вместо ошибки
- **Где:** `src/arrayconstructor.ts:44-61` (гейт `Number.isFinite`). Эталон — `php/src/ArrayConstructor.php:61-78` (гейт `is_numeric`, отбраковка `NaN`/`Inf`/дробного/отрицательного внутри ветки).
- **Симптом:** `new Array(NaN)`/`new Array("abc")`/`new Array(Infinity)` — PHP бросает `Invalid array length: NAN`/`INF`, TS молча даёт `[NaN]`/`[Infinity]`.
- **Правка (только TS):** убрать гейт `Number.isFinite`; входить в ветку при числе (`asNumber !== null` и значение — number); внутри либо материализовать (`n >= 0 && Number.isInteger(n)`), либо `throw 'Invalid array length: ' + asNumber.value`. Сверить текст: PHP печатает `NAN`/`INF` — привести формат сообщения к PHP.
- **Готово, когда:** зеркальные тесты на `new Array(NaN)`, `new Array(Infinity)`, `new Array("abc")` бросают ту же ошибку (включая текст `NAN`/`INF`) в обоих движках.

### P0-10. `StackVariableDateTime.Time` отдаёт DateTime вместо числа
- **Где:** `src/stackvariabledatetime.ts:97-106` (оборачивает в `new StackVariableDateTime(...)`). Эталон — `php/src/StackVariableDateTime.php:119-129` (`createStackVariableNumber`).
- **Симптом:** `.Time` в TS имеет тип `vtObject`, у него работает `.AddDays(1)` и иная арифметика/сравнение; в PHP это число `vtNumber`. Соседние геттеры (`Minute`, `DayOfWeek`) уже возвращают число — `Time` выпадает.
- **Правка (только TS):** вернуть `new StackVariableNumber(true, (d.getHours()*60*60)+(d.getMinutes()*60)+d.getSeconds())`.
- **Готово, когда:** тест на тип результата `dt.Time` (`vtNumber`) и его участие в арифметике зелёный в обоих движках.

### P0-11. Класс `StackVariableVoid` отсутствует в TS
- **Где:** `src/interpreter.ts:4160-4161` создаёт `new StackVariable(VariableType.vtVoid)`; файла `stackvariablevoid.ts` нет. Эталон — `php/src/StackVariableVoid.php:14-44` (`castAs`: `vtNumber`→`NaN`, `vtBoolean`→`false`; `toPrimitive`→`NaN`).
- **Симптом:** `void` достижим как возврат скрипта/функции без значения. `toPrimitive(void)` — PHP `NaN`, TS строка `'void'`; `castAs(void, vtNumber)` — PHP `NaN`, TS `null` (числовой путь `+` бросает `Failed void cast as number`); `castAs(void, vtBoolean)` — PHP `false`, TS `null` (это ветка **high-severity** по разбору). 
- **Правка (только TS):** создать `src/stackvariablevoid.ts` (зеркало PHP): `castAs(vtNumber)`→`NaN`, `castAs(vtBoolean)`→`false`, default→null, `toPrimitive`→`NaN`; завести `createStackVariableVoid` и направить оба `createVariable(vtVoid)` (статический и инстансный) на него; экспортировать из `index.ts`. Базовую ветку `vtVoid → 'void'` в `stackvariable.ts` **не трогать** (она зеркалит базу PHP).
- **Готово, когда:** зелёные в обоих движках: `castAs(void)` к числу = `NaN`, **`castAs(void)` к булеву = `false`** (явно проверить, это high-ветка), `void + N` идёт NaN-путём как PHP.

### P0-12 (инфраструктура). Починить фаззер: не импортирован `StackVariable`
- **Где:** `tests/fuzz.ts:92` использует `instanceof StackVariable`, а в импорте (`:13-17`) его нет. Любой скаляр превращается в `{error:true}`.
- **Почему P0:** это главный инструмент поиска расхождений PHP↔TS; сейчас он бесполезен и маскирует все P0 выше. Чинить **до** или **в начале** работы над P0, чтобы фаззер ловил регрессии.
- **Правка (только TS, тест-утилита):** добавить `StackVariable` в импорт из `../src` (он экспортируется в `index.ts`).
- **Готово, когда:** `npx tsx tests/fuzz.ts --count 5 --seed 7` для `return 10;` печатает `"ts":10`, а не `{error:true}`.

---

## 2бис. Обязательная матрица зеркальных тестов P0

> **✅ Статус: реализовано (2026-06-13).** Все P0 (включая P1-20) исправлены и закрыты зеркальными тестами. Поскольку `tests/tests.ts` и `php/tests/Test.php` заморожены (стерегут обратную совместимость), новые тесты живут в `tests/bugs.ts` и `php/tests/TestBugs.php` как функции `testP0_NN_*` (одинаковые имена с обеих сторон). Прогон: TS — bugs 64/64, main 194, mirror 19, limits 10, cross 38; PHP — 320/320 (единственное предупреждение — пред-существовавший P2-16, вне P0). Все 38 кросс-движковых кейсов дают одинаковый результат в PHP и TS.

Правило: **каждый P0 закрыт зеркальной парой тестов** — одинаковые имена в `tests/bugs.ts` и `php/tests/TestBugs.php`, одинаковый вход, одинаковое ожидание (по спецификации IEEE-754/JS). Тесты написаны вместе с правкой (PHP-first там, где правится PHP), оба набора зелёные.

| Имя теста | Вход (MSL) | Ожидание | TS | PHP | Правка |
|---|---|---|---|---|---|
| P0-1_NumStrEqLeadingZero | `return "1" == "01";` | `false` | tests.ts | Test.php | PHP |
| P0-1_NumStrEqExp | `return "10" == "1e1";` | `false` | tests.ts | Test.php | PHP |
| P0-1_StrEqText | `return "abc" == "abc";` | `true` | tests.ts | Test.php | PHP |
| P0-1_NumStrNeq | `return "1" != "01";` | `true` | tests.ts | Test.php | PHP |
| P0-2_SubStringLen | `return "abcdef".SubString(1,3);` | `"bcd"` | bugs.ts | TestBugs.php | TS |
| P0-2_SubStringNegStart | `return "abcdef".SubString(-3,2);` | `"de"` | bugs.ts | TestBugs.php | TS |
| P0-3_DivPosInf | `return (5/0).isFinite;` | `false` | tests.ts | Test.php | PHP |
| P0-3_DivNegSign | `return (-5/0) < 0;` | `true` | tests.ts | Test.php | PHP |
| P0-3_DivZeroByZero | `return (0/0).isNaN;` | `true` | tests.ts | Test.php | PHP |
| P0-4_ModFloat | `return (7/2) % 2;` | `1.5` | tests.ts | Test.php | PHP |
| P0-4_ModByZero | `return (7 % 0).isNaN;` | `true` | tests.ts | Test.php | PHP |
| P0-5_StrHexToNum | `return "0x1A" - 0;` | `26` | bugs.ts | TestBugs.php | PHP |
| P0-5_StrInfToNum | `return ("Infinity" - 0).isFinite;` | `false` | bugs.ts | TestBugs.php | PHP |
| P0-5_StrEmptyToNum | `return "" - 0;` | `0` | bugs.ts | TestBugs.php | PHP |
| P0-5_StrTrimToNum | `return "  5  " - 0;` | `5` | bugs.ts | TestBugs.php | PHP |
| P0-5_StrGarbageToNum | `return ("abc" - 0).isNaN;` | `true` | bugs.ts | TestBugs.php | PHP |
| P0-6_ContainsNull | `return [1, null].Contains(null);` | `true` | bugs.ts | TestBugs.php | both |
| P0-6_ContainsNullAbsent | `return [1, 2].Contains(null);` | `false` | bugs.ts | TestBugs.php | both |
| P0-6_IndexOfBoolTrue | `return [true, false].IndexOf(true);` | `0` | bugs.ts | TestBugs.php | both |
| P0-6_ContainsStrictType | `return [1].Contains("1");` | `false` | bugs.ts | TestBugs.php | both |
| P0-7_RoundNegHalf | `return Math.round(-2.5);` | `-2` | tests.ts | Test.php | PHP |
| P0-7_RoundNegHalfSmall | `return Math.round(-0.5);` | `0` | tests.ts | Test.php | PHP |
| P0-8_FromCharCodeBMP | `return String.fromCharCode(1103);` | `"я"` | bugs.ts | TestBugs.php | TS |
| P0-8_FromCharCodeAstral | `return String.fromCharCode(128512);` | `"😀"` | bugs.ts | TestBugs.php | TS |
| P0-9_NewArrayNaNThrows | `new Array(NaN)` (через try/catch) | бросает `Invalid array length: NAN` | bugs.ts | TestBugs.php | TS |
| P0-9_NewArrayStrThrows | `new Array("abc")` | бросает | bugs.ts | TestBugs.php | TS |
| P0-9_NewArrayValid | `return new Array(3).length;` | `3` | bugs.ts | TestBugs.php | TS |
| P0-10_DateTimeTimeIsNumber | `return DateTime.Today.AddHours(1).AddMinutes(2).AddSeconds(3).Time;` | `3723` | bugs.ts | TestBugs.php | TS |
| P0-10_DateTimeTimeArith | `return DateTime.Today.AddHours(1).Time + 1;` | `3601` | bugs.ts | TestBugs.php | TS |
| P0-11_VoidToNumber | `function f() {} return (f() + 1).isNaN;` | `true` | bugs.ts | TestBugs.php | TS |
| P0-11_VoidToBoolean | `function f() {} if (f()) { return "t"; } return "f";` | `"f"` | bugs.ts | TestBugs.php | TS |
| P1-20_Bitwise64Or | `return 0x100000000 \| 1;` | `4294967297` | bugs.ts | TestBugs.php | both |
| P1-20_Bitwise64And | `return 0x1FF & 0xF0;` | `240` | bugs.ts | TestBugs.php | both |

Заметки по реализации:
- Сравнение `NaN`/`Infinity` ведём через `.isNaN`/`.isFinite`/знак, а не прямым равенством — так тест устойчив к сериализации значений.
- `P1-20`: результат битовой операции может превысить 2^53 — тогда хранение в float64 теряет точность. На этапе реализации решить: нести значение как BigInt в самом MSLang или принять предел 2^53 (в матрице операнды подобраны под безопасный диапазон).
- `P0-6`: членство — строгое (как JS `includes`/SameValueZero), поэтому `[1].Contains("1") → false`.
- `P0-12` (фаззер) — это тест-инструмент, а не зеркальная пара; критерий — `fuzz.ts … return 10;` печатает `"ts":10` (M1-1).

---

## 3. P1 — значимые расхождения и пропуски тестов

### Парсер
- **P1-1. Литерал-массив как значение ассоциативного ключа (`['k' => [1,2,3]]`).** TS `src/parser.ts:636` имеет лишний клаузул `prevNode.nType === ntArrayPushSeparatorKey`, которого нет в PHP `php/src/CodeParser.php:350`. Прогон: TS разбирает корректно, PHP падает (`found token ltComma expected ltBracketClose`). Направление `php-missing-ts-feature`. **Правка PHP-first:** добавить четвёртый клаузул в `CodeParser.php:350`, затем подтвердить совпадение TS. *Готово, когда:* оба разбирают `['k' => [1,2,3]]` как вложенный массив; зеркальный тест в обоих наборах.
- **P1-2. `for` через `parseCompare` вместо `parseExpression`.** TS `src/parser.ts:1300`, PHP `php/src/CodeParser.php:1050`. Голое небулевое условие: `for(i=0; n; ...)` при числовом `n` — PHP бросает `For compare invalid variable type`, TS работает. **Правка TS-first:** вернуть `this.parseExpression(Node2, true, LexerTypeArray.one(ltSemicolon), true)` на `:1300`, затем (P1-3) убрать `EndCompareType`. *Готово, когда:* `for(i=0;n;…)` при числовом `n` бросает как PHP; `for(i<n)`/`for(;;)`/`while` остаются зелёными.
- **P1-3. `EndCompareType` в стоп-списке `parseCompare`.** TS `src/parser.ts:1088-1090` добавляет `EndCompareType`, которого нет в PHP `php/src/CodeParser.php:828`. Это костыль ради `for` через `parseCompare`. **Правка TS:** убрать `EndCompareType` после возврата `for` на `parseExpression` (для `while` безопасно — условие всегда оканчивается `ltRPar`). *Готово, когда:* стоп-список совпал с PHP бит-в-бит; `while`/`for` тесты зелёные.
- **P1-4. Проверка зарезервированных слов отключена в ветке `ltIDStr`.** TS `src/parser.ts:517-520` — тело `throw` закомментировано; PHP `php/src/CodeParser.php:275-278` бросает `Using reserved word "..."`. Слова `array`/`clone`/`return`/`print`/… доходят как `ltIDStr`. **Правка TS:** включить `throw new ParserException('Using reserved word "'+saveToken+'"', this.lexer.tokenCursor)`. Перед этим убедиться, что ни один зелёный тест не использует зарезервированное слово как голый операнд. *Готово, когда:* `y = array + 1;` бросает как PHP.

### Исключения (форма иерархии и тексты)
- **P1-5. Нет класса `ContextException`.** PHP `php/src/Exception/ContextException.php:7` (~13 обычных throw-сайтов; два в магических `__get/__set` PHP не зеркалятся — это специфика языка); TS бросает базовый `MSLangException` (`interpreter.ts:3702,3962,4041,…`). **Правка TS:** завести `ContextException extends MSLangException`, заменить throw'ы на ~13 местах, экспортировать из `index.ts`. *Готово, когда:* тип исключения совпал на всех зеркалимых местах (без магических методов).
- **P1-6. Переименован `ParserCursorException` → `ParserException`.** PHP `php/src/Exception/ParserCursorException.php:9` (аксессор `getCursor()`); TS `src/exceptions.ts:37` (`getCursorPosition()`). Нарушение правила имён. **Правка TS:** переименовать класс в `ParserCursorException`, аксессор в `getCursor()`, поле в `_cursor`, обновить `parser.ts`. *Готово, когда:* имена класса/аксессора/поля совпали с PHP.
- **P1-7. Нет префикса `[line:col]` в `InterpreterException`/`LexerException`/`ParserCursorException`.** PHP конструкторы приписывают `[строка:столбец]` к сообщению (`InterpreterException.php:11-22`, `LexerException.php:9-27`, `ParserCursorException.php:11-19`); TS — нет (`exceptions.ts:11-25,7-9,40-49`). Видно через `message` пойманного скриптом Error. **Правка TS:** в конструкторах добавить тот же префикс при наличии координат; в `lexer.ts` передавать `this.lastCursorLine`/`this.lastCursorCol` во все `throw new LexerException(...)` (данные уже есть в `lexer.ts:131-132`). *Готово, когда:* `message` пойманного Error совпадает с PHP бит-в-бит.
- **P1-8. Нет класса `ParserNodeException`.** PHP `php/src/Exception/ParserNodeException.php:9`; в TS отсутствует. **Правка TS:** завести зеркальный класс с аксессором `getNode()` и префиксом `[line:col]`. *Готово, когда:* класс есть, `getNode()` работает.
- **P1-9. Тексты ошибок лексера/парсера.** Пустой идентификатор: PHP `Parse expression failed "..."` (`CodeLexer.php:577-580`) против TS `syntax error, unexpected token "..."` (`lexer.ts:797-799`). default-ветка `parseExpression`: PHP `…, found token … expected …` (`CodeParser.php:525`) против TS `… wait …` (`parser.ts:817`). Пустой `ltArraySeparator`: PHP `Parse expression failed …` (`CodeParser.php:513`) против TS `syntax error, unexpected token …` (`parser.ts:805`). **Правка TS:** привести тексты к PHP бит-в-бит. *Готово, когда:* сообщения совпадают.

### Учёт бюджета данных (фича ветки sandbox-limits)
- **P1-10. Методы Array, отдающие новый массив, не списывают бюджет.** TS `src/stackvariablearray.ts:291,315,323,331,339` создают `new StackVariableArray(false, …)` без контекста; PHP оборачивает через `createVariable` с контекстом (`StackVariable.php:196-199`, `trackAllocation(count*16)`). Прогон: `a.keys()` — PHP +48 байт, TS +0. **Правка TS:** пробрасывать `this.getContext()` в конструкторы `keys/values/reverse/flip/concat`. *Готово, когда:* `getAllocatedBytes` после `keys/values/reverse/flip/concat` совпал с PHP (тест без присваивания результата).
- **P1-11. rest-массив user-функции не списывает бюджет.** TS `src/interpreter.ts:2521-2526` строит rest через пустой `new StackVariableArray(false, [])` + `push`; PHP `php/src/Interpreter.php:2313` — `new StackVariableArray(false, $restItems, $context)`. **Правка TS:** строить rest сразу `new StackVariableArray(false, restItems, context)`. *Готово, когда:* rest списывает `count*16` как PHP.
- **P1-12. `createVariableDefaultValue` не прокидывает контекст.** TS `src/functionparameter.ts:42-50` зовёт статический `createVariable` (context=null); PHP `php/src/Functions/FunctionParameter.php:50-58` — инстанс-метод. Дефолтные строки/массивы не попадают в бюджет. *(Вердикт: реальный, но узкий — недоучёт только для пропущенного параметра с дефолтом vtString/vtArray.)* **Правка TS:** принимать контекст и звать `context.createVariable(...)`; на местах вызова (`interpreter.ts:4221,4256`) передавать `this`. *Готово, когда:* дефолт-строка/массив параметра попадает в бюджет как PHP.

### Прочие поведенческие
- **P1-13. `StackVariableObject` не переопределяет `castAs`.** TS использует базу (всегда `null`); PHP `php/src/StackVariableObject.php:72-79`: `vtObject`→`this`, `vtString`→`'[object]'`. Путь `str += obj` в TS бросает `Failed cast to string in +=`, в PHP даёт `'[object]'`. **Правка TS:** добавить `castAs` зеркально PHP. *Готово, когда:* `str += obj` → `'[object]'`, зеркальный тест зелёный.
- **P1-14. `getRefValue` без защиты от исчезнувшей переменной.** TS `src/stackvariableref.ts:13-15` (`return this._refProxy.get()`); PHP `php/src/StackVariableRef.php:26-33` при `null` возвращает настоящий `StackVariableUndefined`. Корень падений `Reflect.get called on non-object` при утечке Ref. **Правка TS:** добавить null-guard + завести контекст у Ref (см. P2). Связано с уже частично закрытым `tests/bugs.ts:650-675`. *Готово, когда:* утечка Ref не бросает `Reflect.get …`, мягко деградирует в undefined.
- **P1-15. `StackVariableDateTime.toPrimitive`: формат ATOM против `Y-m-d H:i:s`.** PHP `php/src/StackVariableDateTime.php:260-266` (ISO 8601 с таймзоной); TS `src/stackvariabledatetime.ts:275-279`. Различается строковое представление при конкатенации. **Правка TS:** перейти на ATOM-формат, согласовать таймзону (см. P2-9). *Готово, когда:* формат `datetime + строка` совпал с PHP.
- **P1-16. `StackVariableNumber.compare` бросает голый `Error`.** TS `src/stackvariablenumber.ts:60` (`new Error(...)`); PHP `php/src/StackVariableNumber.php:79` (`InterpreterException` с токеном). **Правка TS:** заменить на `InterpreterException`. *Готово, когда:* тип исключения совпал; текст `Unknown compare type …` сохранён.
- **P1-17. `StackVariableClass.value`-сеттер и базовый сеттер бросают `MSLangException` без токена.** PHP бросает `InterpreterException` с `getCurrentToken()` (`StackVariableClass.php:78-81`, `StackVariable.php:105`). Системная конвенция всего слоя `StackVariable*`. **Правка TS (общим проходом):** перевести базовый и наследников на `InterpreterException` с позицией; согласовать с владельцем (затрагивает много файлов). *Готово, когда:* тип и позиция совпали по слою; тексты не изменились.
- **P1-18. Нет интерфейса `BuiltinConstructorInterface`.** PHP `php/src/BuiltinConstructorInterface.php` + диспетчеризация через `instanceof BuiltinConstructorInterface` (`Interpreter.php:2709`); TS жёстко проверяет `instanceof ArrayConstructor` (`interpreter.ts:2912`). **Правка TS:** завести зеркало контракта, диспетчеризовать по нему. *Готово, когда:* диспетчеризация `new` идёт по контракту, не по конкретному классу.
- **P1-19. База `StackVariable` лишена `offsetGet`/`offsetSet`.** PHP `php/src/StackVariable.php:345-353` имеет `offsetGet`/`offsetSet` (бросают `Cannot read offset`/`Cannot set offset`), доступ по индексу в интерпретаторе идёт через них; TS не имеет их вовсе (grep пуст), доступ слит в `getProperty`/`setProperty`. Две конкретные TS-деформации: (a) индексация скаляра в TS возвращает `undefined` вместо PHP-исключения `Cannot read offset`; (b) нет нормализации float-ключа перед доступом (PHP `Interpreter.php:1441-1447`: целый float → int, дробный → строка). **Правка TS-first** (если выбрана единая модель через `getProperty` — отразить решение в PHP). **Минимально:** добиться, чтобы индексация скаляра бросала эквивалент `Cannot read offset`, и добавить нормализацию float-ключа в `BracketGetKeyFinishHandler`. *Готово, когда:* индексация скаляра бросает как PHP; `arr[2.0]`/`arr[2.5]` нормализуются как PHP.

### Битовые операции (направление: согласование с владельцем)
- **P1-20. Битовые `and`/`or`/`xor`: PHP 64-битный int, TS усекает к 32 (`|0`).** PHP `php/src/Interpreter.php:1688-1700` (`fn(int $a,int $b)=>$a&$b`), TS `src/interpreter.ts:909-917` (`(a|0)&(b|0)`). Подтверждено чтением: `0x100000000 | 1` — PHP `4294967297`, TS `1`. **Это решение владельца, не молчаливая правка:** либо признать языковым ограничением JS (32-битные нативные битовые операции) и пометить в коде, либо реализовать 64-битное поведение через BigInt зеркально PHP. **PHP менять нельзя** (он эталон с 64-битной семантикой). *Готово, когда:* решение зафиксировано (пометка в коде или BigInt-зеркало); до решения — запись об известном расхождении.

### Пропуски тестов
- **P1-21. `tests/bugs.ts` отстал 52 против 65.** Отсутствуют в TS (есть в PHP `tests/TestBugs.php`): кластер **Bug16** (приоритет `* / %` над `+`, 7 кейсов, `:291-346`), кластер **Bug17** (`let x = null` остаётся переназначаемым; только global/const null — константа; 6 кейсов, `:348-410`, два из них — негативные через `expectException ContextException`), **Bug22_FloatIndexFromArithmetic** (`arr[2.5]` из `length/2` не бросает, даёт undefined, `:752-766`). **Правка TS:** добавить 14 зеркальных кейсов. Один TS-only тест `Bug_FuncEntryCache_ProxyOnDeadScope` (`tests/bugs.ts:657-675`, коммит `5c6d5ad`) — по правилу №0 чинится **добавлением зеркала в PHP**, не удалением из TS. *Готово, когда:* bugs.ts 65/65, имена совпали; PHP содержит зеркало `Bug_FuncEntryCache_ProxyOnDeadScope`.
- **P1-22. `tests/tests.ts` отстал 194 против 195.** Отсутствует `077_VarRedeclaresLetFails` (PHP `Test.php:3142`): тело проверяет двойной `let` — `let x = 1; let x = 2; return x;` бросает `InterpreterException` с `Identifier 'x' has already been declared`. **Правка TS:** добавить зеркальный тест. *Готово, когда:* tests.ts 195/195.
- **P1-23. Лимиты песочницы не входят в `test:all` и CI.** `package.json:34` (`test:all`) и `.github/workflows/ci.yml:29-43` не гоняют `limits.ts` (хотя 10/10 тестов уже совпадают с `TestLimits.php`). **Правка TS-инфра:** добавить `npm run test:limits` в `test:all` и отдельным шагом в CI. *Готово, когда:* CI гоняет лимиты.

---

## 4. P2 — улучшения, долги, документация/версии

> **✅ Тир 2 закрыт (2026-06-14).** Поведенческие P2: **P2-3** (charCodeAt/charAt отрицательного/за-концом индекса → `NaN`/`''` по JS — правка **PHP-first**, TS уже был верен), **P2-4** (нечисловой ключ из `indexOf` приводится как PHP `(int)` через `keyToInt`), **P2-5** (численная ветка `plusHandler` приведена к PHP: `isNumeric`+`Type error`; поведение тождественно — `toPrimitive` numифицирует boolean/null), **P2-6** (сырой `null` в массиве → `StackVariableNull`, вложенные массивы получают контекст, удалён мёртвый `convertToNativeObject`), **P2-11** (порядок поиска `InterpreterNode.typeName` как в PHP; `nodeChildren` бросает `MSLangException`), **P2-16** (битовый путь PHP: `NAN`/`INF` → 0 через `toInt64`, без предупреждения PHP — правка **PHP-first**). Пять зеркальных пар в `bugs.ts`/`TestBugs.php` (`P2_03`,`P2_04`,`P2_05`,`P2_06`,`P2_16`). Прогон: TS bugs 97, main 194, mirror 21, limits 11, cross 38; PHP 340; фаззер 0/500.
>
> **Два пункта Тира 2 — языково-вынужденные отклонения TS от PHP (НЕ переносить):**
> - **P2-7 (objPropHandler).** PHP кладёт записываемый `StackVariableRef` с `$context` и для отсутствующего свойства тоже. В TS это нельзя: `funcEntryCache` захватывает `Proxy(StackVariableRef)` вместе с его scope, и после выхода из короткоживущего scope падает чужой вызов (баг 5c6d5ad, страж `Bug_FuncEntryCache_ProxyOnDeadScope`). Поэтому в TS Ref здесь **без контекста**, а отсутствующее свойство — обычный `StackVariableUndefined`. Из P2-7 перенесено только безопасное: опциональный `context` в конструкторе `StackVariableRef` (зеркало сигнатуры) и `return` в трапе `apply` (контракт JS Proxy).
> - **P2-12 (callFunction по Math.max).** PHP идёт строго по `getParameters()` (вариативные builtin'ы объявлены variadic). В TS встроенные вариативные функции (`String.fromCharCode`, `Array.fill`, `fromCodePoint`…) недо-объявляют параметры и опираются на позиционную передачу через `Math.max`; строгий цикл их ломает (`fromCharCode(65,66,67)`→''). Для пользовательских функций разницы нет (в MSLang нет объекта `arguments`), поэтому `Math.max` оставлен. Долг-альтернатива: объявить параметры вариативных builtin'ов как rest — тогда строгий цикл заработает (отдельная крупная задача, низкий приоритет).

- **P2-1. Версия и публичный интерфейс.** TS `src/version.ts` — объект `{Num:'1.0.0', Build:'2026-06-12'}`; PHP `php/src/Version.php:21-22` — `VERSION='1.0.7'`, `REVISION='2026-01-02'`, метод `getFullVersion()`. *По итогам разбора это гигиена метаданных (info/low), а не дефект рантайма и не mirror-константа — на исполнение скриптов не влияет.* **Правка PHP-first** (привести версию/дату в порядок в эталоне), затем переписать `version.ts` под форму PHP (поля `VERSION`/`REVISION` + `getFullVersion()`), синхронизировать `package.json`, добавить Version в mirror-тест. Также экспортировать `FunctionParameter` из `index.ts` рядом с `FunctionEntry`.
- **P2-2. Восстановить ранний `return this` в `StackVariableNumber.castAs(vtNumber)`** (`src/stackvariablenumber.ts`, зеркало `php/src/StackVariableNumber.php:85-86`) и убрать TS-only ветку `typeof !== 'number' → 'undefined'`. Ранний `return this` нужен, чтобы in-place мутация в инкременте без Ref совпала с PHP. *Готово, когда:* зеркальный тест на инкремент не-Ref числа.
- **P2-3. `charCodeAt`/`charAt` при отрицательном индексе.** TS `src/stackvariablestring.ts:62-66,75-78` возвращают `NaN`/`''`; PHP `php/src/StackVariableString.php:129-147` через `mb_substr` берёт символ с конца. **Правка TS:** нормализовать отрицательный индекс. *Готово, когда:* `'abc'.charCodeAt(-1)`→99 и `'abc'.charAt(-1)`→'c' совпали с PHP.
- **P2-4. `indexOf` по нечисловому ключу.** TS `src/stackvariablearray.ts:200,209` (`Number('k')`=NaN); PHP `php/src/StackVariableArray.php:117,123` (`(int)'k'`=0). **Правка TS:** повторить `(int)`-семантику. *Готово, когда:* `a['k']='v'; a.indexOf('v')`→0 как PHP.
- **P2-5. plusHandler численная ветка: текст ошибки.** PHP `php/src/Interpreter.php:536-547` проверяет `isNumeric()`+`getValue()`, бросает `Type error`; TS `src/interpreter.ts:812-821` делает `castAs(vtNumber)` и бросает `Failed <type> cast as number`. **Правка TS:** привести логику и текст к PHP (`Type error`). *Готово, когда:* текст совпал; зеркальный тест на не-числовой операнд `+`.
- **P2-6. `StackVariableArray` мелкие:** null при построении массива уводится в `StackVariableObject` (`stackvariablearray.ts:58-60`, `typeof null==='object'`) вместо `StackVariableNull` — добавить явную проверку `v===null`; вложенные значения создаются без контекста (`:44-62`) — пробрасывать `this.getContext()`; удалить TS-only мёртвый `convertToNativeObject` (`:544-564`) или завести зеркало в PHP.
- **P2-7. `StackVariableRef` без контекста.** TS-конструктор не принимает/не передаёт context; PHP — да (`StackVariableRef.php:21-24`, `ContextInterpreter.php:642`). Чинить в связке с P1-14. Также: финальный fallback в `objPropHandler` (TS `interpreter.ts:1351-1352` кладёт нередактируемый `StackVariableUndefined`; PHP `Interpreter.php:939-946` — записываемый Ref); трап `apply` не возвращает результат (`stackvariableref.ts:85-88`).
- **P2-8. `invokeMethod` опечатка `StackVariable.constructor.name`** (`src/stackvariable.ts:296`, даёт `'Function'`) → заменить на `StackVariable.name`. Зеркало `php/src/StackVariable.php:181`. *Готово, когда:* текст ошибки содержит `StackVariable`, а не `Function`; зеркальный тест.
- **P2-9. Имена параметров/методов:** `AddSeconds` объявлен параметром `'minutes'` (`stackvariabledatetime.ts:152`) → `'seconds'`; `funcInvoke_indexOf` (`stackvariablestring.ts:48`) → `funcInvokeIndexOf` (без подчёркивания, как PHP).
- **P2-10. Рассинхрон таймзоны в `StackVariableDateTime`.** Геттеры/compare читают локальное время, `castAs`/`toPrimitive` — UTC через `toISOString()`. **Правка PHP-first** (зафиксировать зону в эталоне), затем выбрать единую зону в TS.
- **P2-11. `InterpreterNode.typeName` обратный порядок поиска** (`src/interpreter.ts:95-105`) — привести к форме PHP (`php/src/InterpreterNode.php:18-29`): сначала `NodeType`, потом `InterpreterNodeType`. `nodeChildren()` бросает голый `Error` (`parser.ts:234-252`) → `MSLangException`.
- **P2-12. `callFunction` перебирает `Math.max` вместо объявленных параметров.** TS `src/interpreter.ts:4213-4223` (`Math.max(parameters, funcParameters)`); PHP `ContextInterpreter.php:817-826` идёт строго по `getParameters()`. Лишние фактические аргументы в TS попадают в вызов. Дробление однозначно: **правка TS-first** — привести `callFunction` к циклу по `getParameters()` (как PHP). *Готово, когда:* лишние фактические аргументы сверх объявленных параметров отбрасываются, совпадая с PHP.
- **P2-13. `FunctionParameter` мелкие:** нет геттера `isPassedByReference()` (`functionparameter.ts:17`, есть в PHP `FunctionParameter.php:40-43`); default-тип `vtUndefined(0)` вместо `null` (`functionparameter.ts:12`).
- **P2-14. Сборка/упаковка (только TS-инфра, паритета не касается):** не публиковать sourcemap-файлы (1.17 МБ, `vite.config.ts:25` + `package.json` files); поднять `build.target` до `es2020` (`vite.config.ts:22`); чистить `dist/types` перед сборкой (удалить осколок `errorconstructor.d.ts`); добавить `sideEffects:false`; вынести генерацию `version.ts` из git-отслеживаемого файла (`scripts/sync-version.mjs:30` пачкает дерево датой). **Минификация (`vite.config.ts:23`, 306 КБ → ~135 КБ) — отдельной задачей вместе с `keep_classnames` (см. O-13), не раньше неё.**
- **P2-15. Документация:** поправить стухший путь в `php/tests/scripts/known-divergences.md:27` (`../devbx.core/tests/fuzz.php` → `../php/tests/fuzz.php`).
- **P2-16. PHP-эталон: аудит `NAN→int` каста.** В `php/src/Interpreter.php:1747` битовый путь делает `(int) $leftTmp->getValue()`, и при `NAN`/`INF` приведение к int в PHP не определено внятно. Это латентный риск **на стороне эталона**, поэтому правится PHP-first (исследовать поведение, при необходимости явно обработать `NAN`/`INF` до каста). До решения — запись об известном долге PHP.

---

## 5. Оптимизации

> **✅ Тир 4, безопасная часть закрыта (2026-06-14).** Сделано: **O-1 шаг 1** (общий обработчик Ref-прокси вместо 6 замыканий на чтение переменной — главный выигрыш), **O-4** (`.bind(this)` вместо стрелок-обёрток у 103 обработчиков), **O-3** (общий объект `properties` вместо литерала на экземпляр; CPU плоско, аллокации падают). Бенч (Node v24): **exec hot loop 1000× 11.30→~6.6 мс, −42%**; array push −10%; string concat −9%. Все TS-тесты и vite-сборка зелёные; PHP не трогался; фаззер 0/500. Точка отсчёта и результаты — `tests/bench-baseline.md`.
>
> **Намеренно отложено (высокий риск рерайта при умеренной выгоде):** *Полный O-1* (Proxy → явные методы-делегаты у `StackVariableRef`, как `__get/__call` в PHP) — шаг 1 уже снял основную стоимость Proxy (аллокацию обработчика), остаток ~2.4% по профилю; *O-2* (COW `_variables`) — `pushExecutionStack` копирует переменные `Object.assign`, а «копирование назад» в `popExecutionStack` тонкое и критично для scope, ~6% при высоком риске. Профиль показал, что парсер НЕ доминирует (`exec only ≈ exec`), поэтому O-5..O-12 (парсер/лексер) — низкая отдача; O-13 (`keep_classnames`) — предусловие минификации, не выигрыш сам по себе.

Все — снижают расход CPU/памяти горячего пути. `mirrorRisk` — риск разъехаться с PHP при правке.

| ID | Оптимизация | Impact | Effort | mirrorRisk | Где / порядок правки |
|---|---|---|---|---|---|
| O-1 | Убрать Proxy при чтении переменных — явные методы-делегаты на `StackVariableRef`, как в PHP (~20% времени по профилю) | high | M | low | `src/stackvariableref.ts:40-91`, `interpreter.ts:4068-4088` — **снижает дрейф с PHP**, можно раньше |
| O-2 | Ленивая копия `_variables` (COW/прототип) вместо `Object.assign` на каждый блок; как минимум не копировать `_functions` | high | L | medium | `src/interpreter.ts:3690-3691` — обсудить форму, PHP COW бесплатно |
| O-3 | Поля-стрелки `funcInvoke*`/`properties` → методы прототипа (как в PHP); горячий тип — строки | high | M | low | `stackvariablestring.ts:39-106`, `stackvariablearray.ts:138-336` — **снижает дрейф, можно раньше** |
| O-4 | Регистрация обработчиков `this.xHandler.bind(this)` вместо `(...args)=>{…}` | medium | S | none | `src/interpreter.ts:133-490` |
| O-5 | `LexerTypeArray` не наследовать `Array` (деопт V8), ввести `hasValue()` как в PHP | medium | L | low | `src/lexer.ts:88-125`, `parser.ts:339,1166,1443` — приведение к PHP-форме |
| O-6 | Кэш `nodeChildren()` на `ParseNode` (тело цикла на каждой итерации) | low | S | low | `~28 мест push(...nodeChildren())`, `parser.ts:234-252` |
| O-7 | Вынести `allowStopChars`/инлайн-массивы `indexOf` в константы | medium | S | medium | `lexer.ts:657`, `parser.ts:438,1206,1216` — **PHP-first** |
| O-8 | Иммутабельные `true/false/null/undefined` — переиспользуемые экземпляры | medium | L | high | алгоритм `compareVariable`/`ifCompare*` — **PHP-first**, осторожно |
| O-9 | Лишняя упаковка `StackVariable` в арифметике (тройной `castAs`) | medium | M | medium | `interpreter.ts:784-786` — **PHP-first** |
| O-10 | `reservedWords` → `Set` (O(1)) | low | S | medium | `parser.ts:262-302,517,…` — **PHP-first** |
| O-11 | `tokenName`/`typeName`/`asNames` — обратная карта число→имя один раз | low | S | none | `lexer.ts:317-324`, `parser.ts:191-197` |
| O-12 | `StackVariableArray.value` — инициализировать `Map` в конструкторе, убрать `instanceof` в геттере | low | S | low | `stackvariablearray.ts:31-38` |
| O-13 | **Корректностный prerequisite** минификации: `keep_classnames`/`keep_fnames` в vite/terser (иначе `funcEntryCache` по `constructor.name` схлопнет два класса в один ключ кэша и вернёт чужую таблицу методов в минифицированной UMD) | low | S | low | `vite.config.ts`, `stackvariable.ts:14` — **делать ДО включения минификации** |

> O-1 и O-3 — `impact:high` и `mirrorRisk:low`, и оба **приближают TS к форме PHP**, поэтому их можно брать раньше общего блока оптимизаций: они не зависят от поведенческих фиксов P0.
> O-13 — не «просто перф», а **условие корректности**: без `keep_classnames` минификация может отгрузить баг с кэшем методов. Поэтому минификация (P2-14) включается только после O-13.

---

## 6. Дорожная карта по вехам

Сквозной критерий для **каждой** задачи: `npm test`, `npm run test:bugs`, `npm run test:mirror`, `npm run test:cross` зелёные; для парных — добавлены зеркальные тесты в `tests/*.ts` и `php/tests/*.php` с одинаковыми именами.

### Milestone 1 — Разблокировать инструменты поиска расхождений
Цель: фаззер и проверка типов снова ловят регрессии, прежде чем чинить P0.

| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M1-1 | Импорт `StackVariable` в `tests/fuzz.ts:92` | P0 | S | TS | — | `fuzz.ts … return 10;` → `"ts":10` |
| M1-2 | Чинить `tsconfig.test.json` (bundler-резолв) и добавить проверку типов tests в CI | P1 | M | TS | M1-1 | `tsc -p tsconfig.test.json --noEmit` зелёный; шаг в `ci.yml` |
| M1-3 | Свести две `unwrap()` в общий `tests/_unwrap.ts` + нормализация `-0`→0 как в `fuzz.php:43` | P2 | M | TS | M1-1 | `cross.ts`/`fuzz.ts` дают идентичный unwrap |
| M1-4 | Локальная команда `test:fuzz:check` (при `MSLANG_PHP_ROOT` гоняет обе стороны, падает при `diverged>0`) | P2 | M | TS | M1-1..M1-3 | расширенная грамматика с `/ % < >` находит расхождения P0 |

### Milestone 2 — P0: тихие расхождения результата (PHP не меняем)
Цель: один исходник даёт одинаковый результат в обоих движках.

| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M2-1 | P0-1 числовые строки в `phpsemantics.ts:85` | P0 | S | TS | M1 | зеркальные тесты `"1"=="01"` и т.п. зелёные |
| M2-2 | P0-2 `SubString` как длина (`stackvariablestring.ts:213-225`) | P0 | M | TS | M1 | тесты `SubString(1,3)`/`SubString(-3,2)` совпали |
| M2-3 | P0-3 деление на ноль (`interpreter.ts:884`) | P0 | S | TS | M1 | `-5/0`,`0/0`,`5/0` совпали |
| M2-4 | P0-4 остаток `%` (`interpreter.ts:903`) | P0 | S | TS | M1 | `(7/2)%2`,`7%0` совпали |
| M2-5 | P0-5 строка→число (`stackvariablestring.ts:89`) | P0 | M | TS | M1 | `'0x1A'`,`'Infinity'` дают NaN как PHP |
| M2-6 | P0-6 `Array.contains`/`indexOf` null/bool-игла | P0 | S | TS | M1 | null-игла не бросает; bool как PHP |
| M2-7 | P0-8 `fromCharCode` → `fromCodePoint` (`stringstaticfunctions.ts:27`) | P0 | S | TS | M1 | astral `128512`→`'😀'` |
| M2-8 | P0-9 `new Array(NaN/Inf/"abc")` (`arrayconstructor.ts:44`) | P0 | M | TS | M1 | бросает `Invalid array length: NAN/INF` как PHP |
| M2-9 | P0-10 `DateTime.Time` → число (`stackvariabledatetime.ts:97`) | P0 | S | TS | M1 | тип `.Time` = `vtNumber` |
| M2-10 | P0-11 завести `StackVariableVoid` (новый `stackvariablevoid.ts`) | P0 | M | TS | M1 | `castAs(void)→NaN`, **`castAs(void)→false` (булева ветка явно)**, `void+N` как PHP |

### Milestone 3 — P0, требующий правки PHP-эталона
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M3-1 | P0-7 `round` half-up в `MathFunctions.php:205` (TS уже верный) | P0 | S | PHP | M1 | PHP `round(-2.5)`=`-2` **и** `round(-0.5)`=`0`; зеркальные тесты на обе границы в обоих |

### Milestone 4 — Парсер: выравнивание поведения
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M4-1 | P1-1 `['k'=>[1,2,3]]` — клаузул в `CodeParser.php:350` | P1 | S | PHP | — | оба разбирают вложенный массив; зеркальный тест |
| M4-2 | P1-2 `for` через `parseExpression` (`parser.ts:1300`) | P1 | S | TS | — | `for(i=0;n;…)` бросает как PHP |
| M4-3 | P1-3 убрать `EndCompareType` (`parser.ts:1090`) | P1 | S | TS | M4-2 | `while`/`for` тесты зелёные |
| M4-4 | P1-4 включить проверку зарезервированных слов (`parser.ts:517`) | P1 | S | TS | — | `y = array + 1;` бросает как PHP |
| M4-5 | P1-9 тексты ошибок лексера/парсера к PHP | P1 | M | TS | — | сообщения совпадают бит-в-бит |

### Milestone 5 — Исключения: иерархия и позиции
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M5-1 | P1-5 завести `ContextException`, заменить throw'ы | P1 | M | TS | — | тип исключения совпал на ~13 местах |
| M5-2 | P1-6 переименовать в `ParserCursorException` + `getCursor()` | P1 | M | TS | — | имена совпали с PHP |
| M5-3 | P1-8 завести `ParserNodeException` | P1 | S | TS | — | класс есть, `getNode()` |
| M5-4 | P1-7 префикс `[line:col]` в Interpreter/Lexer/Parser исключениях | P1 | M | TS | M5-2 | `message` совпадает с PHP |
| M5-5 | P1-16/P1-17 голый `Error`/`MSLangException` → `InterpreterException` с токеном (системно по слою `StackVariable*`) | P1 | L | TS | M5-1 | согласовано с владельцем; тип и позиция совпали |

### Milestone 6 — Бюджет данных песочницы (фича ветки)
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M6-1 | P1-10 пробросить контекст в Array `keys/values/reverse/flip/concat` | P1 | S | TS | — | `getAllocatedBytes` совпал с PHP |
| M6-2 | P1-11 rest-массив через конструктор с контекстом (`interpreter.ts:2521`) | P1 | S | TS | — | rest списывает `count*16` как PHP |
| M6-3 | P1-12 `createVariableDefaultValue` с контекстом | P1 | S | TS | — | дефолт-строки/массивы в бюджете |
| M6-4 | P2-6/P2-7 контекст у вложенных значений массива и у Ref | P2 | M | TS | M6-1 | учёт совпал; Ref имеет контекст |

### Milestone 7 — Остальные поведенческие P1
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M7-1 | P1-13 `StackVariableObject.castAs` | P1 | S | TS | — | `str += obj` → `'[object]'` |
| M7-2 | P1-14 null-guard в `getRefValue` | P1 | M | TS | M6-4 | утечка Ref не бросает `Reflect.get …` |
| M7-3 | P1-15 `DateTime.toPrimitive` → ATOM | P1 | M | TS | P2-10 | формат совпал с PHP |
| M7-4 | P1-18 интерфейс `BuiltinConstructorInterface` | P1 | M | TS | — | диспетчеризация new по контракту |
| M7-5 | P1-19 `offsetGet`/`offsetSet` + нормализация float-ключа | P1 | M | TS | — | индексация скаляра бросает как PHP; float-ключ нормализован |
| M7-6 | P1-20 битовые 64-бит: решение владельца (пометка vs BigInt) | P1 | M | mix | — | решение зафиксировано; до него — запись о расхождении |

### Milestone 8 — Пропуски тестов
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M8-1 | P1-21 14 кейсов Bug16/Bug17/Bug22 в `tests/bugs.ts` | P1 | M | TS | M2,M3 | bugs.ts 65/65; имена совпали |
| M8-2 | P1-21b зеркало `Bug_FuncEntryCache_ProxyOnDeadScope` в PHP | P1 | S | PHP | — | PHP `TestBugs.php` содержит кейс |
| M8-3 | P1-22 `077_VarRedeclaresLetFails` в `tests/tests.ts` | P1 | S | TS | — | tests.ts 195/195 |
| M8-4 | P1-23 `test:limits` в `test:all` и CI | P1 | S | TS | M1-2 | CI гоняет лимиты |

### Milestone 9 — Долги, версии, оптимизации, процесс
| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M9-1 | P2-1 привести `Version` (поля/значения/`getFullVersion`) + mirror | P2 | M | PHP | — | `version.ts` зеркалит PHP; Version в mirror |
| M9-2 | P2-2..P2-5, P2-8, P2-9, P2-11..P2-13 мелкие поведенческие/именные долги | P2 | M | mix | — | каждый со своим зеркальным тестом |
| M9-3 | P2-16 аудит PHP `NAN→int` (`Interpreter.php:1747`) | P2 | S | PHP | — | поведение зафиксировано/исправлено в эталоне |
| M9-4 | O-13 `keep_classnames` в сборке (prerequisite минификации) | P2 | S | TS | — | минифицированная UMD не схлопывает классы |
| M9-5 | P2-14 сборка: sourcemap, target, чистка types, sideEffects, version.ts в .gitignore, **затем** минификация | P2 | M | TS | M9-4 | бандл ~135 КБ; дерево чистое после build |
| M9-6 | O-1..O-4 оптимизации с низким mirrorRisk (O-1/O-3 можно раньше) | P3 | M–L | TS | M2..M7 | bench не хуже; mirror зелёный |
| M9-7 | O-5..O-12 оптимизации (PHP-first для O-7..O-10) | P3 | M–L | mix | M9-6 | парность сохранена |

### Milestone 10 — Архитектура и структура (паритет формы)

> **✅ Закрыт (2026-06-14).** M10-1: `interpreter.ts` (4185 строк) разнесён — `ContextInterpreter`+`ExecutionStackItem` → `contextinterpreter.ts`, `ContextType` → `contexttype.ts` (как `ContextType.php`); цикл `Interpreter↔ContextInterpreter` тип-только, фабрика `createVariable` в базе через позднее связывание (`_registerCreateVariable`). M10-2: `.bind(this)` сделан в Тире 4 (O-4). M10-3: `_functions`/`_type`/`_interpreter` типизированы (зеркало `array`/`int`/`Interpreter` в PHP). Всё зелёное (typecheck/lint/тесты 194/97/38/11/mirror 21/фаззер 0/500/сборка). **Довершено:** `InterpreterNode`→`interpreternode.ts`, `InterpreterNodeType`→`interpreternodetype.ts` (export) — теперь полный паритет файлов с PHP: по файлу на класс. `interpreter.ts` = 3202 строки (только `Interpreter` + хелперы `TNodeHandler`/`toInt64`). Итог: 5 файлов (`interpreter.ts`/`contextinterpreter.ts`/`contexttype.ts`/`interpreternode.ts`/`interpreternodetype.ts`) ↔ 5 PHP-файлов.

| id | Заголовок | Приоритет | Effort | Репо первым | Зависимости | Критерий готовности |
|---|---|---|---|---|---|---|
| M10-1 ✅ | Вынести `ContextInterpreter` в `src/contextinterpreter.ts` (как в PHP) | P2 | M | TS | M5 | build/test/mirror зелёные; API не изменился |
| M10-2 ✅ | `registerHandlers` — прямая привязка методов (см. O-4) | P3 | S | TS | M9-6 | поведение идентично |
| M10-3 ✅ | Типизация полей `ContextInterpreter` (`_interpreter`/`_type`/`_functions`) | P3 | S | TS | M10-1 | строгие типы как в PHP |

---

## 7. Процесс против дрейфа

1. **Mirror-тест констант — обязательный гейт.** `npm run test:mirror` должен быть зелёным перед каждым коммитом. Дополнить его (M9-1): сверять `VERSION`/`REVISION`/`getFullVersion`; для `funcInvoke*` и констант — сверять **имена (множества), а не только число**, и падать, если регэксп нашёл 0 в одном из парных файлов (защита от тихого ложно-зелёного, когда количества случайно совпали или регэксп перестал что-то находить из-за смены формата записи).
2. **Авто-сверка тест-парности.** Завести проверку, что наборы имён тестов в `tests/tests.ts`↔`Test.php`, `tests/bugs.ts`↔`TestBugs.php`, `tests/limits.ts`↔`TestLimits.php` совпадают один-в-один (как уже сделано для лимитов и cross-runtime), и падать при расхождении количества/имён. Это поймало бы текущие пробелы 194/195 и 52/65 автоматически.
3. **Фаззер — рабочий и двусторонний.** После M1: грамматику фаззера расширить опасными операциями (`/ % < >` — именно там копятся расхождения PHP-семантики, сейчас намеренно опущены в `fuzz.ts:53`); команда `test:fuzz:check` локально (при `MSLANG_PHP_ROOT`) гоняет обе стороны и падает при `diverged>0`. Каждое пойманное расхождение фиксировать как зеркальный `.msl/.expected` в обоих `tests/scripts`, а не только текстом в `known-divergences.md`.
4. **Версии ведём PHP-first.** Номер версии и дату ревизии меняем сначала в `php/src/Version.php`, затем 1:1 в `version.ts` и `package.json`; mirror-тест следит, чтобы они не разъехались. `version.ts` с автодатой вынести из git-отслеживания, чтобы `npm run build` не пачкал дерево. (Это гигиена метаданных, не дефект рантайма.)
5. **CI на обеих сторонах.** В TS-CI добавить шаги `test:limits` и проверку типов tests. В соседнем PHP-репозитории завести `.github/workflows/ci.yml` (`composer test`, `composer lint`) — сейчас эталонная сторона не гоняется автоматически, а правила требуют менять её первой.
6. **Дисциплина направления.** Любая новая фича/обработчик/метод/константа — сначала в PHP, потом 1:1 в TS. Если в TS обнаружен код без PHP-аналога (`php-missing-ts-feature`) — это ошибка процесса, чинится добавлением в PHP (как P1-1, M8-2), а не узакониванием TS-формы. Решения, требующие выбора (битовые 64-бит, P1-20; аудит `NAN→int` PHP, P2-16; единая зона DateTime, P2-10) — выносятся владельцу как отдельные пункты, а не правятся молча.