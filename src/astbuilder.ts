// Зеркало PHP AstBuilder.php: публичный AST разобранного исходника — стабильная часть
// API (`version`). Внутреннее дерево разбора плоское и служебное; здесь из него
// собирается обычное дерево: каждый узел — объект с полем `type` и местом `loc`.
// Состав узлов и полей описан в AST.md; JSON совпадает с PHP бит-в-бит.
import {CompareType, NodeType, ParseNode} from "./parser";
import {MSLangException} from "./exceptions";

export type AstLoc = {line: number, column: number, endLine: number, endColumn: number} | null;

export type AstExpression =
    | {type: 'Literal', value: string | number | boolean | null, loc: AstLoc}
    | {type: 'Identifier', name: string, loc: AstLoc}
    | {type: 'This', loc: AstLoc}
    | {type: 'Member', object: AstExpression, property: string | AstExpression, computed: boolean, optional: boolean, loc: AstLoc}
    | {type: 'Call', callee: AstExpression, arguments: Array<AstExpression | AstSpread>, optional: boolean, loc: AstLoc}
    | {type: 'New', callee: string, arguments: Array<AstExpression | AstSpread>, loc: AstLoc}
    | {type: 'SuperCall', method: string | null, arguments: Array<AstExpression | AstSpread>, loc: AstLoc}
    | {type: 'Unary', operator: '-' | '+' | '!' | 'typeof', argument: AstExpression, loc: AstLoc}
    | {type: 'Update', operator: '++' | '--', prefix: boolean, argument: AstExpression, loc: AstLoc}
    | {type: 'Binary', operator: string, left: AstExpression, right: AstExpression, loc: AstLoc}
    | {type: 'Logical', operator: '&&' | '||' | '??', left: AstExpression, right: AstExpression, loc: AstLoc}
    | {type: 'Conditional', test: AstExpression, consequent: AstExpression, alternate: AstExpression, loc: AstLoc}
    | {type: 'Assignment', operator: string, target: AstExpression, value: AstExpression, loc: AstLoc}
    | {type: 'Array', elements: Array<AstExpression | AstSpread | AstKeyedElement>, loc: AstLoc}
    | {type: 'Object', properties: AstProperty[], loc: AstLoc}
    | {type: 'Exists', argument: AstExpression, loc: AstLoc}
    | AstFunction;

export type AstSpread = {type: 'Spread', argument: AstExpression, loc: AstLoc};
export type AstKeyedElement = {type: 'KeyedElement', key: AstExpression, value: AstExpression, loc: AstLoc};
export type AstProperty = {type: 'Property', key: string, value: AstExpression, loc: AstLoc};
export type AstParam = {type: 'Param', name: string, rest: boolean, default: AstExpression | null, loc: AstLoc};
export type AstFunction = {type: 'Function' | 'FunctionDeclaration' | 'Method', name: string | null, arrow: boolean, params: AstParam[], body: AstStatement[], loc: AstLoc};
export type AstBlock = {type: 'Block', body: AstStatement[], loc: AstLoc};
export type AstSwitchCase = {type: 'SwitchCase', test: AstExpression | null, body: AstStatement[], loc: AstLoc};

export type AstStatement =
    | {type: 'ExpressionStatement', expression: AstExpression, loc: AstLoc}
    | {type: 'VariableDeclaration', kind: string, name: string, init: AstExpression | null, loc: AstLoc}
    | {type: 'Return', argument: AstExpression | null, loc: AstLoc}
    | {type: 'Throw', argument: AstExpression, loc: AstLoc}
    | {type: 'Break', loc: AstLoc}
    | {type: 'Continue', loc: AstLoc}
    | {type: 'If', test: AstExpression, consequent: AstStatement | null, alternate: AstStatement | null, loc: AstLoc}
    | {type: 'For', init: AstStatement[], test: AstExpression | null, update: AstStatement[], body: AstStatement, loc: AstLoc}
    | {type: 'ForOf', kind: string, name: string, iterable: AstExpression, body: AstStatement, loc: AstLoc}
    | {type: 'While', test: AstExpression, body: AstStatement, loc: AstLoc}
    | {type: 'Switch', discriminant: AstExpression, cases: AstSwitchCase[], loc: AstLoc}
    | {type: 'Try', block: AstStatement, param: string | null, handler: AstBlock | null, finalizer: AstBlock | null, loc: AstLoc}
    | {type: 'ClassDeclaration', name: string, superClass: string | null, methods: AstFunction[], loc: AstLoc}
    | AstBlock
    | AstFunction;

