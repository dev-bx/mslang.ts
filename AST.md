# Публичный AST MSLang

`Script::parse*(src)->toAst()` (PHP) / `Script.parse*(src).toAst()` (TS) отдаёт дерево
разобранного исходника. Это **часть публичного API**: на нём хост строит свою проверку
формул (типы по схеме переменных, подсказки в редакторе). PHP и TS дают один и тот же JSON,
включая места; это проверяет тест `104_Ast` на общих фикстурах `tests/ast/*.msl` + `*.json`.

## Стабильность

- В корне есть поле `version` (сейчас `1`).
- Пока `version` не меняется, состав узлов и полей не меняется: новые поля и новые виды
  узлов могут добавляться, существующие не удаляются и не меняют смысл.
- Любое несовместимое изменение — новая `version` и запись в CHANGELOG.

## Общее

Каждый узел — объект (в PHP — массив) с полем `type`. У узлов, привязанных к тексту, есть
`loc`: `{line, column, endLine, endColumn}` (с единицы) или `null`, если места нет.
Место составного узла (`Binary`, `Member`…) тянется от начала левой части до конца правой.

Скобки в дереве не видны: `(a + b) * c` — это `Binary(*)` с левым операндом `Binary(+)`.
Имена `true`, `false`, `null` — это `Literal`, а не `Identifier`.

## Корень

| Узел | Поля |
|---|---|
| `Expression` | `version`, `expression` — для `parseExpression` (и `parse`, если исходник — одно выражение) |
| `Program` | `version`, `body` — список инструкций |

## Инструкции

| Узел | Поля |
|---|---|
| `ExpressionStatement` | `expression` |
| `VariableDeclaration` | `kind` (`let` / `const` / `var`), `name`, `init` (выражение или null). `let a = 1, b;` — два узла |
| `FunctionDeclaration` | как `Function` (ниже) |
| `ClassDeclaration` | `name`, `superClass` (имя или null), `methods` — список `Method` (как `Function`) |
| `Return` | `argument` (выражение или null) |
| `Throw` | `argument` |
| `Break`, `Continue` | — |
| `Block` | `body` |
| `If` | `test`, `consequent`, `alternate` (инструкция или null); `else if` — `If` внутри `Block` |
| `For` | `init` (список инструкций), `test` (выражение или null), `update` (список инструкций), `body` |
| `ForOf` | `kind`, `name`, `iterable`, `body` |
| `While` | `test`, `body` |
| `Switch` | `discriminant`, `cases` — список `SwitchCase {test (null для default), body}` |
| `Try` | `block`, `param` (имя или null), `handler` (`Block` или null), `finalizer` (`Block` или null) |

## Выражения

| Узел | Поля |
|---|---|
| `Literal` | `value` — число, строка, `true` / `false` / `null` |
| `Identifier` | `name` |
| `This` | — |
| `Member` | `object`, `property` (имя-строка или выражение), `computed` (`a[i]` — true), `optional` (`a?.b`, `a?.[i]`) |
| `Call` | `callee`, `arguments`, `optional` (`a?.m()`). Метод `a.m(x)` — `callee: Member`; `Ns::fn(x)` — тоже `Member` |
| `New` | `callee` (имя класса), `arguments` |
| `SuperCall` | `method` (null для `super(...)`, имя для `super.m(...)`), `arguments` |
| `Spread` | `argument` — `...xs` в аргументах и в литерале массива |
| `Unary` | `operator` (`-`, `+`, `!`, `typeof`), `argument` |
| `Update` | `operator` (`++`, `--`), `prefix`, `argument` |
| `Binary` | `operator`: `+ - * / % & \| ^ << >> >>>`, `== != < > <= >=`, `instanceof` (правая часть — `Identifier` класса); `left`, `right` |
| `Logical` | `operator` (`&&`, `\|\|`, `??`), `left`, `right` |
| `Conditional` | `test`, `consequent`, `alternate` |
| `Assignment` | `operator` (`=`, `+=`, `-=`, `*=`, `/=`, `%=`), `target` (`Identifier` или `Member`), `value` |
| `Array` | `elements` — выражения, `Spread` и `KeyedElement {key, value}` (`"k" => v`) |
| `Object` | `properties` — список `Property {key (строка), value}` |
| `Exists` | `argument` — `exists(x)` |
| `Function` | `name` (null у безымянной), `arrow`, `params` — список `Param {name, rest, default}`, `body` — список инструкций. У стрелки с телом-выражением тело — один `Return` |
