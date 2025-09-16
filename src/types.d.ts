type InvokeArguments = (StackVariable | null)[];

// Mapped type: зависимость от VariableType
type SpecificStackVariable<T extends VariableType> =
// Группируем алиасы
    T extends VariableType.vtNumber | VariableType.vtFloat | VariableType.vtInteger
        ? StackVariableNumber
        : T extends VariableType.vtString
            ? StackVariableString
            : T extends VariableType.vtBoolean
                ? StackVariableBoolean  // Предполагаем, что такой подтип есть
                : T extends VariableType.vtArray
                    ? StackVariableArray
                    : StackVariable;  // Fallback для неподдержанных типов


interface RefProxyCallback {
    get(): object;
    set(value: object): void;
}