export type AstProgram = {type: 'Program', version: number, body: AstStatement[]};
export type AstExpressionRoot = {type: 'Expression', version: number, expression: AstExpression};

const COMPARE_OPERATORS: Record<number, string> = {
    [CompareType.ctEqual]: '==',
    [CompareType.ctNotEqual]: '!=',
    [CompareType.ctLess]: '<',
    [CompareType.ctGreat]: '>',
    [CompareType.ctLess | CompareType.ctEqual]: '<=',
    [CompareType.ctGreat | CompareType.ctEqual]: '>=',
};

const BINARY_OPERATORS: Record<number, string> = {
    [NodeType.ntPlus]: '+',
    [NodeType.ntMinus]: '-',
    [NodeType.ntMul]: '*',
    [NodeType.ntDiv]: '/',
    [NodeType.ntMod]: '%',
    [NodeType.ntBitAnd]: '&',
    [NodeType.ntBitOr]: '|',
    [NodeType.ntBitXor]: '^',
    [NodeType.ntShiftLeft]: '<<',
    [NodeType.ntShiftRight]: '>>',
    [NodeType.ntUShiftRight]: '>>>',
};

const LOGICAL_OPERATORS: Record<number, '&&' | '||' | '??'> = {
    [NodeType.ntLogicalAnd]: '&&',
    [NodeType.ntLogicalOr]: '||',
    [NodeType.ntNullish]: '??',
};

/** Имена-константы, которые в AST — литералы, а не переменные. */
const LITERAL_NAMES: Record<string, boolean | null> = {'true': true, 'false': false, 'null': null};

export class AstBuilder {
    static readonly VERSION = 1;

    program(nodes: ParseNode[]): AstProgram {
        return {type: 'Program', version: AstBuilder.VERSION, body: this.statements(nodes)};
    }

    /** Корень выражения: узел ntReturn, который строит Script.parseExpression. */
    expression(returnNode: ParseNode): AstExpressionRoot {
        return {type: 'Expression', version: AstBuilder.VERSION, expression: this.expr(returnNode.nodeChildren())};
    }

    // ── Инструкции ──────────────────────────────────────────────────────────────

    private statements(items: unknown[]): AstStatement[] {
        const nodes = items.filter((n): n is ParseNode => n instanceof ParseNode);
        const out: AstStatement[] = [];
        const pending: ParseNode[] = [];

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            switch (node.nType) {
                case NodeType.ntShiftSP:
                    this.flushExpression(pending, out);
                    break;
                case NodeType.ntIF: {
                    this.flushExpression(pending, out);
                    const consequent = nodes[i + 1] ?? null;
                    let alternate: ParseNode | null = null;
                    i++;
                    if (nodes[i + 1]?.nType === NodeType.ntELSE) {
                        alternate = nodes[i + 2] ?? null;
                        i += 2;
                    }
                    out.push({
                        type: 'If',
                        test: this.expr(node.nodeChildren()),
                        consequent: consequent ? this.statement(consequent) : null,
                        alternate: alternate ? this.statement(alternate) : null,
                        loc: AstBuilder.loc(node),
                    });
                    break;
                }
                case NodeType.ntVarDecl:
                case NodeType.ntFor:
                case NodeType.ntForOf:
                case NodeType.ntWhile:
                case NodeType.ntSwitch:
                case NodeType.ntTry:
                case NodeType.ntThrow:
                case NodeType.ntReturn:
                case NodeType.ntBreak:
                case NodeType.ntContinue:
                case NodeType.ntClassDecl:
                case NodeType.ntSubCode:
                    this.flushExpression(pending, out);
                    out.push(this.statement(node));
                    break;
                case NodeType.ntFunctionDef:
                    if (node.nValue !== '' && node.nValue !== null && node.nValue !== undefined && !pending.length) {
                        out.push(this.function(node, 'FunctionDeclaration'));
                        break;
                    }
                    pending.push(node);
                    break;
                default:
                    pending.push(node);
            }
        }

