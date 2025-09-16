import {LexerTypeArray, LexerType, CodeLexer, TokenCursor} from "./lexer.js";
import {CursorPos} from "node:readline";

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
            throw new Error('Set undefined nType');

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
        let k = Object.keys(NodeType),
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

        throw new Error("Unknown compare token");
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
                        throw new Error('Invalid mul operator');

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMul);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltDiv:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new Error('Invalid div operator');

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntDiv);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltMod:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new Error('Invalid mod operator');

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntMod);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBitAnd:
                    if (!prevNode || (prevNode.isMathNode() || prevNode.isCompareOrAndNode()))
                        throw new Error('Invalid BitAnd operator');

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBitAnd);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltObjProp:
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntObjProp, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltNumeric:
                    if (prevNode && !prevNode.isMathNode() && !prevNode.isCompareOrAndNode() && prevNode.nType !== NodeType.ntArrayPushSeparatorKey)
                        throw new Error("Parse expression failed");

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntNumeric, parseInt(this.lexer.tokenValue));
                    if (!Number.isInteger(SubNode.nValue))
                        throw new Error("Failed parse integer value "+this.lexer.tokenValue);

                    NodeList.push(SubNode);
                    break;
                case LexerType.ltFloat:
                    if (prevNode && !prevNode.isMathNode())
                        throw new Error("Parse expression failed");
                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFloat, parseFloat(this.lexer.tokenValue));

                    if (!Number.isInteger(SubNode.nValue))
                        throw new Error("Failed parse float value "+this.lexer.tokenValue);

                    NodeList.push(SubNode);
                    break;
                case LexerType.ltString:
                    if (prevNode && [NodeType.ntPlus, NodeType.ntMinus, NodeType.ntMul, NodeType.ntDiv, NodeType.ntNegativeIf, NodeType.ntArrayPushSeparatorKey].indexOf(prevNode.nType) === -1)
                        throw new Error("Parse string expression failed");

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntString, this.lexer.tokenValue);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltIDStr:
                    /*
                    if (prevNode && !prevNode.isMathNode())
                        throw new Error("Parse expression failed");
                     */

                    SubNode = new ParseNode(this.lexer.tokenCursor);
                    let saveToken = this.lexer.tokenValue;

                    if (this.reservedWords.indexOf(saveToken.toLowerCase())>=0)
                    {
                        //throw new Error("can");
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
                        throw new Error("Parse expression failed");

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntSubExpression);
                    this.parseExpression(SubNode, true, LexerTypeArray.one(LexerType.ltRPar));
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltBracketOpen:

                    if (!prevNode)
                    {
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntArray);
                        SubNode.childItems = [];

                        while (true)
                        {
                            this.lexer.getToken();

                            if (this.lexer.tokenSym === LexerType.ltBracketClose)
                                break;

                            let NodePush = new ParseNode(this.lexer.tokenCursor, NodeType.ntArrayPush);

                            this.parseExpression(NodePush, false, new LexerTypeArray(LexerType.ltComma, LexerType.ltBracketClose));

                            SubNode.childItems.push(NodePush);

                            if (this.lexer.tokenSym === LexerType.ltBracketClose)
                                break;
                        }

                        NodeList.push(SubNode);
                    } else {
                        console.log(prevNode.typeName); //TODO remove
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBracketGetKey);
                        this.parseExpression(SubNode, true, LexerTypeArray.one(LexerType.ltBracketClose));

                        this.lexer.getToken();

                        NodeList.push(SubNode);

                        if (this.lexer.tokenSym === LexerType.ltAssign)
                        {
                            SubNode.nType = NodeType.ntBracketSetKey;

                            let SubExpressionNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntBracketSetKey);
                            this.parseExpression(SubExpressionNode, true, StopLex);

                            if (SubNode.childItems === null)
                                throw new Error('SubNode.childItems === null');

                            if (SubExpressionNode.childItems === null)
                                throw new Error('SubExpressionNode.childItems === null');

                            //TODO в PHP версии тоже изменить надо
                            /* a[1] = 5;
                            SubNode.childItems -> a[1]
                            SubNode.nValue2 -> 5;

                            было

                            SubNode.childItems = [
                                SubNode.childItems, //a[1] код куда устанавливается значения
                                SubExpressionNode.childItems, // = 5; выражение
                            ];

                             */
                            SubNode.nValue2 =  SubExpressionNode;

                            ParentNode.childItems = NodeList; //выражение закончено, выходим из парсинга
                            return;
                        } else {
                            getNextToken = false;
                        }
                    }

                    break;
                case LexerType.ltAssign:

                    throw new Error('Expression is assign');
                    //ParseExpression(Node, false, StopLex);
                    break;
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
                        throw new Error('Invalid token');

                    SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntCompareAnd);
                    NodeList.push(SubNode);
                    break;
                case LexerType.ltCompareOr:
                    if (prevNode && prevNode.isCompareOrAndNode())
                        throw new Error('Invalid token');

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
                    } else {
                        throw new Error("Parse lexer expression failed "+this.lexer.tokenName);
                    }
                    break;
                case LexerType.ltArraySeparator:
                    if (ParentNode.nType === NodeType.ntArrayPush)
                    {
                        if (!NodeList.length)
                        {
                            throw new Error("syntax error, unexpected token "+this.lexer.tokenValue);
                        }

                        ParentNode.nType = NodeType.ntArrayPushSeparator;
                        SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntArrayPushSeparatorKey);
                        SubNode.childItems = NodeList;
                        NodeList = [SubNode];
                    } else {
                        throw new Error("Parse lexer expression failed "+this.lexer.tokenName);
                    }
                    break;
                default:
                    throw new Error("Parse lexer expression failed "+this.lexer.tokenName+" wait "+StopLex.asNames.join(', '));
            }
        }

        if (!NodeList.length)
            throw new Error("Failed parse expression");

        let lastNode = NodeList[NodeList.length - 1];

        if (lastNode.isMathNode() || lastNode.isCompareOrAndNode())
            throw new Error("Failed parse expression");

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
                    let rightNode = NodeList[rightIdx+1];

                    if (rightNode.nType !== NodeType.ntObjProp && (rightNode.isMathNode() || rightNode.isCompareOrAndNode()))
                        break;

                    rightIdx++;
                }

                let SubNode = new ParseNode(NodeList[idx].cursorPos, NodeType.ntSubExpression);

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
            throw new Error('Node must be instanceof ParseNode');

        if (!(EndLineType instanceof LexerTypeArray))
            throw new Error('EndLineType must be instanceof LexerTypeArray');


        this.parseExpression(Node, true, EndLineType);
    }

    parseFunction(Node:unknown)
    {
        if (!(Node instanceof ParseNode))
            throw new Error('Node must be instanceof ParseNode');

        this.lexer.getToken();

        if (this.lexer.tokenSym !== LexerType.ltIDStr)
            throw new Error("function name not defined");

        Node.nValue2 = this.lexer.tokenValue;

        this.lexer.getToken();
        if (this.lexer.tokenSym !== LexerType.ltLPar)
            throw new Error("function LPar not found");

        const NodeList = [];

        while (true)
        {
            this.lexer.getToken();
            if (this.lexer.tokenSym === LexerType.ltRPar)
                break;

            let SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncParam);
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
            throw new Error('Node must be instanceof ParseNode');

        let NodeList = [];

        while (true)
        {
            this.lexer.getToken();
            if (this.lexer.tokenSym === LexerType.ltRPar)
                break;

            let SubNode = new ParseNode(this.lexer.tokenCursor, NodeType.ntFuncParam);
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
            throw new Error('Node must be instanceof ParseNode');

        let NodeList = [];

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
                    throw new Error('Expression is empty');
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

                throw new Error("Parse IF failed");
            }

            SubNode = new ParseNode(this.lexer.tokenCursor);
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
            else throw new Error("Parse IF failed");

            NodeList.push(SubNode);
        }

        Node.childItems = NodeList;
    }

    parseCode(NodeList: ParseNode[], getFirstToken: boolean, inline: boolean, endLineType: LexerTypeArray)
    {
        let getNextToken = false;

        if (!Array.isArray(NodeList))
            throw new Error('NodeList must be array');

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
                        throw new Error('Switch not implemented');
                        //this.parseSwitch(NodeList);
                        break;
                    case LexerType.ltFor:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntFor);
                        Node.childItems = [];
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new Error("Parse FOR failed");

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
                            throw new Error("Parse FOR failed");

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
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntWhile);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new Error("operator if LPar not found");

                        this.parseCompare(Node, LexerType.ltRPar);

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
                    case LexerType.ltBreak:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntBreak);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltSemicolon)
                            throw new Error("Parse break failed");
                        break;
                    case LexerType.ltIF:
                        Node = new ParseNode(this.lexer.tokenCursor, NodeType.ntIF);
                        NodeList.push(Node);

                        this.lexer.getToken();
                        if (this.lexer.tokenSym !== LexerType.ltLPar)
                            throw new Error("operator if LPar not found");

                        this.parseCompare(Node, LexerType.ltRPar);

                        if (!Node.childItems?.length)
                            throw new Error('Expression is empty');

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
                        throw new Error("Failed parse code, tokenSym: "+this.lexer.tokenName);
                }
            }

            if (inline && endLineType.indexOf(this.lexer.tokenSym) !== -1)
                return;
        }

        throw new Error("WTF");
    }

}
