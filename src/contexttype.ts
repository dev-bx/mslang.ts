// Зеркало PHP ContextType.php: режимы хода выполнения для ContextInterpreter.
export const ContextType = {
    'ctNormal': 0,
    'ctAllowBreak': 1,
    'ctReturn': 2,
    /** Граница вызова пользовательской функции — на ней останавливается отмотка `return`. */
    'ctFunctionCall': 3,
    /** Граница блока try — на ней останавливается отмотка throw для передачи в catch. */
    'ctCatch': 4,
}
