import {LexerTypeArray, LexerType, CodeLexer, TokenCursor} from "./lexer.js";
import {ParserException} from "./exceptions";

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
    }

export class ParseNode
{
    private _cursorPos: TokenCursor
    private _nType:number = NodeType.ntNotSet
    private _nValue: unknown
    private _nValue2: unknown
    private _childItems: ParseNode[]|null = null

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
            throw new ParserException('Set undefined nType', this._cursorPos);

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
            case NodeType.ntNegativeIf:
                return true;
        }

        return false;
    }

    isCompareOrAndNode()
    {
        return this.nType === NodeType.ntCompareOr || this.nType === NodeType.ntCompareAnd;
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
            'class',
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

        throw new ParserException("Unknown compare token", this.lexer.tokenCursor);
    }

    parseExpression(ParentNode: ParseNode, getFirstToken: boolean, StopLex: LexerTypeArray)
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

            let SubNode = null,
                prevNode = NodeList.length ? NodeList[NodeList.length-1] : null;

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
                        throw new ParserException('Invalid mul operator', this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMul);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltDiv:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserException('Invalid div operator', this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntDiv);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltMod:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserException('Invalid mod operator', this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMod);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBitAnd:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new ParserException('Invalid BitAnd operator', this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBitAnd);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltObjProp:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntObjProp, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltNumeric:
                    if (prevNode && !prevNode.isMathNode() && !prevNode.isCompareOrAndNode() && prevNode.nType !== NodeType.ntArrayPushSeparatorKey)
                        throw new ParserException("Parse expression failed", this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntNumeric, parseInt(this.lexer.tokenValue));
                    if (!Number.isInteger(SubNode.nValue))
                        throw new ParserException("Failed parse integer value "+this.lexer.tokenValue, this.lexer.tokenCursor);

                    NodeList.push(SubNode);
                    break;
                case LexerType.ltFloat:
                    if (prevNode && !prevNode.isMathNode() && !prevNode.isCompareOrAndNode() && prevNode.nType !== NodeType.ntArrayPushSeparatorKey)
                        throw new ParserException("Parse expression failed", this.lexer.tokenCursor);
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFloat, parseFloat(this.lexer.tokenValue));

                    if (isNaN(SubNode.nValue as number))
                        throw new ParserException("Failed parse float value "+this.lexer.tokenValue, this.lexer.tokenCursor);

                    NodeList.push(SubNode);
                    break;
                case LexerType.ltString:
                    if (prevNode && [NodeType.ntPlus, NodeType.ntMinus, NodeType.ntMul, NodeType.ntDiv, NodeType.ntNegativeIf, NodeType.ntArrayPushSeparatorKey].indexOf(prevNode.nType) === -1)
                        throw new ParserException("Parse string expression failed", this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntString, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltIDStr:
                    /*
                    if (prevNode && !prevNode.isMathNode())
                        throw new ParserException("Parse expression failed", this.lexer.tokenCursor);
                     */

                    SubNode = new ParseNode(this.lexer.tokenCursor);
                    const saveToken = this.lexer.tokenValue;

                    if (this.reservedWords.indexOf(saveToken.toLowerCase())>=0)
                    {
                        //throw new ParserException("can", this.lexer.tokenCursor);
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
                        throw new ParserException("Parse expression failed", this.lexer.tokenCursor);

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
                                throw new ParserException('SubNode.childItems === null', this.lexer.tokenCursor);

                            if (SubExpressionNode.childItems === null)
                                throw new ParserException('SubExpressionNode.childItems === null', this.lexer.tokenCursor);

                            // a[1] = 5;
                            // childItems — путь к ячейке (a, [, 1, ]),
                            // nValue2 — ParseNode выражения присваивания (= 5).
                            // PHP эталон зеркалит ту же схему (см. CodeParser.php).
                            SubNode.nValue2 = SubExpressionNode;

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

                    throw new ParserException('Expression is assign', this.lexer.tokenCursor);
                case LexerType.ltCompare:

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntExpressionCompare);
                    SubNode.nValue = this.parseCompareToken(this.lexer.tokenValue);
                    NodeList.push(SubNode);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntIFValue);
                    this.parseExpression(SubNode, true, new LexerTypeArray(...StopLex, LexerType.ltCompare, LexerType.ltCompareAnd, LexerType.ltCompareOr));
                    NodeList.push(SubNode);

                    getNextToken = false;

                    break;
                case LexerType.ltCompareAnd:
                    if (prevNode && prevNode.isCompareOrAndNode())
                        throw new ParserException('Invalid token', this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareAnd);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltCompareOr:
                    if (prevNode && prevNode.isCompareOrAndNode())
                        throw new ParserException('Invalid token', this.lexer.tokenCursor);

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareOr);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltNegativeIf:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntNegativeIf);
                    NodeList.push(SubNode);
                    break;
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
                        throw new ParserException("Parse lexer expression failed "+this.lexer.tokenName, this.lexer.tokenCursor);
                    }
                    break;
                case LexerType.ltArraySeparator:
                    if (ParentNode.nType === NodeType.ntArrayPush)
                    {
                        if (!NodeList.length)
                        {
                            throw new ParserException("syntax error, unexpected token "+this.lexer.tokenValue, this.lexer.tokenCursor);
                        }

                        ParentNode.nType = NodeType.ntArrayPushSeparator;
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntArrayPushSeparatorKey);
                        SubNode.childItems = NodeList;
                        NodeList = [SubNode];
                    } else {
                        throw new ParserException("Parse lexer expression failed "+this.lexer.tokenName, this.lexer.tokenCursor);
                    }
                    break;
                default:
                    throw new ParserException("Parse lexer expression failed "+this.lexer.tokenName+" wait "+StopLex.asNames.join(', '), this.lexer.tokenCursor);
            }
        }

        if (!NodeList.length)
            throw new ParserException("Parse expression failed", this.lexer.tokenCursor);

        const lastNode = NodeList[NodeList.length - 1];

        if (lastNode.isMathNode() || lastNode.isCompareOrAndNode())
            throw new ParserException("Parse expression failed", this.lexer.tokenCursor);

        let idx = 0,
            leftIdx = 0,
            rightIdx,
            node;

        while (idx<NodeList.length-1)
        {
            node = NodeList[idx];
            if (node.isMathNode())
            {
                if (node.nType !== NodeType.ntMul && node.nType !== NodeType.ntDiv)
                {
                    idx++;
                    leftIdx = idx;
                    idx++;
                    continue;
                }

                rightIdx = idx+1;
                while (rightIdx<NodeList.length-1)
                {
                    const rightNode = NodeList[rightIdx+1];

                    if (rightNode.nType !== NodeType.ntObjProp && (rightNode.isMathNode() || rightNode.isCompareOrAndNode()))
                        break;

                    rightIdx++;
                }

                const SubNode = new ParseNode(NodeList[idx].cursorPos, NodeType.ntSubExpression);

                SubNode.childItems = NodeList.slice(leftIdx, rightIdx+1);
                NodeList.splice(leftIdx, rightIdx-leftIdx+1, SubNode);
                idx = leftIdx;
            }
            idx++;
        }

        ParentNode.childItems = NodeList;
    }

    parseAssign(Node: unknown, EndLineType: unknown)
    {
        if (!(Node instanceof ParseNode))
            throw new ParserException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

        if (!(EndLineType instanceof LexerTypeArray))
            throw new ParserException('EndLineType must be instanceof LexerTypeArray', this.lexer.tokenCursor);


        this.parseExpression(Node, true, EndLineType);
    }

    parseFunction(Node:unknown)
    {
        if (!(Node instanceof ParseNode))
            throw new ParserException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

        this.lexer.getToken();

        if (this.lexer.tokenSym !== LexerType.ltIDStr)
            throw new ParserException("function name not defined", this.lexer.tokenCursor);

        Node.nValue2 = this.lexer.tokenValue;

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltLPar)
            throw new ParserException("function LPar not found", this.lexer.tokenCursor);

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
            throw new ParserException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

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
            throw new ParserException('Node must be instanceof ParseNode', this.lexer.tokenCursor);

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
                    throw new ParserException('Expression is empty', this.lexer.tokenCursor);
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

                throw new ParserException("Parse IF failed", this.lexer.tokenCursor);
            }

            SubNode = new ParseNode(this.lexer.tokenCursor);
            // EndCompareType должен быть в стоп-списке: иначе bare-выражения вроде
            // for(i=0; true; ...) не разберутся (`;` встречается раньше любого ltCompare).
            this.parseExpression(SubNode, false, new LexerTypeArray(LexerType.ltCompare, LexerType.ltRPar, LexerType.ltCompareAnd, LexerType.ltCompareOr, EndCompareType));
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
            else throw new ParserException("Parse IF failed", this.lexer.tokenCursor);

            NodeList.push(SubNode);
        }

        Node.childItems = NodeList;
    }

    parseCode(NodeList: ParseNode[], getFirstToken: boolean, inline: boolean, endLineType: LexerTypeArray)
    {
        let getNextToken = false;

        if (!Array.isArray(NodeList))
            throw new ParserException('NodeList must be array', this.lexer.tokenCursor);

        if (!inline)
        {
            if (getFirstToken)
                this.lexer.getToken();
        }
        else
        {
            getNextToken = getFirstToken;
        }

        while (true)
        {
            if (getNextToken)
                this.lexer.getToken();

            if (endLineType.indexOf(this.lexer.tokenSym) !== -1)
                return;

            getNextToken = true;

            if (this.lexer.tokenSym === LexerType.ltIDStr && this.lexer.tokenValue === "return")
            {
                const Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntReturn);
                NodeList.push(Node);

                if (inline)
                {
                    this.parseExpression(Node, true, endLineType.cloneAdd(LexerType.ltSemicolon));
                } else {
                    this.parseExpression(Node, true, LexerTypeArray.one(LexerType.ltSemicolon));
                }

                continue;
            }


            if ([LexerType.ltIDStr, LexerType.ltShortIncrement, LexerType.ltShortDecrement].indexOf(this.lexer.tokenSym)>=0)
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
            }
            else
            {
                let Node, Node2;
                switch (this.lexer.tokenSym)
                {
                    case LexerType.ltSwitch:
                        // switch/case зарезервированы в лексере, но не реализованы в парсере.
                        // Если возьмёмся — добавить parseSwitch и убрать throw.
                        throw new ParserException('Switch not implemented', this.lexer.tokenCursor);
                    case LexerType.ltFor:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntFor);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new ParserException("Parse FOR failed", this.lexer.tokenCursor);

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];
                        Node.childItems.push(Node2);

                        this.parseCode(Node2.childItems, true, true, LexerTypeArray.one(LexerType.ltSemicolon));

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntForCompare);
                        Node.childItems.push(Node2);

                        this.parseCompare(Node2, LexerType.ltSemicolon);

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];
                        Node.childItems.push(Node2);

                        this.parseCode(Node2.childItems, true, true, LexerTypeArray.one(LexerType.ltRPar));

                        if (this.lexer.tokenSym !== LexerType.ltRPar)
                            throw new ParserException("Parse FOR failed", this.lexer.tokenCursor);

                        this.lexer.getToken();

                        Node2 = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node2.childItems = [];

                        if (this.lexer.tokenSym === LexerType.ltStartCode)
                        {
                            this.parseCode(Node2.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
                        } else {
                            this.parseCode(Node2.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon));
                        }

                        Node.childItems.push(Node2);

                        break;
                    case LexerType.ltWhile:
                        // Узел while хранит двух детей: [0] — условие (ntForCompare),
                        // [1] — тело (ntSubCode). Тот же контракт, что у ntFor, минус init и increment.
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntWhile);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new ParserException("operator while LPar not found", this.lexer.tokenCursor);

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
                            this.parseCode(Node2.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon));
                        }

                        break;
                    case LexerType.ltBreak:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntBreak);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltSemicolon)
                            throw new ParserException("Parse break failed", this.lexer.tokenCursor);
                        break;
                    case LexerType.ltContinue:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntContinue);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltSemicolon)
                            throw new ParserException("Parse continue failed", this.lexer.tokenCursor);
                        break;
                    case LexerType.ltIF:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntIF);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new ParserException("operator if LPar not found", this.lexer.tokenCursor);

                        this.parseCompare(Node, LexerType.ltRPar);

                        if (!Node.childItems?.length)
                            throw new ParserException('Expression is empty', this.lexer.tokenCursor);

                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubCode);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.lexer.getToken();

                        if (this.lexer.tokenSym === LexerType.ltStartCode)
                        {
                            this.parseCode(Node.childItems, true, false, LexerTypeArray.one(LexerType.ltEndCode));
                        } else {
                            this.parseCode(Node.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon));
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
                            this.parseCode(Node.childItems, false, true, LexerTypeArray.one(LexerType.ltSemicolon));
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
                        throw new ParserException("Failed parse code, tokenSym: "+this.lexer.tokenName, this.lexer.tokenCursor);
                }
            }

            if (inline && endLineType.indexOf(this.lexer.tokenSym) !== -1)
                return;
        }
    }

}
