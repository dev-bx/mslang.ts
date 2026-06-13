import {LexerTypeArray, LexerType, CodeLexer, TokenCursor} from "./lexer.js";
import {MSLangException, ParserCursorException, ParserNodeException} from "./exceptions";

export enum CompareType {
    ctEqual = 1,     // Равно
    ctNotEqual = 2,  // Не равно
    ctLess = 4,      // Меньше
    ctGreat = 8      // Больше
}

export const NodeType =
    {
        'ntNotSet': 0,
        'ntAssign': 1,
        'ntPlus': 2,
        'ntMinus': 3,
        'ntDiv': 4,
        'ntMul': 5,
        'ntMod': 6,
        'ntBitAnd': 7,
        'ntObjProp': 8,
        'ntNumeric': 9,
        'ntFloat': 10,
        'ntString': 11,
        'ntSubExpression': 12,
        'ntFuncNameSpaceCall': 13, //class::function()
        'ntFuncCall': 14, //obj.function()
        'ntFuncParam': 15,
        'ntShiftSP': 16,
        'ntIF': 17,
        'ntELSE': 18,
        'ntIFValue': 19,
        'ntIFValueBOOL': 20,
        'ntCompare': 21,
        'ntCompareAnd': 22,
        'ntCompareOr': 23,
        'ntSubCode': 24,
        'ntReturn': 25,
        'ntSuper': 26,
        'ntSwitch': 27,
        'ntCase': 28,
        'ntBreak': 29,
        'ntFor': 30,
        'ntForCompare': 31,
        'ntWhile': 32,
        'ntShortIncrement': 33,
        'ntShortDecrement': 34,
        'ntExpressionCompare': 35,
        'ntExpressionAssign' : 36,
        'ntNegativeIf' : 37,
        'ntSelfFuncCall': 38,
        'ntContextVariable': 39,
        'ntArray': 40,
        'ntArrayPush': 41,
        'ntBracketGetKey': 42,
        'ntBracketSetKey': 43,
        'ntFuncParamArrayUnpack': 44,
        'ntArrayPushSeparator': 45,
        'ntArrayPushSeparatorKey': 46,
        'ntArrayPushArrayUnpack': 47,
        'ntObjSetPropValue': 48,
        'ntContinue': 49,
        'ntDefault': 50,
        /** Определение пользовательской функции: nValue = имя, childItems = [ntFuncDefParam..., тело...]. */
        'ntFunctionDef': 51,
        /** Параметр в определении функции: nValue = имя, childItems = [default-выражение] или пусто. */
        'ntFuncDefParam': 52,
        /** try { ... } catch (e) { ... } finally { ... }. childItems = [ntSubCode(body), ntCatch, ntFinally?] */
        'ntTry': 53,
        /** Блок catch (e) { ... }. nValue = имя параметра (пусто если catch без параметра). childItems = тело. */
        'ntCatch': 54,
        /** Блок finally { ... }. childItems = тело. */
        'ntFinally': 55,
        /** Оператор throw <expr>;. childItems = выражение. */
        'ntThrow': 56,
        /** Оператор new ClassName(args). nValue = имя класса, childItems = аргументы. */
        'ntNew': 57,
        /**
         * Объявление класса: `class Name [extends Parent] { constructor(...) { ... } method1(...) { ... } ... }`.
         * nValue = имя класса, nValue2 = имя родительского класса (или null).
         * childItems = массив `ntFunctionDef` (конструктор и методы, один из них
         * может иметь имя `constructor`).
         */
        'ntClassDecl': 58,
        /** Ссылка `this` внутри конструктора и методов. childItems и nValue не используются. */
        'ntThis': 59,
        /** Вызов родительского конструктора: `super(args)`. childItems = аргументы. */
        'ntSuperCall': 60,
        /** Вызов метода родителя: `super.method(args)`. nValue = имя метода, childItems = аргументы. */
        'ntSuperMethodCall': 61,
        /**
         * Оператор `obj instanceof Class`. nValue = имя класса справа.
         * Левый операнд уже лежит на стеке как предыдущий узел выражения.
         * Возвращает boolean.
         */
        'ntInstanceof': 62,
        /**
         * Объявление переменной: `let a [= expr];`, `var a [= expr];`, `const a = expr;`.
         * Несколько объявлений в одной строке (`let a = 1, b = 2;`) парсер
         * разворачивает в несколько узлов `ntVarDecl`.
         *
         * - nValue  = имя переменной;
         * - nValue2 = вид: 'var' | 'let' | 'const';
         * - childItems = инициализатор (одно поддерево-выражение) или пусто.
         */
        'ntVarDecl': 63,
        //Битовые операции (расширение ntBitAnd).
        'ntBitOr': 64,
        'ntBitXor': 65,
        'ntShiftLeft': 66,
        'ntShiftRight': 67,
        'ntUShiftRight': 68,
        //Тернарный оператор `cond ? a : b`.
        'ntTernary': 69,
        //Compound-assign `x += expr` и т.п.
        'ntCompoundAssign': 70,
        //for-of цикл.
        'ntForOf': 71,
    }

export class ParseNode
{
    private _cursorPos: TokenCursor
    private _nType:number = NodeType.ntNotSet
    private _nValue: unknown
    private _nValue2: unknown
    // Обычные узлы держат плоский ParseNode[]. Исключение — `ntBracketSetKey`,
    // где childItems[0] и childItems[1] — сами массивы ParseNode (путь к ячейке
    // и выражение присваивания). Эталон PHP, см. ParseNode.php и CodeParser.php.
    private _childItems: Array<ParseNode|ParseNode[]>|null = null

    constructor(cursorPos: TokenCursor, nType?:number, nValue?: unknown) {

        this._cursorPos = cursorPos;

        if (nType !== undefined)
        {
            this._nType = nType;
            this._nValue = nValue;
        }
    }

    get cursorPos()
    {
        return this._cursorPos;
    }

    get nType()
    {
        return this._nType;
    }

    set nType(value)
    {
        if (value === undefined)
            throw new ParserCursorException('Set undefined nType', this._cursorPos);

        this._nType = value;
    }

    get nValue()
    {
        return this._nValue;
    }

    set nValue(value)
    {
        this._nValue = value;
    }

    get nValue2()
    {
        return this._nValue2;
    }

    set nValue2(value)
    {
        this._nValue2 = value;
    }

    get childItems()
    {
        return this._childItems;
    }

    set childItems(value)
    {
        this._childItems = value;
    }

    get typeName()
    {
        const k = Object.keys(NodeType),
            v = Object.values(NodeType);

        return k[v.indexOf(this.nType)];
    }

    isMathNode()
    {
        switch (this.nType)
        {
            case NodeType.ntPlus:
            case NodeType.ntMinus:
            case NodeType.ntMul:
            case NodeType.ntDiv:
            case NodeType.ntMod:
            case NodeType.ntBitAnd:
            case NodeType.ntBitOr:
            case NodeType.ntBitXor:
            case NodeType.ntShiftLeft:
            case NodeType.ntShiftRight:
            case NodeType.ntUShiftRight:
            case NodeType.ntNegativeIf:
                return true;
        }

        return false;
    }

    isCompareOrAndNode()
    {
        return this.nType === NodeType.ntCompareOr || this.nType === NodeType.ntCompareAnd;
    }

    /**
     * Возвращает плоский список потомков как `ParseNode[]`. Все обычные узлы
     * хранят childItems именно так. Исключение — `ntBracketSetKey`, где
     * childItems[0] и childItems[1] это уже массивы ParseNode (см. парсер).
     * Для него такой узкий доступ невозможен — обращайся к индексам напрямую.
     *
     * Зеркало `ParseNode::nodeChildren()` из PHP.
     */
    nodeChildren(): ParseNode[]
    {
        if (this._childItems === null)
            return [];

        const result: ParseNode[] = [];
        for (let i = 0; i < this._childItems.length; i++) {
            const item = this._childItems[i];
            if (item instanceof ParseNode) {
                result.push(item);
            } else {
                throw new MSLangException(
                    'childItems[' + i + '] is not a ParseNode; this is the ntBracketSetKey tuple shape — '
                    + 'access childItems[0]/[1] directly instead of iterating.'
                );
            }
        }
        return result;
    }

}

