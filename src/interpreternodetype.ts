// Зеркало PHP InterpreterNodeType.php: служебные виды узлов интерпретатора (коды от 1000).
export const InterpreterNodeType = {
    'ntAssignFinish': 1000,
    'ntFuncCallFinish': 1001,
    'ntSubExpressionFinish': 1002,
    'ntFuncParamFinish': 1003,
    'ntIFFinish': 1004,
    'ntIFValueFinish': 1005,
    'ntIFValueBOOLFinish': 1006,
    'ntSubCodeFinish': 1007,
    'ntForLoop': 1008,
    'ntForCompareFinish': 1009,
    'ntReturnFinish': 1010,
    'ntExpressionAssignFinish': 1011,
    'ntSelfFuncCallFinish': 1012,
    'ntArrayFinish': 1013,
    'ntArrayPushFinish': 1014,
    'ntBracketGetKeyFinish': 1015,
    'ntBracketSetKeyLeftFinish': 1016,
    'ntBracketSetKeyRightFinish': 1017,
    'ntFuncParamArrayUnpackFinish': 1018,
    'ntArrayPushSeparatorKeyFinish': 1019,
    'ntArrayPushSeparatorFinish': 1020,
    'ntArrayPushKeyValue': 1021,
    'ntArrayPushArrayUnpackFinish': 1022,
    'ntObjSetPropValueFinish': 1023,
    'ntSwitchEvaluated': 1024,
    /** Завершение вызова пользовательской функции: снимает её scope, оставляет результат. */
    'ntUserFuncFinish': 1025,
    /** Завершение try без исключений: снимает catch-scope и продолжает выполнение. */
    'ntTryFinish': 1026,
    /** Завершение throw: после вычисления выражения отматывает стек до ближайшего catch. */
    'ntThrowFinish': 1027,
    /** Завершение new ClassName(args): собирает аргументы и вызывает builtin-constructor. */
    'ntNewFinish': 1028,
    /** Технический узел, который очищает _executionStack-фрейм finally после его выполнения. */
    'ntFinallyFinish': 1029,
    /**
     * Финиш `new Class(args)` поверх пользовательского конструктора. Запускается
     * после `ntUserFuncFinish` тела конструктора: снимает значение, которое
     * вернула функция (undefined по умолчанию), и оставляет на стеке instance,
     * который положил `newFinishHandler` перед вызовом конструктора.
     */
    'ntCtorReturnInstance': 1030,
    /**
     * Финиш `super(args)` — вызова родительского конструктора. После
     * `ntUserFuncFinish` родителя снимает его undefined-возврат и пушит
     * undefined как результат самого `super(...)` выражения. Дополнительно
     * сбрасывает TDZ-флаг текущего ctor-кадра (super был вызван).
     */
    'ntSuperCallFinish': 1031,
    /**
     * Финиш `super.method(args)` — вызова родительского метода. Не трогает стек:
     * значение, возвращённое методом, идёт наверх как обычно.
     */
    'ntSuperMethodCallFinish': 1032,
    /**
     * Финиш `let|var|const name = expr;` — после вычисления инициализатора
     * снимает его со стека и записывает в нужный scope (блочный для let/const,
     * функциональный для var), заменяя TDZ-sentinel.
     */
    'ntVarDeclFinish': 1033,
    //Финиш compound-assign x += expr и т.п.
    'ntCompoundAssignFinish': 1034,
    //Финиш тернарного оператора cond ? a : b.
    'ntTernaryFinish': 1035,
    //for (X of iterable) — старт и tick.
    'ntForOfStart': 1036,
    'ntForOfTick': 1037,
}
