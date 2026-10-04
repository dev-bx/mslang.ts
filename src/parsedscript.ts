// Зеркало PHP ParsedScript.php: результат разбора через Script — вид (выражение или
// программа) и дерево разбора. Выражение исполняется как `return <выражение>;`.
import {ParseNode} from "./parser";
import {Interpreter} from "./interpreter";
import {ContextInterpreter} from "./contextinterpreter";
import {AstBuilder, type AstExpressionRoot, type AstProgram} from "./astbuilder";
import type {LexerWarning} from "./lexer";

export type ParsedScriptKind = 'expression' | 'program';

export class ParsedScript {
    static readonly KIND_EXPRESSION: ParsedScriptKind = 'expression';
    static readonly KIND_PROGRAM: ParsedScriptKind = 'program';

    constructor(
        private readonly kind: ParsedScriptKind,
        private readonly nodes: ParseNode[],
        private readonly source: string,
        private readonly warnings: LexerWarning[] = [],
    ) {
    }

    /**
     * Предупреждения разбора (CodeLexer.WARNING_*): исходник корректен, но, скорее всего,
     * значит не то, что хотел автор (`'a\nb'` в одинарных кавычках — не перенос строки).
     */
    getWarnings(): LexerWarning[] {
        return this.warnings;
    }

    /** `expression` или `program`. */
    getKind(): ParsedScriptKind {
        return this.kind;
    }

    isExpression(): boolean {
        return this.kind === ParsedScript.KIND_EXPRESSION;
    }

    getNodes(): ParseNode[] {
        return this.nodes;
    }

    getSource(): string {
        return this.source;
    }

    /** Публичный AST (см. AstBuilder и AST.md): `Expression` для выражения, `Program` для программы. */
    toAst(): AstExpressionRoot | AstProgram {
        const builder = new AstBuilder();

        return this.kind === ParsedScript.KIND_EXPRESSION
            ? builder.expression(this.nodes[0])
            : builder.program(this.nodes);
    }

    /**
     * Готовый к исполнению контекст: обработчики зарегистрированы, встроенные значения
     * (`Math`, `JSON`, `true`/`false`/`null`…) добавлены. Хост регистрирует свои
     * значения и функции и вызывает `exec(true)`.
     */
    createContext(): ContextInterpreter {
        const interpreter = new Interpreter();
        interpreter.registerHandlers();

        const context = new ContextInterpreter(this.nodes, interpreter);
        context.registerConst();

        return context;
    }
}
