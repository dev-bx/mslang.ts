# Расхождения TS ↔ PHP

Найденные фаззером (`tests/fuzz.ts` + `tests/fuzz.php`) расхождения и их статус. **PHP — эталон.**

## Закрытые

Класс расхождений вокруг loose equality `==`:

- `false != null` теперь `false` (как в PHP), было `true` в TS.
- `null == 0`, `null == ""` теперь `true` (как в PHP).
- `NaN == true` теперь `true` (PHP cast NaN→bool даёт true).
- `("b" - "1") == true` теперь `true` (NaN == true → true).
- `0 == ""` теперь `false` (PHP 8 поведение, было `true` в TS).

Решено модулем `src/phpsemantics.ts`: функция `phpLooseEqual` повторяет PHP 8
loose equality, используется в `StackVariable.compare` и `StackVariableNumber.compare`.

Регрессии стерегут cross-runtime скрипты `tests/scripts/014..020`.

## Как искать новые

```bash
# TS-сторона генерирует скрипты + свои результаты
npx tsx tests/fuzz.ts --count 1000 --seed 1 > /tmp/fuzz.jsonl

# PHP-сторона прогоняет тот же набор и сверяет с TS
php ../php/tests/fuzz.php /tmp/fuzz.jsonl
```

Меняй `--seed` — найдёшь новые входы. После починки бага добавь сценарий в
`tests/scripts/` как `*.msl` + `*.expected`, чтобы он попал в обязательный набор
и больше не вернулся.
