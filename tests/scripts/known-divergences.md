# Известные расхождения TS ↔ PHP

Фаззер `tests/fuzz.ts` + `tests/fuzz.php` (PHP-сторона в `devbx.core`) систематически находит, на каких комбинациях значений MSLang ведёт себя по-разному в двух интерпретаторах. Список ниже — то, что найдено и пока не починено. **PHP — эталон.**

Перед закрытием каждого пункта добавляй cross-runtime скрипт в `tests/scripts/`, чтобы регрессия больше не вернулась.

## Из прогона `--count 200 --seed 42`

| # | Скрипт | TS | PHP | Группа |
|---|--------|----|----|--------|
| 1 | `return (false != null);` | `true` | `false` | `null != boolean` |
| 2 | `return ("ab" == (true \|\| null)) \|\| (null - ("" == null));` | `0` | `true` | null-arithmetic |
| 3 | `return ((true * null) == null) == ((-7 + "a") != (null == 7));` | `false` | `true` | null-arithmetic |
| 4 | `return ((false * null) == (null == "")) \|\| (("b" != "b") * (false * "1"));` | `true` | `0` | null-arithmetic + bool*string |
| 5 | `return ((false != null) \|\| (-4 - "ab")) * (("b" != "b") + (null * true));` | `0` | `"NaN"` | NaN propagation |
| 6 | `return ((null * null) == "") + ((null * "b") != (false * true));` | `2` | `1` | null-arithmetic |
| 7 | `return ("b" - "1") == true;` | `false` | `true` | string-to-number |
| 8 | `return false \|\| (2 - ("" != null));` | `1` | `2` | empty string comparison |
| 9 | `return null == ((10 * null) == -9);` | `false` | `true` | null-arithmetic |

## Как искать дальше

```bash
# в devbx.mslang
npx tsx tests/fuzz.ts --count 500 --seed 1 > /tmp/fuzz.jsonl
# в devbx.core
php tests/fuzz.php /tmp/fuzz.jsonl
```

Меняй seed — найдёшь новые входы. После починки бага добавь конкретный сценарий в `tests/scripts/` как обычный `.msl` + `.expected`, чтобы он попал в обязательный набор.
