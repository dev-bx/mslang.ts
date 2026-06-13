import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";
import {InterpreterException} from "./exceptions.js";

/**
 * Sentinel-значение для переменных, объявленных через `let` или `const`,
 * но ещё не инициализированных (zone между началом блока и строкой
 * декларации). Соответствует JS `Temporal Dead Zone`.
 *
 * Создаётся в {@link Interpreter.hoistLetConst} в начале каждого блока.
 * Любая попытка прочитать значение, привести к типу или взять свойство
 * до выполнения соответствующего `ntVarDecl`-handler-а бросает ошибку
 * времени выполнения.
 *
 * После инициализации (`let x = expr;`) sentinel заменяется на обычный
 * `StackVariable*` через `ContextInterpreter._variables[name] = ...`.
 *
 * Зеркало PHP-эталона `StackVariableTDZ` из mslang.php.
 */
export class StackVariableTDZ extends StackVariable {
    private readonly _name: string;

    constructor(name: string) {
        //isConst=true: popExecutionStack пропускает const-переменные, что
        //защищает sentinel от случайного setValue в auto-copy.
        super(VariableType.vtUndefined, true);
        this._name = name;
    }

    get name(): string {
        return this._name;
    }

    get value(): unknown {
        throw new InterpreterException("Cannot access '" + this._name + "' before initialization", this.getContext()?.currentToken?.cursorPos);
    }
    set value(_v: unknown) {
        //Эту ошибку увидим только если кто-то напрямую трогает sentinel
        //обходя varDeclHandler — нормальное объявление заменяет sentinel
        //в _variables новым StackVariable, а не пишет в его value.
        throw new InterpreterException("Cannot assign to '" + this._name + "' before initialization", this.getContext()?.currentToken?.cursorPos);
    }

    castAs<T extends VariableType>(_variableType: T): StackVariable | null {
        throw new InterpreterException("Cannot access '" + this._name + "' before initialization", this.getContext()?.currentToken?.cursorPos);
    }

    toPrimitive(): StackVariable {
        throw new InterpreterException("Cannot access '" + this._name + "' before initialization", this.getContext()?.currentToken?.cursorPos);
    }
}