        this.flushExpression(pending, out);

        return out;
    }

    /** Накопленные узлы выражения-инструкции (до ntShiftSP или конца блока) → ExpressionStatement. */
    private flushExpression(pending: ParseNode[], out: AstStatement[]): void {
        if (!pending.length) {
            return;
        }

        const expression = this.expr(pending);
        out.push({type: 'ExpressionStatement', expression, loc: expression.loc});
        pending.length = 0;
    }

    private statement(node: ParseNode): AstStatement {
        const children = node.nodeChildren();
        const loc = AstBuilder.loc(node);

        switch (node.nType) {
            case NodeType.ntSubCode:
                return {type: 'Block', body: this.statements(children), loc};
            case NodeType.ntVarDecl:
                return {type: 'VariableDeclaration', kind: String(node.nValue2), name: String(node.nValue), init: children.length ? this.expr(children) : null, loc};
            case NodeType.ntReturn:
                return {type: 'Return', argument: children.length ? this.expr(children) : null, loc};
            case NodeType.ntThrow:
                return {type: 'Throw', argument: this.expr(children), loc};
            case NodeType.ntBreak:
                return {type: 'Break', loc};
            case NodeType.ntContinue:
                return {type: 'Continue', loc};
            case NodeType.ntFor: {
                const test = AstBuilder.child(node, 1).nodeChildren();
                return {
                    type: 'For',
                    init: this.statements(AstBuilder.child(node, 0).nodeChildren()),
                    test: test.length ? this.expr(test) : null,
                    update: this.statements(AstBuilder.child(node, 2).nodeChildren()),
                    body: this.statement(AstBuilder.child(node, 3)),
                    loc,
                };
            }
            case NodeType.ntForOf:
                return {
                    type: 'ForOf',
                    kind: String(node.nValue2),
                    name: String(node.nValue),
                    iterable: this.expr(AstBuilder.child(node, 0).nodeChildren()),
                    body: this.statement(AstBuilder.child(node, 1)),
                    loc,
                };
            case NodeType.ntWhile:
                return {
                    type: 'While',
                    test: this.expr(AstBuilder.child(node, 0).nodeChildren()),
                    body: this.statement(AstBuilder.child(node, 1)),
                    loc,
                };
            case NodeType.ntSwitch:
                return {
                    type: 'Switch',
                    discriminant: this.expr(AstBuilder.child(node, 0).nodeChildren()),
                    cases: children.slice(1).map((c) => this.switchCase(c)),
                    loc,
                };
            case NodeType.ntTry:
                return this.tryStatement(node);
            case NodeType.ntClassDecl:
                return {
                    type: 'ClassDeclaration',
                    name: String(node.nValue),
                    superClass: node.nValue2 !== null && node.nValue2 !== undefined && node.nValue2 !== '' ? String(node.nValue2) : null,
                    methods: children.map((m) => this.function(m, 'Method')),
                    loc,
                };
        }

        const statement = this.statements([node])[0];
        if (!statement) {
            throw AstBuilder.unsupported(node);
        }
        return statement;
    }

    private switchCase(item: ParseNode): AstSwitchCase {
        const children = item.nodeChildren();

        if (item.nType === NodeType.ntDefault) {
            return {type: 'SwitchCase', test: null, body: this.statements(children), loc: AstBuilder.loc(item)};
        }

        return {
            type: 'SwitchCase',
            test: this.expr(AstBuilder.child(item, 0).nodeChildren()),
            body: this.statements(children.slice(1)),
            loc: AstBuilder.loc(item),
        };
    }

    private tryStatement(node: ParseNode): AstStatement {
        const result: AstStatement & {type: 'Try'} = {
            type: 'Try', block: this.statement(AstBuilder.child(node, 0)), param: null, handler: null, finalizer: null, loc: AstBuilder.loc(node),
        };

        for (const part of node.nodeChildren().slice(1)) {
            if (part.nType === NodeType.ntCatch) {
                result.param = part.nValue !== null && part.nValue !== undefined && part.nValue !== '' ? String(part.nValue) : null;
                result.handler = {type: 'Block', body: this.statements(part.nodeChildren()), loc: AstBuilder.loc(part)};
            } else if (part.nType === NodeType.ntFinally) {
                result.finalizer = {type: 'Block', body: this.statements(part.nodeChildren()), loc: AstBuilder.loc(part)};
            }
        }

        return result;
    }

    private function(node: ParseNode, type: AstFunction['type']): AstFunction {
        const params: AstParam[] = [];
        const body: ParseNode[] = [];

        for (const child of node.nodeChildren()) {
            if (child.nType === NodeType.ntFuncDefParam) {
                const def = child.nodeChildren();
                params.push({
                    type: 'Param',
                    name: String(child.nValue),
                    rest: child.nValue2 === 'rest',
                    default: def.length ? this.expr(def) : null,
                    loc: AstBuilder.loc(child),
                });
                continue;
            }
            body.push(child);
        }

        return {
            type,
            name: node.nValue !== null && node.nValue !== undefined && node.nValue !== '' ? String(node.nValue) : null,
            arrow: node.nValue2 === 'arrow',
            params,
            body: this.statements(body),
            loc: AstBuilder.loc(node),
        };
    }

    // ── Выражения ───────────────────────────────────────────────────────────────

    /**
     * Плоский список узлов одного выражения → дерево (зеркало PHP AstBuilder::expr):
     * операнды с цепочками обращений, префиксы и бинарные операторы слева направо.
     */
    private expr(items: unknown[]): AstExpression {
        const nodes = items.filter((n): n is ParseNode => n instanceof ParseNode);
        if (!nodes.length) {
            throw new MSLangException('AST: empty expression');
        }

        const cursor = {pos: 0};
        let left = this.operand(nodes, cursor);

        while (cursor.pos < nodes.length) {
            const node = nodes[cursor.pos];

            if (node.nType === NodeType.ntExpressionCompare || node.nType === NodeType.ntCompare) {
                const rightNode = nodes[cursor.pos + 1];
                const operator = COMPARE_OPERATORS[node.nValue as number];
                if (!rightNode || operator === undefined) {
                    throw AstBuilder.unsupported(node);
                }
                left = AstBuilder.binary(operator, left, this.expr(rightNode.nodeChildren()));
                cursor.pos += 2;
                continue;
            }

            const operator = BINARY_OPERATORS[node.nType];
            if (operator !== undefined) {
                cursor.pos++;
                const right = this.operand(nodes, cursor);
                left = AstBuilder.binary(operator, left, right);
                continue;
            }

            throw AstBuilder.unsupported(node);
        }

        return left;
    }

    /** Операнд: префиксы, первичное значение и цепочка обращений после него. */
    private operand(nodes: ParseNode[], cursor: {pos: number}): AstExpression {
        const node = nodes[cursor.pos];
        if (!node) {
            throw new MSLangException('AST: operand expected');
        }

        const prefix = node.nType === NodeType.ntMinus ? '-'
            : node.nType === NodeType.ntPlus ? '+'
            : node.nType === NodeType.ntNegativeIf ? '!'
            : node.nType === NodeType.ntTypeof ? 'typeof'
            : null;
        if (prefix !== null) {
            cursor.pos++;
            const argument = this.operand(nodes, cursor);
            return {type: 'Unary', operator: prefix, argument, loc: AstBuilder.span(AstBuilder.loc(node), argument.loc)};
        }

        if (node.nType === NodeType.ntShortIncrement || node.nType === NodeType.ntShortDecrement) {
            cursor.pos++;
            const argument = this.operand(nodes, cursor);
            return {
                type: 'Update',
                operator: node.nType === NodeType.ntShortIncrement ? '++' : '--',
                prefix: true,
                argument,
                loc: AstBuilder.span(AstBuilder.loc(node), argument.loc),
            };
        }

        let value = this.primary(node);
        cursor.pos++;

        let optional = false;
        while (cursor.pos < nodes.length) {
            const next = nodes[cursor.pos];
            const loc = AstBuilder.span(value.loc, AstBuilder.loc(next));

            switch (next.nType) {
                case NodeType.ntOptionalChain:
                    optional = true;
                    cursor.pos++;
                    continue;
                case NodeType.ntObjProp:
                    value = {type: 'Member', object: value, property: String(next.nValue), computed: false, optional, loc};
                    break;
                case NodeType.ntBracketGetKey:
                    value = {type: 'Member', object: value, property: this.expr(next.nodeChildren()), computed: true, optional, loc};
                    break;
                case NodeType.ntSelfFuncCall: {
                    const callee: AstExpression = {type: 'Member', object: value, property: String(next.nValue), computed: false, optional: false, loc};
                    value = {type: 'Call', callee, arguments: this.arguments(next), optional, loc};
                    break;
                }
                case NodeType.ntShortIncrement:
                case NodeType.ntShortDecrement:
                    value = {type: 'Update', operator: next.nType === NodeType.ntShortIncrement ? '++' : '--', prefix: false, argument: value, loc};
                    break;
                case NodeType.ntObjSetPropValue: {
                    const target: AstExpression = {type: 'Member', object: value, property: String(next.nValue), computed: false, optional: false, loc};
                    value = {type: 'Assignment', operator: '=', target, value: this.expr(next.nodeChildren()), loc};
                    break;
                }
                case NodeType.ntBracketSetKey: {
                    const [keyNodes, valueNodes] = (next.childItems ?? []) as unknown[];
                    const target: AstExpression = {type: 'Member', object: value, property: this.expr(Array.isArray(keyNodes) ? keyNodes : []), computed: true, optional: false, loc};
                    value = {type: 'Assignment', operator: '=', target, value: this.expr(Array.isArray(valueNodes) ? valueNodes : []), loc};
                    break;
                }
                case NodeType.ntInstanceof:
                    value = AstBuilder.binary('instanceof', value, {type: 'Identifier', name: String(next.nValue), loc: AstBuilder.loc(next)});
                    break;
                default:
                    return value;
            }

            optional = false;
            cursor.pos++;
        }

        return value;
    }

    private primary(node: ParseNode): AstExpression {
        const children = node.nodeChildren();
        const loc = AstBuilder.loc(node);

        switch (node.nType) {
            case NodeType.ntContextVariable: {
                const name = String(node.nValue);
                if (Object.prototype.hasOwnProperty.call(LITERAL_NAMES, name)) {
                    return {type: 'Literal', value: LITERAL_NAMES[name], loc};
                }
                return {type: 'Identifier', name, loc};
            }
            case NodeType.ntNumeric:
            case NodeType.ntFloat:
            case NodeType.ntString:
                return {type: 'Literal', value: node.nValue as string | number, loc};
            case NodeType.ntSubExpression:
            case NodeType.ntIFValue:
            case NodeType.ntIFValueBOOL:
                return this.expr(children);
            case NodeType.ntThis:
                return {type: 'This', loc};
            case NodeType.ntArray:
                return {type: 'Array', elements: children.map((e) => this.arrayElement(e)), loc};
            case NodeType.ntObject:
                return {
                    type: 'Object',
                    properties: children.map((e) => ({type: 'Property' as const, key: String(e.nValue), value: this.expr(e.nodeChildren()), loc: AstBuilder.loc(e)})),
                    loc,
                };
            case NodeType.ntFuncCall:
                return {type: 'Call', callee: {type: 'Identifier', name: String(node.nValue), loc}, arguments: this.arguments(node), optional: false, loc};
            case NodeType.ntFuncNameSpaceCall:
                return {
                    type: 'Call',
                    callee: {type: 'Member', object: {type: 'Identifier', name: String(node.nValue), loc}, property: String(node.nValue2), computed: false, optional: false, loc},
                    arguments: this.arguments(node),
                    optional: false,
                    loc,
                };
            case NodeType.ntNew:
                return {type: 'New', callee: String(node.nValue), arguments: this.arguments(node), loc};
            case NodeType.ntSuperCall:
                return {type: 'SuperCall', method: null, arguments: this.arguments(node), loc};
            case NodeType.ntSuperMethodCall:
                return {type: 'SuperCall', method: String(node.nValue), arguments: this.arguments(node), loc};
            case NodeType.ntFunctionDef:
                return this.function(node, 'Function');
            case NodeType.ntExists:
                return {type: 'Exists', argument: this.expr(children), loc};
            case NodeType.ntTernary:
                return {
                    type: 'Conditional',
                    test: this.expr(AstBuilder.child(node, 0).nodeChildren()),
                    consequent: this.expr(AstBuilder.child(node, 1).nodeChildren()),
                    alternate: this.expr(AstBuilder.child(node, 2).nodeChildren()),
                    loc,
                };
            case NodeType.ntLogicalAnd:
            case NodeType.ntLogicalOr:
            case NodeType.ntNullish: {
                const left = this.expr([AstBuilder.child(node, 0)]);
                const right = this.expr([AstBuilder.child(node, 1)]);
                return {type: 'Logical', operator: LOGICAL_OPERATORS[node.nType], left, right, loc: AstBuilder.span(left.loc, right.loc)};
            }
            case NodeType.ntExpressionAssign:
            case NodeType.ntCompoundAssign:
                return {
                    type: 'Assignment',
                    operator: node.nType === NodeType.ntCompoundAssign ? String(node.nValue2) + '=' : '=',
                    target: {type: 'Identifier', name: String(node.nValue), loc},
                    value: this.expr(children),
                    loc,
                };
        }

        throw AstBuilder.unsupported(node);
    }

    private arguments(call: ParseNode): Array<AstExpression | AstSpread> {
        return call.nodeChildren().map((param) => {
            const value = this.expr(param.nodeChildren());
            return param.nType === NodeType.ntFuncParamArrayUnpack
                ? {type: 'Spread' as const, argument: value, loc: AstBuilder.loc(param)}
                : value;
        });
    }

    private arrayElement(element: ParseNode): AstExpression | AstSpread | AstKeyedElement {
        const children = element.nodeChildren();

        switch (element.nType) {
            case NodeType.ntArrayPushArrayUnpack:
                return {type: 'Spread', argument: this.expr(children), loc: AstBuilder.loc(element)};
            case NodeType.ntArrayPushSeparator:
                return {
                    type: 'KeyedElement',
                    key: this.expr(AstBuilder.child(element, 0).nodeChildren()),
                    value: this.expr(children.slice(1)),
                    loc: AstBuilder.loc(element),
                };
        }

        return this.expr(children);
    }

    // ── Помощники ───────────────────────────────────────────────────────────────

    private static binary(operator: string, left: AstExpression, right: AstExpression): AstExpression {
        return {type: 'Binary', operator, left, right, loc: AstBuilder.span(left.loc, right.loc)};
    }

    private static child(node: ParseNode, index: number): ParseNode {
        const child = node.nodeChildren()[index];
        if (!child) {
            throw AstBuilder.unsupported(node);
        }
        return child;
    }

    private static loc(node: ParseNode): AstLoc {
        const cursor = node.cursorPos;
        if (!cursor || !cursor.startCursorLine || !cursor.startCursorCol) {
            return null;
        }

        return {
            line: cursor.startCursorLine,
            column: cursor.startCursorCol,
            endLine: cursor.endCursorLine || cursor.startCursorLine,
            endColumn: cursor.endCursorCol || cursor.startCursorCol,
        };
    }

    /** Место от начала одного узла до конца другого. */
    private static span(from: AstLoc, to: AstLoc): AstLoc {
        if (from === null || to === null) {
            return from ?? to;
        }

        const toIsLater = to.endLine > from.endLine || (to.endLine === from.endLine && to.endColumn > from.endColumn);

        return {
            line: from.line,
            column: from.column,
            endLine: toIsLater ? to.endLine : from.endLine,
            endColumn: toIsLater ? to.endColumn : from.endColumn,
        };
    }

    private static unsupported(node: ParseNode): MSLangException {
        return new MSLangException('AST: unexpected node ' + node.typeName);
    }
}