export class CodeParser {
    private lexer: CodeLexer;
    private reservedWords: string[];
    constructor(lexer: CodeLexer) {
        this.lexer = lexer;

        this.reservedWords = [
            'break',
            'clone',
            'die',
            'empty',
            'function',
            'or',
            'switch',
            'abstract',
            'const',
            'do',
            'finally',
            'print',
            'throw',
            'var',
            'let',
            'continue',
            'echo',
            'goto',
            'instanceof',
            'private',
            'for',
            'return',
            'if',
            'while',
            'array',
            'catch',
            'else',
            'exit',
            'protected',
            'try',
            'xor',
            'as',
            'elseif',
            'foreach',
            'new',
            'public',
            'static',
            'unset',
            'delete'
        ];
    }

    destroy()
    {
        this.lexer = (undefined as unknown as CodeLexer);
    }

    parseCompareToken(str:string)
    {
        if (str === "!=")
            return CompareType.ctNotEqual;
        if (str === "==")
            return CompareType.ctEqual;
        if (str === ">=")
            return CompareType.ctGreat | CompareType.ctEqual;
        if (str === "<=")
            return CompareType.ctLess | CompareType.ctEqual;
        if (str === ">")
            return CompareType.ctGreat;
        if (str === "<")
            return CompareType.ctLess;

        throw new ParserCursorException("Unknown compare token", this.lexer.tokenCursor);
    }

