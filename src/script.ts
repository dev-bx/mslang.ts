// Зеркало PHP Script.php: точка входа для разбора исходника. Выражение и программа
// разбираются по грамматике, а не по догадке о тексте (например, по слову `return`,
// которое может стоять внутри строки: `"return" + "x"`).
import {CodeLexer, LexerType, LexerTypeArray} from "./lexer";
import {CodeParser, NodeType, ParseNode} from "./parser";
import {ParsedScript} from "./parsedscript";
import {ErrorCode, MSLangException, ParserCursorException} from "./exceptions";

export class Script {
    private constructor() {
    }

    /**
     * Ровно одно выражение до конца текста. Инструкции (`;`, `return`, `let`, `if`…) —
     * ошибка разбора с местом. Литерал объекта `{a: 1}` в начале — это объект, а не блок.
     */
    static parseExpression(source: string): ParsedScript {
        const lexer = new CodeLexer(source);
        const parser = new CodeParser(lexer);

        const returnNode = new ParseNode(undefined, NodeType.ntReturn);
        try {
            parser.parseExpression(returnNode, true, LexerTypeArray.one(LexerType.ltEof));
        } catch (e) {
            // Ошибка «на уровне всего выражения» привязана к узлу-обёртке без места —
            // ставим место токена, на котором разбор остановился.
            if (!(e instanceof MSLangException) || e.getSourceLine() !== null) {
                throw e;
            }
            throw new ParserCursorException(e.getRawMessage(), lexer.tokenCursor, e.getErrorCode());
        }

        return new ParsedScript(ParsedScript.KIND_EXPRESSION, [returnNode], source, lexer.getWarnings());
    }

    /** Программа — последовательность инструкций; значение отдаёт `return`. */
    static parseProgram(source: string): ParsedScript {
        const lexer = new CodeLexer(source);
        const parser = new CodeParser(lexer);

        const nodes: ParseNode[] = [];
        parser.parseCode(nodes, true, true, LexerTypeArray.one(LexerType.ltEof));

        return new ParsedScript(ParsedScript.KIND_PROGRAM, nodes, source, lexer.getWarnings());
    }

    /**
     * Выражение, если весь текст — одно выражение, иначе программа. Если не годится ни
     * то, ни другое, — ошибка того разбора, который продвинулся по тексту дальше: она
     * точнее указывает место.
     */
    static parse(source: string): ParsedScript {
        let expressionError: MSLangException;
        try {
            return Script.parseExpression(source);
        } catch (e) {
            if (!(e instanceof MSLangException) || e.getErrorCode() !== ErrorCode.ParseError) {
                throw e;
            }
            expressionError = e;
        }

        try {
            return Script.parseProgram(source);
        } catch (e) {
            if (!(e instanceof MSLangException)) {
                throw e;
            }
            throw Script.furtherError(expressionError, e);
        }
    }

    private static furtherError(expression: MSLangException, program: MSLangException): MSLangException {
        const position = (e: MSLangException): [number, number] => [e.getSourceLine() ?? 0, e.getSourceColumn() ?? 0];
        const [el, ec] = position(expression);
        const [pl, pc] = position(program);

        return el > pl || (el === pl && ec > pc) ? expression : program;
    }
}
