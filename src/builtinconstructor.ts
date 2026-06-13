import type {StackVariable} from "./stackvariable";
import type {ContextInterpreter} from "./interpreter.js";

/**
 * Контракт для нативных «классов» (Array, ...), которые можно создавать через
 * `new Foo(args)`. Зеркало PHP BuiltinConstructorInterface.
 *
 * В TS интерфейсы стираются в рантайме, поэтому диспетчеризация `new` идёт не
 * по `instanceof` конкретного класса, а по проверке контракта isBuiltinConstructor().
 */
export interface BuiltinConstructor {
    /**
     * Создаёт новый объект из параметров. Результат кладётся на стек как
     * значение выражения `new`.
     */
    construct(parameters: StackVariable[], context: ContextInterpreter | null): StackVariable;
}

export function isBuiltinConstructor(value: unknown): value is BuiltinConstructor {
    return value !== null
        && typeof value === 'object'
        && typeof (value as BuiltinConstructor).construct === 'function';
}