    parseExpression(ParentNode: ParseNode, getFirstToken: boolean, StopLex: LexerTypeArray, allowEmpty: boolean = false)
    {
        let NodeList: ParseNode[] = [];
        let getNextToken = getFirstToken;

        while (true)
        {
            if (getNextToken)
                this.lexer.getToken();

            getNextToken = true;
            if (StopLex.indexOf(this.lexer.tokenSym) !== -1)
                break;

            let SubNode = null;
            const prevNode = NodeList.length ? NodeList[NodeList.length-1] : null;

            switch (this.lexer.tokenSym)
            {
                case LexerType.ltPlus:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntPlus);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltMinus:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMinus);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltMul:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid mul operator', prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMul);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltDiv:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid div operator', prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntDiv);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltMod:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid mod operator', prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMod);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBitAnd:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid BitAnd operator', prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBitAnd);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBitOr:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid BitOr operator', prevNode);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBitOr);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBitXor:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid BitXor operator', prevNode);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBitXor);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltShiftLeft:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid << operator', prevNode);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntShiftLeft);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltShiftRight:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid >> operator', prevNode);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntShiftRight);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltUShiftRight:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserNodeException('Invalid >>> operator', prevNode);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntUShiftRight);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltObjProp:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntObjProp, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltNumeric:
                    if (prevNode && !prevNode.isMathNode() && !prevNode.isCompareOrAndNode() && prevNode.nType !== NodeType.ntArrayPushSeparatorKey)
                        throw new ParserNodeException("Parse expression failed", prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntNumeric, parseInt(this.lexer.tokenValue));
                    if (!Number.isInteger(SubNode.nValue))
                        throw new ParserNodeException("Failed parse integer value "+this.lexer.tokenValue, SubNode);

                    NodeList.push(SubNode);
                    break;
                case LexerType.ltFloat:
                    if (prevNode && !prevNode.isMathNode() && !prevNode.isCompareOrAndNode() && prevNode.nType !== NodeType.ntArrayPushSeparatorKey)
                        throw new ParserNodeException("Parse expression failed", prevNode);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFloat, parseFloat(this.lexer.tokenValue));

                    if (isNaN(SubNode.nValue as number))
                        throw new ParserNodeException("Failed parse float value "+this.lexer.tokenValue, SubNode);

                    NodeList.push(SubNode);
                    break;
                case LexerType.ltString:
                    if (prevNode && [NodeType.ntPlus, NodeType.ntMinus, NodeType.ntMul, NodeType.ntDiv, NodeType.ntNegativeIf, NodeType.ntArrayPushSeparatorKey].indexOf(prevNode.nType) === -1)
                        throw new ParserNodeException("Parse string expression failed", prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntString, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltThis:
                    //this — ссылка на текущий instance внутри метода/конструктора.
                    //За пределами метода runtime бросит ошибку, но синтаксически
                    //разрешено где угодно в выражении.
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntThis);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltFunction: {
                    //function-выражение: `this.greet = function() { ... };` —
                    //анонимная функция как значение справа от `=`. Имя может
                    //отсутствовать (anonymous) — тогда nValue = '', и узел
                    //обработчик при выполнении не регистрирует UserFunction
                    //в _variables, а кладёт её на стек как значение.
                    const exprFuncList: Array<ParseNode | ParseNode[]> = [];
                    this.parseFunctionDef(exprFuncList, true);
                    //parseFunctionDef кладёт ровно один ParseNode (ntFunctionDef).
                    const exprFunc = exprFuncList[0];
                    if (!(exprFunc instanceof ParseNode)) {
                        throw new ParserCursorException("Function expression failed", this.lexer.tokenCursor);
                    }
                    NodeList.push(exprFunc);
                    break;
                }
                case LexerType.ltSuper: {
                    //super должен идти строго в одной из двух форм:
                    //  super(args)         — вызов родительского ctor (ntSuperCall)
                    //  super.method(args)  — вызов метода родителя (ntSuperMethodCall)
                    //Любая другая форма (super как значение, super[...]) — ошибка.
                    this.lexer.getToken();
                    if (this.lexer.tokenSym === LexerType.ltLPar) {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSuperCall);
                        this.parseFunctionParams(SubNode);
                        NodeList.push(SubNode);
                        break;
                    }
                    if (this.lexer.tokenSym === LexerType.ltObjProp) {
                        const methodName = this.lexer.tokenValue;
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSuperMethodCall, methodName);
                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar) {
                            throw new ParserCursorException("'super." + methodName + "' expects '('", this.lexer.tokenCursor);
                        }
                        this.parseFunctionParams(SubNode);
                        NodeList.push(SubNode);
                        break;
                    }
                    throw new ParserCursorException("'super' expects '(' or '.method'", this.lexer.tokenCursor);
                }
                case LexerType.ltNew:
                    //new ClassName(args) — оператор создания экземпляра. На данный
                    //этап поддерживаем только builtin-конструкторы (например Error),
                    //user-defined classes — отдельная задача.
                    this.lexer.getToken();
                    if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                        throw new ParserCursorException("'new' expects class name", this.lexer.tokenCursor);
                    }
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntNew, this.lexer.tokenValue);
                    this.lexer.getToken();
                    if (this.lexer.tokenSym !== LexerType.ltLPar) {
                        throw new ParserCursorException("'new " + SubNode.nValue + "' expects '('", this.lexer.tokenCursor);
                    }
                    this.parseFunctionParams(SubNode);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltIDStr:
                    /*
                    if (prevNode && !prevNode.isMathNode())
                        throw new ParserCursorException("Parse expression failed", this.lexer.tokenCursor);
                     */

                    SubNode = new ParseNode(this.lexer.tokenCursor);
                    const saveToken = this.lexer.tokenValue;

                    if (this.reservedWords.indexOf(saveToken.toLowerCase())>=0)
                    {
                        // Зеркало PHP: зарезервированное слово как голый идентификатор — ошибка.
                        throw new ParserCursorException('Using reserved word "' + saveToken + '"', this.lexer.tokenCursor);
                    }

                    this.lexer.getToken();
                    if (this.lexer.tokenSym !== LexerType.ltNameSpace)
                    {
                        if (this.lexer.tokenSym === LexerType.ltAssign)
                        {
                            SubNode.nType = NodeType.ntExpressionAssign;
                            SubNode.nValue = saveToken;
                            this.parseExpression(SubNode, true, StopLex);
                            getNextToken = false;
                        }
                        else if (this.lexer.tokenSym === LexerType.ltPlusAssign
                            || this.lexer.tokenSym === LexerType.ltMinusAssign
                            || this.lexer.tokenSym === LexerType.ltMulAssign
                            || this.lexer.tokenSym === LexerType.ltDivAssign
                            || this.lexer.tokenSym === LexerType.ltModAssign)
                        {
                            //Compound-assign: x += expr и т.п.
                            let op = '+';
                            switch (this.lexer.tokenSym) {
                                case LexerType.ltPlusAssign:  op = '+'; break;
                                case LexerType.ltMinusAssign: op = '-'; break;
                                case LexerType.ltMulAssign:   op = '*'; break;
                                case LexerType.ltDivAssign:   op = '/'; break;
                                case LexerType.ltModAssign:   op = '%'; break;
                            }
                            SubNode.nType = NodeType.ntCompoundAssign;
                            SubNode.nValue = saveToken;
                            SubNode.nValue2 = op;
                            this.parseExpression(SubNode, true, StopLex);
                            getNextToken = false;
                        }
                        else
                        {
                            SubNode.nType = NodeType.ntContextVariable;
                            SubNode.nValue = saveToken;
                            getNextToken = false;
                        }
                    }
                    else
                    {
                        SubNode.nType = NodeType.ntFuncNameSpaceCall;
                        SubNode.nValue = saveToken;
                        this.parseFunction(SubNode);
                    }
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltLPar:
                    /*
                    if (prevNode && prevNode.nType === NodeType.ntObjProp)
                    {
                        let arValue = prevNode.nValue.split('.'),
                            funcName = arValue.pop();

                        if (!arValue.length)
                        {
                            NodeList.pop();
                            SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncCall, funcName);
                        } else {
                            if (!arValue[0].length)
                            {
                                arValue.shift(); // return "String".ToUpper();
                            }

                            SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSelfFuncCall, funcName);

                            if (arValue.length) {
                                prevNode.nValue = arValue.join('.');
                            } else {
                                NodeList.pop();
                            }
                        }

                        this.parseFunctionParams(SubNode);
                        NodeList.push(SubNode);

                        break;
                    }
                     */

                    if (prevNode && prevNode.nType === NodeType.ntObjProp)
                    {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSelfFuncCall, prevNode.nValue);

                        NodeList.pop();

                        this.parseFunctionParams(SubNode);
                        NodeList.push(SubNode);
                        break;
                    }

                    if (prevNode && prevNode.nType === NodeType.ntContextVariable)
                    {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncCall, prevNode.nValue);

                        NodeList.pop();

                        this.parseFunctionParams(SubNode);
                        NodeList.push(SubNode);
                        break;
                    }

                    if (prevNode && !prevNode.isMathNode() && !prevNode.isCompareOrAndNode())
                        throw new ParserNodeException("Parse expression failed", prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                    this.parseExpression(SubNode, true, LexerTypeArray.one(LexerType.ltRPar));
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBracketOpen:

                    // [...] трактуется как новый литерал-массив, если идёт в начале выражения
                    // ИЛИ сразу после математического/логического оператора, либо как значение
                    // ключа ассоциативного массива (ntArrayPushSeparatorKey). В остальных случаях
                    // (после идентификатора/закрывающей скобки и т.п.) это доступ по ключу a[..].
                    if (!prevNode || prevNode.isMathNode() || prevNode.isCompareOrAndNode() || prevNode.nType === NodeType.ntArrayPushSeparatorKey)
                    {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntArray);
                        SubNode.childItems = [];

                        while (true)
                        {
                            this.lexer.getToken();

                            if (this.lexer.tokenSym === LexerType.ltBracketClose)
                                break;

                            const NodePush = new ParseNode(this.lexer.tokenCursor, NodeType.ntArrayPush);

                            this.parseExpression(NodePush, false, new LexerTypeArray(LexerType.ltComma, LexerType.ltBracketClose));

                            SubNode.childItems.push(NodePush);

                            if (this.lexer.tokenSym === LexerType.ltBracketClose)
                                break;
                        }

                        NodeList.push(SubNode);
                    } else {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBracketGetKey);
                        this.parseExpression(SubNode, true, LexerTypeArray.one(LexerType.ltBracketClose));

                        this.lexer.getToken();

                        NodeList.push(SubNode);

                        if (this.lexer.tokenSym === LexerType.ltAssign)
                        {
                            SubNode.nType = NodeType.ntBracketSetKey;

                            const SubExpressionNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBracketSetKey);
                            this.parseExpression(SubExpressionNode, true, StopLex);

                            if (SubNode.childItems === null)
                                throw new ParserCursorException('SubNode.childItems === null', this.lexer.tokenCursor);

                            if (SubExpressionNode.childItems === null)
                                throw new ParserCursorException('SubExpressionNode.childItems === null', this.lexer.tokenCursor);

                            // a[1] = 5;
                            // Эталон PHP (см. CodeParser.php): childItems хранит две группы —
                            //   [0] — путь к ячейке (a, [, 1, ]),
                            //   [1] — выражение присваивания (= 5).
                            // Это единственное место, где childItems держит не плоский
                            // ParseNode[], а массив массивов.
                            SubNode.childItems = [
                                SubNode.nodeChildren(),
                                SubExpressionNode.nodeChildren(),
                            ];

                            ParentNode.childItems = NodeList; //выражение закончено, выходим из парсинга
                            return;
                        } else {
                            getNextToken = false;
                        }
                    }

                    break;
                case LexerType.ltAssign:
                    // Установка значения свойства объекта: obj.prop = value.
                    if (prevNode && prevNode.nType === NodeType.ntObjProp) {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntObjSetPropValue, prevNode.nValue);

                        NodeList.pop();

                        this.parseExpression(SubNode, true, StopLex);
                        NodeList.push(SubNode);

                        getNextToken = false;
                        break;
                    }

                    throw new ParserNodeException('Expression is assign', ParentNode);
                case LexerType.ltCompare:

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntExpressionCompare);
                    SubNode.nValue = this.parseCompareToken(this.lexer.tokenValue);
                    NodeList.push(SubNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntIFValue);
                    //Тернарный `?` тоже останавливает правую часть сравнения,
                    //иначе `n > 5 ? a : b` парсилось бы как `n > (5 ? a : b)`.
                    this.parseExpression(SubNode, true, new LexerTypeArray(...StopLex, LexerType.ltCompare, LexerType.ltCompareAnd, LexerType.ltCompareOr, LexerType.ltQuestion));
                    NodeList.push(SubNode);

                    getNextToken = false;

                    break;
                case LexerType.ltCompareAnd:
                    if (prevNode && prevNode.isCompareOrAndNode())
                        throw new ParserNodeException('Invalid token', prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareAnd);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltCompareOr:
                    if (prevNode && prevNode.isCompareOrAndNode())
                        throw new ParserNodeException('Invalid token', prevNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareOr);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltInstanceof:
                    //obj instanceof Class — справа всегда имя класса (ltIDStr).
                    //Левый операнд уже лежит в выражении как prevNode; интерпретатор
                    //снимет его со стека в instanceofHandler.
                    if (!prevNode) {
                        throw new ParserCursorException("'instanceof' requires a left operand", this.lexer.tokenCursor);
                    }
                    this.lexer.getToken();
                    if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                        throw new ParserCursorException("'instanceof' expects class name", this.lexer.tokenCursor);
                    }
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntInstanceof, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltNegativeIf:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntNegativeIf);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltQuestion: {
                    //Тернарный `cond ? a : b`. Текущий NodeList — это cond.
                    const condNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                    condNode.childItems = NodeList.slice();

                    const thenNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                    this.parseExpression(thenNode, true, LexerTypeArray.one(LexerType.ltColon));

                    if (this.lexer.tokenSym !== LexerType.ltColon)
                        throw new ParserCursorException("Ternary: ':' expected", this.lexer.tokenCursor);

                    const elseNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                    this.parseExpression(elseNode, true, StopLex);

                    const ternaryNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntTernary);
                    ternaryNode.childItems = [condNode, thenNode, elseNode];

                    ParentNode.childItems = [ternaryNode];
                    return;
                }
                case LexerType.ltShortIncrement:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntShortIncrement);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltShortDecrement:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntShortDecrement);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltArrayUnpack:
                    if (ParentNode.nType === NodeType.ntFuncParam)
                    {
                        ParentNode.nType = NodeType.ntFuncParamArrayUnpack;
                    } else if (ParentNode.nType === NodeType.ntArrayPush) {
                        // Распаковка внутри литерала-массива: [1, ...a, 4]
                        ParentNode.nType = NodeType.ntArrayPushArrayUnpack;
                    } else {
                        throw new ParserNodeException("Parse lexer expression failed "+this.lexer.tokenName, ParentNode);
                    }
                    break;
                case LexerType.ltArraySeparator:
                    if (ParentNode.nType === NodeType.ntArrayPush)
                    {
                        if (!NodeList.length)
                        {
                            throw new ParserNodeException("Parse expression failed "+this.lexer.tokenValue, ParentNode);
                        }

                        ParentNode.nType = NodeType.ntArrayPushSeparator;
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntArrayPushSeparatorKey);
                        SubNode.childItems = NodeList;
                        NodeList = [SubNode];
                    } else {
                        throw new ParserNodeException("Parse lexer expression failed "+this.lexer.tokenName, ParentNode);
                    }
                    break;
                default:
                    throw new ParserNodeException("Parse lexer expression failed, found token "+this.lexer.tokenName+" expected "+StopLex.asNames.join(', '), ParentNode);
            }
        }

        if (!NodeList.length) {
            if (allowEmpty) {
                ParentNode.childItems = [];
                return;
            }
            throw new ParserNodeException("Parse expression failed", ParentNode);
        }

        const lastNode = NodeList[NodeList.length - 1];

        if (lastNode.isMathNode() || lastNode.isCompareOrAndNode())
            throw new ParserNodeException("Parse expression failed", lastNode);

        let idx = 0,
            leftIdx = 0,
            rightIdx,
            node;

        //Пост-обработка приоритета операторов: `*` / `/` / `%` / `&` имеют
        //более высокий приоритет, чем `+` / `-`, поэтому каждый блок таких
        //высокоприоритетных операций мы оборачиваем в `ntSubExpression` —
        //интерпретатор сначала вычислит вложенное подвыражение, потом
        //применит низкоприоритетный `+`/`-` к его результату.
        //
        //Зеркало PHP-эталона parseExpression в CodeParser.php.
        const isHighPri = (n: ParseNode) => (
            n.nType === NodeType.ntMul
            || n.nType === NodeType.ntDiv
            || n.nType === NodeType.ntMod
            || n.nType === NodeType.ntBitAnd
            || n.nType === NodeType.ntBitOr
            || n.nType === NodeType.ntBitXor
            || n.nType === NodeType.ntShiftLeft
            || n.nType === NodeType.ntShiftRight
            || n.nType === NodeType.ntUShiftRight
        );

        while (idx<NodeList.length-1)
        {
            node = NodeList[idx];
            if (node.isMathNode())
            {
                if (!isHighPri(node))
                {
                    //Низкоприоритетный оператор (+ или -) — leftIdx сдвигаем
                    //на следующий операнд, дальше ищем высокоприоритетные справа.
                    idx++;
                    leftIdx = idx;
                    idx++;
                    continue;
                }

                //Высокоприоритетный оператор: расширяем правую границу.
                rightIdx = idx+1;
                while (rightIdx + 1 < NodeList.length)
                {
                    const nextNode = NodeList[rightIdx+1];

                    //Продолжение того же значения через хвостовые операции:
                    //  .prop                — ntObjProp, цепочка свойств a.b.c
                    //  [idx]                — ntBracketGetKey, индексация a.m[0]
                    //  obj.method(args)     — ntSelfFuncCall, метод объекта
                    //  func(args)           — ntFuncCall
                    //  Class::method(args)  — ntFuncNameSpaceCall
                    if (
                        nextNode.nType === NodeType.ntObjProp
                        || nextNode.nType === NodeType.ntBracketGetKey
                        || nextNode.nType === NodeType.ntSelfFuncCall
                        || nextNode.nType === NodeType.ntFuncCall
                        || nextNode.nType === NodeType.ntFuncNameSpaceCall
                    ) {
                        rightIdx++;
                        continue;
                    }

                    //Следующий — снова высокоприоритетный оператор:
                    //объединяем в один SubExpression через шаг на 2
                    //(оператор + его правый операнд).
                    if (isHighPri(nextNode)) {
                        rightIdx += 2;
                        continue;
                    }

                    //Любой другой узел (+, -, &&, ||, конец) — стоп.
                    break;
                }

                const SubNode = new ParseNode(NodeList[idx].cursorPos, NodeType.ntSubExpression);
                const length = rightIdx - leftIdx + 1;
                SubNode.childItems = NodeList.slice(leftIdx, leftIdx + length);
                NodeList.splice(leftIdx, length, SubNode);
                idx = leftIdx;
            }
            idx++;
        }

        ParentNode.childItems = NodeList;
    }

    parseAssign(Node: unknown, EndLineType: unknown)
    {
        if (!(Node instanceof ParseNode))
            throw new ParserCursorException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

        if (!(EndLineType instanceof LexerTypeArray))
            throw new ParserCursorException('EndLineType must be instanceof LexerTypeArray', this.lexer.tokenCursor);


        this.parseExpression(Node, true, EndLineType);
    }

    /**
     * Парсит `for (X of iterable) body`. На входе: лексер на ltOf. Зеркало
     * PHP-эталона CodeParser::parseForOf.
     */
    protected parseForOf(NodeList: (ParseNode | ParseNode[])[], forCursor: TokenCursor, kind: string, varName: string): void {
        this.lexer.getToken();

        const iterableExpr = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
        this.parseExpression(iterableExpr, false, LexerTypeArray.one(LexerType.ltRPar));

        if (this.lexer.tokenSym !== LexerType.ltRPar)
            throw new ParserCursorException("for-of: ')' expected", this.lexer.tokenCursor);

        this.lexer.getToken();

        const bodyNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
        bodyNode.childItems = [];
        if (this.lexer.tokenSym === LexerType.ltStartCode) {
            this.parseCode(bodyNode.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
        } else {
            this.parseCode(bodyNode.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon), true);
        }

        const forOf = new ParseNode(forCursor, NodeType.ntForOf, varName);
        forOf.nValue2 = kind;
        forOf.childItems = [iterableExpr, bodyNode];
        NodeList.push(forOf);
    }

    parseFunction(Node:unknown)
    {
        if (!(Node instanceof ParseNode))
            throw new ParserCursorException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

        this.lexer.getToken();

        if (this.lexer.tokenSym !== LexerType.ltIDStr)
            throw new ParserNodeException("function name not defined", Node);

        Node.nValue2 = this.lexer.tokenValue;

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltLPar)
            throw new ParserNodeException("function LPar not found", Node);

        const NodeList = [];

        while (true)
        {
            this.lexer.getToken();
            if (this.lexer.tokenSym === LexerType.ltRPar)
                break;

            const SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncParam);
            this.parseExpression(SubNode,false, new LexerTypeArray(LexerType.ltComma, LexerType.ltRPar));
            NodeList.push(SubNode);

            if (this.lexer.tokenSym === LexerType.ltRPar)
                break;
        }

        Node.childItems = NodeList;
    }

    parseFunctionParams(Node:unknown)
    {
        if (!(Node instanceof ParseNode))
            throw new ParserCursorException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

        const NodeList = [];

        while (true)
        {
            this.lexer.getToken();
            if (this.lexer.tokenSym === LexerType.ltRPar)
                break;

            const SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncParam);
            this.parseExpression(SubNode,false, new LexerTypeArray(LexerType.ltComma, LexerType.ltRPar));
            NodeList.push(SubNode);

            if (this.lexer.tokenSym === LexerType.ltRPar)
                break;
        }

        Node.childItems = NodeList;
    }

    parseCompare(Node:unknown, EndCompareType:number)
    {
        if (!(Node instanceof ParseNode))
            throw new ParserCursorException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

        const NodeList = [];

        while (true)
        {
            this.lexer.getToken();

            if (this.lexer.tokenSym === EndCompareType)
                break;

            let SubNode;

            if (this.lexer.tokenSym === LexerType.ltLPar)
            {
                SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                this.parseCompare(SubNode, LexerType.ltRPar);

                if (!SubNode.childItems?.length)
                {
                    throw new ParserNodeException('Expression is empty', SubNode);
                }

                NodeList.push(SubNode);

                this.lexer.getToken();

                if (this.lexer.tokenSym === EndCompareType)
                    break;


                if (this.lexer.tokenSym === LexerType.ltCompareAnd)
                {
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareAnd);
                    NodeList.push(SubNode);
                    continue;
                }
                if (this.lexer.tokenSym === LexerType.ltCompareOr)
                {
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareOr);
                    NodeList.push(SubNode);
                    continue;
                }

                if (this.lexer.tokenSym === LexerType.ltCompare)
                {
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompare);
                    SubNode.nValue = this.parseCompareToken(this.lexer.tokenValue);
                    NodeList.push(SubNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntIFValue);
                    this.parseExpression(SubNode, true, new LexerTypeArray(EndCompareType, LexerType.ltCompareAnd, LexerType.ltCompareOr));
                    NodeList.push(SubNode);

                    if (this.lexer.tokenSym === EndCompareType)
                        break;


                    continue;
                }

                throw new ParserNodeException("Parse IF failed", Node);
            }

            SubNode = new ParseNode(this.lexer.tokenCursor);
            // Зеркало PHP parseCompare: стоп-список без EndCompareType (for ушёл на
            // parseExpression, while всегда оканчивается ltRPar — он уже в списке).
            this.parseExpression(SubNode, false, new LexerTypeArray(LexerType.ltCompare, LexerType.ltRPar, LexerType.ltCompareAnd, LexerType.ltCompareOr));
            NodeList.push(SubNode);

            if (this.lexer.tokenSym === LexerType.ltCompare)
            {
                SubNode.nType = NodeType.ntIFValue;

                SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompare);
                SubNode.nValue = this.parseCompareToken(this.lexer.tokenValue);
                NodeList.push(SubNode);

                SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntIFValue);
                this.parseExpression(SubNode, true, new LexerTypeArray(EndCompareType, LexerType.ltCompareAnd, LexerType.ltCompareOr));
                NodeList.push(SubNode);
            }
            else
            {
                SubNode.nType = NodeType.ntIFValueBOOL;
            }

            if (this.lexer.tokenSym === EndCompareType)
                break;

            SubNode = new ParseNode(this.lexer.tokenCursor);
            if (this.lexer.tokenSym === LexerType.ltCompareAnd)
                SubNode.nType = NodeType.ntCompareAnd;
            else
            if (this.lexer.tokenSym === LexerType.ltCompareOr)
                SubNode.nType = NodeType.ntCompareOr;
            else throw new ParserNodeException("Parse IF failed", Node);

            NodeList.push(SubNode);
        }

        Node.childItems = NodeList;
    }

    // Тип совпадает с ParseNode.childItems, чтобы по-ссылке передача
    // `Node.childItems` была корректной. Парсер кладёт сюда только ParseNode;
    // полиморфизм нужен из-за специальной структуры ntBracketSetKey.
    parseCode(NodeList: Array<ParseNode|ParseNode[]>, getFirstToken: boolean, inline: boolean, endLineType: LexerTypeArray, singleStatement: boolean = false)
    {
        let getNextToken = false;

        if (!Array.isArray(NodeList))
            throw new ParserCursorException('NodeList must be array', this.lexer.tokenCursor);

        if (!inline)
        {
            if (getFirstToken)
                this.lexer.getToken();
        }
        else
        {
            getNextToken = getFirstToken;
        }

        //`singleStatement` означает «прочитать ровно один statement и вернуть
        //управление» — это форма `if (cond) stmt;` / `for (...) stmt;` без `{...}`.
        //После первой удачно разобранной инструкции мы должны выйти, иначе
        //следующие statement-ы внешнего scope (например, `a = 1;` после
        //`if (...) return -2;`) ошибочно засосутся в childItems текущего if/for/while.
        let parsedOne = false;

        while (true)
        {
            //Single-statement-выход: один statement уже разобран, остановим
            //лексер ровно там, где он стоит (обычно на `;`), внешний parseCode
            //сам решит, что дальше.
            if (singleStatement && parsedOne) {
                return;
            }

            if (getNextToken)
                this.lexer.getToken();

            if (endLineType.indexOf(this.lexer.tokenSym) !== -1)
                return;

            getNextToken = true;

            if (this.lexer.tokenSym === LexerType.ltIDStr && this.lexer.tokenValue === "return")
            {
                const Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntReturn);
                NodeList.push(Node);

                //`return;` без значения разрешён внутри пользовательских функций —
                //тогда результат функции = undefined.
                if (inline)
                {
                    this.parseExpression(Node, true, endLineType.cloneAdd(LexerType.ltSemicolon), true);
                } else {
                    this.parseExpression(Node, true, LexerTypeArray.one(LexerType.ltSemicolon), true);
                }

                parsedOne = true;
                continue;
            }

            if (this.lexer.tokenSym === LexerType.ltThrow)
            {
                const Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntThrow);
                NodeList.push(Node);

                if (inline)
                {
                    this.parseExpression(Node, true, endLineType.cloneAdd(LexerType.ltSemicolon));
                } else {
                    this.parseExpression(Node, true, LexerTypeArray.one(LexerType.ltSemicolon));
                }

                parsedOne = true;
                continue;
            }


            if ([LexerType.ltLet, LexerType.ltVar, LexerType.ltConst].indexOf(this.lexer.tokenSym) >= 0)
            {
                this.parseVarDecl(NodeList, inline, endLineType);
                parsedOne = true;
                //parseVarDecl оставил лексер на разделителе — не глотаем его.
                //Зеркало PHP-эталона: важно для `for (let i = 0; i < n; i++)`.
                getNextToken = false;
                continue;
            }

            if ([LexerType.ltIDStr, LexerType.ltShortIncrement, LexerType.ltShortDecrement, LexerType.ltThis, LexerType.ltSuper].indexOf(this.lexer.tokenSym)>=0)
            {
                let Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntNotSet);

                if (inline)
                    this.parseExpression(Node, false, endLineType.cloneAdd(LexerType.ltSemicolon));
                else
                    this.parseExpression(Node, false, LexerTypeArray.one(LexerType.ltSemicolon));

                if (Node.childItems)
                    NodeList.push(...Node.childItems);

                Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntShiftSP, -1);
                NodeList.push(Node);
                parsedOne = true;
            }
            else
            {
                let Node, Node2;
                switch (this.lexer.tokenSym)
                {
                    case LexerType.ltSwitch:
                        this.parseSwitch(NodeList);
                        //parseSwitch потребил '}', getNextToken остаётся true
                        break;
                    case LexerType.ltFunction:
                        this.parseFunctionDef(NodeList);
                        //parseFunctionDef оставил лексер на '}' тела
                        break;
                    case LexerType.ltClass:
                        this.parseClassDecl(NodeList);
                        //parseClassDecl оставил лексер на '}' тела класса
                        break;
                    case LexerType.ltTry:
                        this.parseTry(NodeList);
                        //parseTry оставил лексер уже на первом токене следующего statement
                        //(заранее прочитал, чтобы понять — есть finally или нет).
                        getNextToken = false;
                        break;
                    case LexerType.ltFor: {
                        const forCursor = this.lexer.tokenCursor;
                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new ParserCursorException("Parse FOR failed", this.lexer.tokenCursor);

                        //Lookahead для распознавания `for (X of iterable)`.
                        const stateBefore = this.lexer.saveState();
                        let kind: string | null = null;
                        let varName: string | null = null;
                        this.lexer.getToken();
                        if (this.lexer.tokenSym === LexerType.ltLet
                            || this.lexer.tokenSym === LexerType.ltVar
                            || this.lexer.tokenSym === LexerType.ltConst) {
                            kind = this.lexer.tokenSym === LexerType.ltLet ? 'let'
                                 : this.lexer.tokenSym === LexerType.ltVar ? 'var' : 'const';
                            this.lexer.getToken();
                        }
                        if (this.lexer.tokenSym === LexerType.ltIDStr) {
                            varName = String(this.lexer.tokenValue);
                            this.lexer.getToken();
                        }
                        const isForOf = (varName !== null && this.lexer.tokenSym === LexerType.ltOf);

                        if (isForOf) {
                            this.parseForOf(NodeList, forCursor, kind ?? 'let', varName as string);
                            break;
                        }

                        //Стандартный for: откатываем state и идём как раньше.
                        this.lexer.restoreState(stateBefore);

                        Node = new ParseNode(forCursor, NodeType.ntFor);
                        Node.childItems = [];
                        NodeList.push(Node);

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];
                        Node.childItems.push(Node2);

                        this.parseCode(Node2.childItems, true, true, LexerTypeArray.one(LexerType.ltSemicolon));

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntForCompare);
                        Node2.childItems = [];
                        Node.childItems.push(Node2);

                        // Зеркало PHP: условие for через parseExpression (allowEmpty), а не
                        // parseCompare. Так небулевое голое условие (`for(i=0; n; ...)`)
                        // бросает "For compare invalid variable type", как в эталоне.
                        this.parseExpression(Node2, true, LexerTypeArray.one(LexerType.ltSemicolon), true);

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];
                        Node.childItems.push(Node2);

                        this.parseCode(Node2.childItems, true, true, LexerTypeArray.one(LexerType.ltRPar));

                        if (this.lexer.tokenSym !== LexerType.ltRPar)
                            throw new ParserCursorException("Parse FOR failed", this.lexer.tokenCursor);

                        this.lexer.getToken();

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];

                        if (this.lexer.tokenSym === LexerType.ltStartCode)
                        {
                            this.parseCode(Node2.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
                        } else {
                            this.parseCode(Node2.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon), true);
                        }

                        Node.childItems.push(Node2);

                        break;
                    }
                    case LexerType.ltWhile:
                        // Узел while хранит двух детей: [0] — условие (ntForCompare),
                        // [1] — тело (ntSubCode). Тот же контракт, что у ntFor, минус init и increment.
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntWhile);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new ParserCursorException("operator while LPar not found", this.lexer.tokenCursor);

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntForCompare);
                        Node.childItems.push(Node2);
                        this.parseCompare(Node2, LexerType.ltRPar);

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];
                        Node.childItems.push(Node2);

                        this.lexer.getToken();

                        if (this.lexer.tokenSym === LexerType.ltStartCode)
                        {
                            this.parseCode(Node2.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
                        } else {
                            this.parseCode(Node2.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon), true);
                        }

                        break;
                    case LexerType.ltBreak:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntBreak);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltSemicolon)
                            throw new ParserCursorException("Parse break failed", this.lexer.tokenCursor);
                        break;
                    case LexerType.ltContinue:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntContinue);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltSemicolon)
                            throw new ParserCursorException("Parse continue failed", this.lexer.tokenCursor);
                        break;
                    case LexerType.ltIF:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntIF);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new ParserCursorException("operator if LPar not found", this.lexer.tokenCursor);

                        this.parseCompare(Node, LexerType.ltRPar);

                        if (!Node.childItems?.length)
                            throw new ParserCursorException('Expression is empty', this.lexer.tokenCursor);

                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.lexer.getToken();

                        if (this.lexer.tokenSym === LexerType.ltStartCode)
                        {
                            this.parseCode(Node.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
                        } else {
                            this.parseCode(Node.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon), true);
                        }

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltELSE)
                        {
                            getNextToken = false;
                            break;
                        }

                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntELSE);
                        NodeList.push(Node);

                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node.childItems = [];

                        NodeList.push(Node);

                        this.lexer.getToken();

                        if (this.lexer.tokenSym === LexerType.ltStartCode)
                        {
                            this.parseCode(Node.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
                        } else {
                            this.parseCode(Node.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon), true);
                        }
                        break;
                    case LexerType.ltStartCode:

                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.parseCode(Node.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));

                        break;
                    case LexerType.ltSemicolon:
                        break;
                    default:
                        throw new ParserCursorException("Failed parse code, tokenSym: "+this.lexer.tokenName, this.lexer.tokenCursor);
                }

                //Композитный statement (if/for/while/switch/function/class/try/block)
                //разобран целиком — в single-statement-режиме это и есть тот единственный
                //statement, после которого надо вернуть управление наверх.
                parsedOne = true;
            }

            if (inline && endLineType.indexOf(this.lexer.tokenSym) !== -1)
                return;
        }
    }

    /**
     * Парсит конструкцию `switch (expr) { case X: body; case Y: body; default: body; }`.
     *
     * На входе: текущий tokenSym = ltSwitch.
     * На выходе: лексер стоит на закрывающей `}` (parseCode сам сделает getToken дальше).
     *
     * Зеркало PHP-эталона `CodeParser::parseSwitch`. Структура узла:
     *   ntSwitch
     *     childItems[0] = ntSubExpression — выражение, которое сравниваем
     *     childItems[1..N] = ntCase / ntDefault
     *
     *   ntCase
     *     childItems[0] = ntSubExpression — литерал case-значения (число/строка/const)
     *     childItems[1..N] = тело case (statements до следующего case/default/})
     *
     *   ntDefault
     *     childItems[0..N] = тело default
     */
    protected parseSwitch(NodeList: Array<ParseNode | ParseNode[]>): void
    {
        const switchNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSwitch);
        switchNode.childItems = [];

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltLPar) {
            throw new ParserCursorException("Switch: '(' expected", this.lexer.tokenCursor);
        }

        const exprNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
        this.parseExpression(exprNode, true, LexerTypeArray.one(LexerType.ltRPar));
        switchNode.childItems.push(exprNode);

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltStartCode) {
            throw new ParserCursorException("Switch: '{' expected", this.lexer.tokenCursor);
        }

        const endSet = LexerTypeArray.one(LexerType.ltCase)
            .cloneAdd(LexerType.ltDefault)
            .cloneAdd(LexerType.ltEndCode);

        this.lexer.getToken();

        let needNextToken = false;
        while (true) {
            if (needNextToken) {
                this.lexer.getToken();
            }
            needNextToken = true;

            if (this.lexer.tokenSym === LexerType.ltEndCode) {
                break;
            }

            if (this.lexer.tokenSym === LexerType.ltCase) {
                const caseNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCase);
                caseNode.childItems = [];

                const caseValueNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                this.parseExpression(caseValueNode, true, LexerTypeArray.one(LexerType.ltColon));
                caseNode.childItems.push(caseValueNode);

                const bodyList: Array<ParseNode | ParseNode[]> = [];
                this.parseCode(bodyList, true, false, endSet);
                for (const bodyItem of bodyList) {
                    caseNode.childItems.push(bodyItem);
                }

                switchNode.childItems.push(caseNode);
                needNextToken = false; //parseCode оставил нас на ltCase/ltDefault/ltEndCode
                continue;
            }

            if (this.lexer.tokenSym === LexerType.ltDefault) {
                this.lexer.getToken();
                if (this.lexer.tokenSym !== LexerType.ltColon) {
                    throw new ParserCursorException("Switch: ':' expected after default", this.lexer.tokenCursor);
                }

                const defaultNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntDefault);
                defaultNode.childItems = [];

                const bodyList: Array<ParseNode | ParseNode[]> = [];
                this.parseCode(bodyList, true, false, endSet);
                for (const bodyItem of bodyList) {
                    defaultNode.childItems.push(bodyItem);
                }

                switchNode.childItems.push(defaultNode);
                needNextToken = false;
                continue;
            }

            throw new ParserCursorException("Switch: 'case' or 'default' expected", this.lexer.tokenCursor);
        }

        NodeList.push(switchNode);
    }

    /**
     * Парсит определение пользовательской функции:
     *   `function name(a, b = 5) { body... }`.
     *
     * На входе текущий tokenSym = ltFunction. На выходе лексер стоит на `}` тела —
     * внешний parseCode сам сделает следующий getToken.
     *
     * Структура узла:
     *   ntFunctionDef
     *     nValue = имя
     *     childItems = [ntFuncDefParam..., тело...]
     *
     *   ntFuncDefParam
     *     nValue = имя параметра
     *     childItems = [ntSubExpression(default)] или пусто
     *
     * @param asExpression true — function-выражение: имя необязательно,
     *        узел при выполнении кладёт UserFunction на стек, а не регистрирует
     *        её в _variables (нужно для `x = function() { ... };`).
     *
     * Зеркало PHP-эталона `CodeParser::parseFunctionDef`.
     */
    protected parseFunctionDef(NodeList: Array<ParseNode | ParseNode[]>, asExpression: boolean = false): void {
        const funcNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFunctionDef);
        funcNode.childItems = [];
        //Метка expression-формы — handler проверит через nValue2.
        if (asExpression) {
            funcNode.nValue2 = 'expr';
        }

        this.lexer.getToken();
        if (this.lexer.tokenSym === LexerType.ltLPar) {
            //Анонимная функция-выражение: function() { ... }. Имя пустое.
            if (!asExpression) {
                throw new ParserCursorException("Function: name expected", this.lexer.tokenCursor);
            }
            funcNode.nValue = '';
        } else {
            if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                throw new ParserCursorException("Function: name expected", this.lexer.tokenCursor);
            }
            funcNode.nValue = this.lexer.tokenValue;

            if (this.reservedWords.indexOf(String(funcNode.nValue).toLowerCase()) !== -1) {
                throw new ParserCursorException('Function name cannot be a reserved word "' + funcNode.nValue + '"', this.lexer.tokenCursor);
            }

            this.lexer.getToken();
        }

        if (this.lexer.tokenSym !== LexerType.ltLPar) {
            throw new ParserCursorException("Function: '(' expected", this.lexer.tokenCursor);
        }

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltRPar) {
            //разбираем список параметров через запятую.
            const endParam = LexerTypeArray.one(LexerType.ltComma).cloneAdd(LexerType.ltRPar);
            while (true) {
                //Rest-параметр: `function f(a, ...args) { ... }`. Возможен
                //только как последний параметр.
                let tokSym = this.lexer.tokenSym;
                const isRest = tokSym === LexerType.ltArrayUnpack;
                if (isRest) {
                    this.lexer.getToken();
                    tokSym = this.lexer.tokenSym;
                }
                if (tokSym !== LexerType.ltIDStr) {
                    throw new ParserCursorException("Function: parameter name expected", this.lexer.tokenCursor);
                }

                const paramNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncDefParam);
                paramNode.nValue = this.lexer.tokenValue;
                paramNode.childItems = [];
                if (isRest) {
                    paramNode.nValue2 = 'rest';
                }

                this.lexer.getToken();

                if (isRest) {
                    if (this.lexer.tokenSym !== LexerType.ltRPar) {
                        throw new ParserCursorException("Function: rest parameter must be last and have no default", this.lexer.tokenCursor);
                    }
                    funcNode.childItems.push(paramNode);
                    break;
                }

                if (this.lexer.tokenSym === LexerType.ltAssign) {
                    //необязательный default: function f(a, b = 5)
                    const defaultExpr = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                    this.parseExpression(defaultExpr, true, endParam);
                    paramNode.childItems.push(defaultExpr);
                }

                funcNode.childItems.push(paramNode);

                if (this.lexer.tokenSym === LexerType.ltRPar) {
                    break;
                }
                if (this.lexer.tokenSym !== LexerType.ltComma) {
                    throw new ParserCursorException("Function: ',' or ')' expected after parameter", this.lexer.tokenCursor);
                }
                this.lexer.getToken();
            }
        }

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltStartCode) {
            throw new ParserCursorException("Function: '{' expected", this.lexer.tokenCursor);
        }

        const bodyList: Array<ParseNode | ParseNode[]> = [];
        this.parseCode(bodyList, true, false, LexerTypeArray.one(LexerType.ltEndCode));
        for (const bodyItem of bodyList) {
            funcNode.childItems.push(bodyItem);
        }

        NodeList.push(funcNode);
    }

    /**
     * Парсит объявление класса:
     *   `class Name { constructor(a) { ... } method1(b) { ... } ... }`.
     *
     * На входе: tokenSym = ltClass.
     * На выходе: лексер стоит на `}` тела класса — внешний parseCode сам сделает getToken.
     *
     * Структура узла:
     *   ntClassDecl
     *     nValue = имя класса
     *     childItems = [ntFunctionDef("constructor"|"methodName", ...), ...]
     *
     * Конструктор не обязателен — если его нет, new создаст экземпляр с пустыми полями.
     *
     * Зеркало PHP-эталона `CodeParser::parseClassDecl`.
     */
    protected parseClassDecl(NodeList: Array<ParseNode | ParseNode[]>): void {
        const classNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntClassDecl);
        classNode.childItems = [];

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltIDStr) {
            throw new ParserCursorException("Class: name expected", this.lexer.tokenCursor);
        }
        classNode.nValue = this.lexer.tokenValue;

        if (this.reservedWords.indexOf(String(classNode.nValue).toLowerCase()) !== -1) {
            throw new ParserCursorException('Class name cannot be a reserved word "' + classNode.nValue + '"', this.lexer.tokenCursor);
        }

        //Опциональный `extends Parent` — имя родителя сохраняем в nValue2.
        //Реальную ссылку на класс-родитель резолвим лениво в рантайме
        //(см. StackVariableClass.getParent), чтобы не зависеть от порядка
        //объявления классов в скрипте.
        this.lexer.getToken();
        if (this.lexer.tokenSym === LexerType.ltExtends) {
            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                throw new ParserCursorException("Class: parent name expected after 'extends'", this.lexer.tokenCursor);
            }
            classNode.nValue2 = this.lexer.tokenValue;
            this.lexer.getToken();
        }

        if (this.lexer.tokenSym !== LexerType.ltStartCode) {
            throw new ParserCursorException("Class: '{' expected", this.lexer.tokenCursor);
        }

        while (true) {
            this.lexer.getToken();

            if (this.lexer.tokenSym === LexerType.ltEndCode) {
                //пустой класс или конец членов
                break;
            }

            if (this.lexer.tokenSym === LexerType.ltSemicolon) {
                //лишние ';' между методами — пропускаем без шума
                continue;
            }

            if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                throw new ParserCursorException("Class member: method name expected", this.lexer.tokenCursor);
            }

            const methodNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFunctionDef);
            methodNode.nValue = this.lexer.tokenValue;
            methodNode.childItems = [];

            //Параметры метода.
            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltLPar) {
                throw new ParserCursorException("Class member: '(' expected", this.lexer.tokenCursor);
            }

            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltRPar) {
                const endParam = LexerTypeArray.one(LexerType.ltComma).cloneAdd(LexerType.ltRPar);
                while (true) {
                    //Rest-параметр: `method(a, ...args)`.
                    let tokSym = this.lexer.tokenSym;
                    const isRest = tokSym === LexerType.ltArrayUnpack;
                    if (isRest) {
                        this.lexer.getToken();
                        tokSym = this.lexer.tokenSym;
                    }
                    if (tokSym !== LexerType.ltIDStr) {
                        throw new ParserCursorException("Class member: parameter name expected", this.lexer.tokenCursor);
                    }

                    const paramNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncDefParam);
                    paramNode.nValue = this.lexer.tokenValue;
                    paramNode.childItems = [];
                    if (isRest) {
                        paramNode.nValue2 = 'rest';
                    }

                    this.lexer.getToken();

                    if (isRest) {
                        if (this.lexer.tokenSym !== LexerType.ltRPar) {
                            throw new ParserCursorException("Class member: rest parameter must be last", this.lexer.tokenCursor);
                        }
                        methodNode.childItems.push(paramNode);
                        break;
                    }

                    if (this.lexer.tokenSym === LexerType.ltAssign) {
                        const defaultExpr = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                        this.parseExpression(defaultExpr, true, endParam);
                        paramNode.childItems.push(defaultExpr);
                    }

                    methodNode.childItems.push(paramNode);

                    if (this.lexer.tokenSym === LexerType.ltRPar) {
                        break;
                    }
                    if (this.lexer.tokenSym !== LexerType.ltComma) {
                        throw new ParserCursorException("Class member: ',' or ')' expected after parameter", this.lexer.tokenCursor);
                    }
                    this.lexer.getToken();
                }
            }

            //Тело метода.
            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltStartCode) {
                throw new ParserCursorException("Class member: '{' expected", this.lexer.tokenCursor);
            }

            const bodyList: Array<ParseNode | ParseNode[]> = [];
            this.parseCode(bodyList, true, false, LexerTypeArray.one(LexerType.ltEndCode));
            for (const bodyItem of bodyList) {
                methodNode.childItems.push(bodyItem);
            }

            classNode.childItems.push(methodNode);
        }

        NodeList.push(classNode);
    }

    /**
     * Парсит объявление переменных: `let name [= expr] [, name [= expr]]* ;`.
     * `var` и `const` — аналогично с одной разницей: для `const` инициализатор
     * обязателен, без него сразу даём ParserException.
     *
     * На входе: tokenSym = ltLet | ltVar | ltConst.
     * На выходе: лексер стоит на `;` (если inline-форма) или на следующем
     * за ним токене (parseCode сам ходит дальше).
     *
     * Зеркало PHP-эталона `CodeParser::parseVarDecl`.
     */
    protected parseVarDecl(NodeList: Array<ParseNode | ParseNode[]>, inline: boolean, endLineType: LexerTypeArray): void {
        let kind: string;
        switch (this.lexer.tokenSym) {
            case LexerType.ltLet:   kind = 'let'; break;
            case LexerType.ltVar:   kind = 'var'; break;
            case LexerType.ltConst: kind = 'const'; break;
            default:
                throw new ParserCursorException("Internal: parseVarDecl on unexpected token", this.lexer.tokenCursor);
        }

        //Список объявлений в одном statement: `let a = 1, b, c = 5;`.
        //Инициализатор ограничен либо `,` (следующая декларация), либо `;`
        //(конец statement). Для inline-формы (тело if без `{}`) `;` тоже
        //конечный токен внешнего scope — мы это уважаем через cloneAdd.
        const endInit = inline
            ? endLineType.cloneAdd([LexerType.ltComma, LexerType.ltSemicolon])
            : LexerTypeArray.one(LexerType.ltComma).cloneAdd(LexerType.ltSemicolon);

        while (true) {
            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                throw new ParserCursorException(
                    "'" + kind + "' expects variable name",
                    this.lexer.tokenCursor,
                );
            }
            const name = this.lexer.tokenValue;
            if (this.reservedWords.indexOf(String(name).toLowerCase()) !== -1) {
                throw new ParserCursorException(
                    "'" + kind + "' cannot declare reserved word \"" + name + "\"",
                    this.lexer.tokenCursor,
                );
            }

            const declNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntVarDecl, name);
            declNode.nValue2 = kind;
            declNode.childItems = [];

            this.lexer.getToken();
            if (this.lexer.tokenSym === LexerType.ltAssign) {
                const initExpr = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                this.parseExpression(initExpr, true, endInit);
                declNode.childItems.push(initExpr);
            } else if (kind === 'const') {
                throw new ParserCursorException(
                    "'const' declaration of \"" + name + "\" requires an initializer",
                    this.lexer.tokenCursor,
                );
            }

            NodeList.push(declNode);

            //После parseExpression лексер стоит на разделителе (`,` или `;`)
            //или, при необъявленном инициализаторе, на нём же. Если запятая —
            //продолжаем список; иначе завершаем (терминатор `;`/endLineType
            //обработает внешний parseCode).
            if (this.lexer.tokenSym !== LexerType.ltComma) {
                return;
            }
        }
    }

    /**
     * Парсит `try { ... } catch (e) { ... } finally { ... }`.
     *
     * На входе: tokenSym = ltTry.
     * На выходе: лексер стоит уже на первом токене следующего statement —
     * внешний parseCode ставит `getNextToken = false`.
     *
     * Структура узла (фиксированные слоты — вариант A):
     *   ntTry
     *     childItems[0] = ntSubCode (тело try)
     *     childItems[1] = ntCatch (тело catch + nValue = имя параметра или null)
     *     childItems[2] = ntFinally (тело finally) — отсутствует, если finally нет
     *
     * Зеркало PHP-эталона `CodeParser::parseTry`.
     */
    protected parseTry(NodeList: Array<ParseNode | ParseNode[]>): void {
        const tryNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntTry);
        tryNode.childItems = [];

        //Тело try.
        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltStartCode) {
            throw new ParserCursorException("'try' expects '{'", this.lexer.tokenCursor);
        }

        const bodyNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
        bodyNode.childItems = [];
        const bodyList: Array<ParseNode | ParseNode[]> = [];
        this.parseCode(bodyList, true, false, LexerTypeArray.one(LexerType.ltEndCode));
        for (const item of bodyList) {
            bodyNode.childItems.push(item);
        }
        tryNode.childItems.push(bodyNode);

        //catch обязателен.
        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltCatch) {
            throw new ParserCursorException("'try' expects 'catch' block", this.lexer.tokenCursor);
        }

        const catchNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCatch);
        catchNode.childItems = [];

        //Параметр опционален: catch { ... } или catch (e) { ... }.
        this.lexer.getToken();
        if (this.lexer.tokenSym === LexerType.ltLPar) {
            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltIDStr) {
                throw new ParserCursorException("'catch' expects parameter name or empty parens", this.lexer.tokenCursor);
            }
            catchNode.nValue = this.lexer.tokenValue;

            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltRPar) {
                throw new ParserCursorException("'catch' expects ')' after parameter", this.lexer.tokenCursor);
            }
            this.lexer.getToken();
        }

        if (this.lexer.tokenSym !== LexerType.ltStartCode) {
            throw new ParserCursorException("'catch' expects '{'", this.lexer.tokenCursor);
        }

        const catchBody: Array<ParseNode | ParseNode[]> = [];
        this.parseCode(catchBody, true, false, LexerTypeArray.one(LexerType.ltEndCode));
        for (const item of catchBody) {
            catchNode.childItems.push(item);
        }
        tryNode.childItems.push(catchNode);

        //finally опционален. Читаем следующий токен и смотрим.
        //В любом случае выходим оставив лексер на первом токене следующего statement —
        //внешний parseCode стоит на getNextToken=false и сразу его обработает.
        this.lexer.getToken();
        if (this.lexer.tokenSym === LexerType.ltFinally) {
            const finallyNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFinally);
            finallyNode.childItems = [];

            this.lexer.getToken();
            if (this.lexer.tokenSym !== LexerType.ltStartCode) {
                throw new ParserCursorException("'finally' expects '{'", this.lexer.tokenCursor);
            }

            const finallyBody: Array<ParseNode | ParseNode[]> = [];
            this.parseCode(finallyBody, true, false, LexerTypeArray.one(LexerType.ltEndCode));
            for (const item of finallyBody) {
                finallyNode.childItems.push(item);
            }
            tryNode.childItems.push(finallyNode);

            //После `}` finally считываем токен следующего statement.
            this.lexer.getToken();
        }
        //Если finally не было — токен следующего statement мы уже прочитали выше.

        NodeList.push(tryNode);
    }

}
