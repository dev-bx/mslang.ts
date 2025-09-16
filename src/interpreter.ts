import {CompareType, NodeType, ParseNode} from "./parser";
import {LexerType, TokenCursor} from "./lexer";
import {VariableType} from "./variabletype";
import {StackVariable} from "./stackvariable";
import {StackVariableNumber} from "./stackvariablenumber";
import {StackVariableString} from "./stackvariablestring";
import {StackVariableBoolean} from "./stackvariableboolean";
import {StackVariableArray} from "./stackvariablearray";
import {StackVariableNull} from "./stackvariablenull";
import {StackVariableUndefined} from "./stackvariableundefined";
import {StackVariableFunction} from "./stackvariablefunction";
import {FunctionEntry} from "./functionentry";
import {MathFunctions} from "./mathfunctions";
import {StackVariableDateTime} from "./stackvariabledatetime";
import {InterpreterException, MSLangException} from "./exceptions";
import {StackVariableRef} from "./stackvariableref";

const InterpreterNodeType = {
    'ntAssignFinish': 1000,
    'ntFuncCallFinish': 1001,
    'ntSubExpressionFinish': 1002,
    'ntFuncParamFinish': 1003,
    'ntIFFinish': 1004,
    'ntIFValueFinish': 1005,
    'ntIFValueBOOLFinish': 1006,
    'ntSubCodeFinish': 1007,
    'ntForLoop': 1008,
    'ntForCompareFinish': 1009,
    'ntReturnFinish': 1010,
    'ntExpressionAssignFinish': 1011,
    'ntSelfFuncCallFinish': 1012,
    'ntArrayFinish': 1013,
    'ntArrayPushFinish': 1014,
    'ntBracketGetKeyFinish': 1015,
    'ntBracketSetKeyLeftFinish': 1016,
    'ntBracketSetKeyRightFinish': 1017,
    'ntFuncParamArrayUnpackFinish': 1018,
    'ntArrayPushSeparatorKeyFinish': 1019,
    'ntArrayPushSeparatorFinish': 1020,
    'ntArrayPushKeyValue': 1021,
}

export class InterpreterNode extends ParseNode {
    get typeName() {
        let k = Object.keys(InterpreterNodeType),
            v = Object.values(InterpreterNodeType);

        if (v.indexOf(this.nType) === -1) {
            k = Object.keys(NodeType);
            v = Object.values(NodeType);
        }

        return k[v.indexOf(this.nType)];
    }
}

type TNodeHandler = (context: ContextInterpreter, token: ParseNode) => void;
type NodeHandlerItems = Record<number, TNodeHandler>;

export class Interpreter {
    _nodeHandler: NodeHandlerItems

    constructor() {
        this._nodeHandler = [];
    }

    destroy() {
        this._nodeHandler = (undefined as unknown as typeof this._nodeHandler);
    }

    registerNodeHandler(nodeType: number, handler: unknown) {
        if (nodeType === undefined)
            throw new MSLangException('Undefined nodeType');

        this._nodeHandler[nodeType] = handler as TNodeHandler;
    }

    getCodeHandler(nodeType: number) {
        return this._nodeHandler[nodeType];
    }

    registerHandlers() {
        this.registerNodeHandler(NodeType.ntAssign, (...args: Parameters<TNodeHandler>) => {
            this.assignHandler(...args);
        });

        this.registerNodeHandler(InterpreterNodeType.ntAssignFinish, (...args: Parameters<TNodeHandler>) => {
            this.assignFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntExpressionAssign, (...args: Parameters<TNodeHandler>) => {
            this.expressionAssignHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntExpressionAssignFinish, (...args: Parameters<TNodeHandler>) => {
            this.expressionAssignFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntNumeric, (...args: Parameters<TNodeHandler>) => {
            this.numericHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntFloat, (...args: Parameters<TNodeHandler>) => {
            this.floatHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntString, (...args: Parameters<TNodeHandler>) => {
            this.stringHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntPlus, (...args: Parameters<TNodeHandler>) => {
            this.plusHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntMinus, (...args: Parameters<TNodeHandler>) => {
            this.minusHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntMul, (...args: Parameters<TNodeHandler>) => {
            this.mulHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntDiv, (...args: Parameters<TNodeHandler>) => {
            this.divHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntShortIncrement, (...args: Parameters<TNodeHandler>) => {
            this.shortIncrementHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntShortDecrement, (...args: Parameters<TNodeHandler>) => {
            this.shortDecrementHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntSubExpression, (...args: Parameters<TNodeHandler>) => {
            this.subExpressionHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntSubExpressionFinish, (...args: Parameters<TNodeHandler>) => {
            this.subExpressionFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntFuncCall, (...args: Parameters<TNodeHandler>) => {
            this.funcCallHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntFuncNameSpaceCall, (...args: Parameters<TNodeHandler>) => {
            this.funcCallHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntFuncParam, (...args: Parameters<TNodeHandler>) => {
            this.funcParamHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntFuncParamFinish, (...args: Parameters<TNodeHandler>) => {
            this.funcParamFinishHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntFuncCallFinish, (...args: Parameters<TNodeHandler>) => {
            this.funcCallFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntSelfFuncCall, (...args: Parameters<TNodeHandler>) => {
            this.selfFuncCallHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntSelfFuncCallFinish, (...args: Parameters<TNodeHandler>) => {
            this.selfFuncCallFinishHandler(...args)
        });


        this.registerNodeHandler(NodeType.ntShiftSP, (...args: Parameters<TNodeHandler>) => {
            this.shiftSPHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntObjProp, (...args: Parameters<TNodeHandler>) => {
            this.objPropHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntContextVariable, (...args: Parameters<TNodeHandler>) => {
            this.contextVariableHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntIF, (...args: Parameters<TNodeHandler>) => {
            this.ifHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntIFValue, (...args: Parameters<TNodeHandler>) => {
            this.ifValueHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntIFValueBOOL, (...args: Parameters<TNodeHandler>) => {
            this.ifValueBOOLHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntIFValueFinish, (...args: Parameters<TNodeHandler>) => {
            this.ifValueFinishHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntIFValueBOOLFinish, (...args: Parameters<TNodeHandler>) => {
            this.ifValueBOOLFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntExpressionCompare, (...args: Parameters<TNodeHandler>) => {
            this.expressionCompareHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntCompare, (...args: Parameters<TNodeHandler>) => {
            this.ifCompareHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntCompareOr, (...args: Parameters<TNodeHandler>) => {
            this.ifCompareOrHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntCompareAnd, (...args: Parameters<TNodeHandler>) => {
            this.ifCompareAndHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntNegativeIf, (...args: Parameters<TNodeHandler>) => {
            this.negativeIfHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntIFFinish, (...args: Parameters<TNodeHandler>) => {
            this.ifFinishHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntSubCode, (...args: Parameters<TNodeHandler>) => {
            this.subCodeHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntSubCodeFinish, (...args: Parameters<TNodeHandler>) => {
            this.subCodeFinishHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntELSE, (...args: Parameters<TNodeHandler>) => {
            this.elseHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntFor, (...args: Parameters<TNodeHandler>) => {
            this.forHandler(...args)
        });
        this.registerNodeHandler(NodeType.ntForCompare, (...args: Parameters<TNodeHandler>) => {
            this.forCompareHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntForCompareFinish, (...args: Parameters<TNodeHandler>) => {
            this.forCompareFinishHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntForLoop, (...args: Parameters<TNodeHandler>) => {
            this.forLoopHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntReturn, (...args: Parameters<TNodeHandler>) => {
            this.returnHandler(...args)
        });
        this.registerNodeHandler(InterpreterNodeType.ntReturnFinish, (...args: Parameters<TNodeHandler>) => {
            this.returnFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntBreak, (...args: Parameters<TNodeHandler>) => {
            this.breakHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntArray, (...args: Parameters<TNodeHandler>) => {
            this.ArrayHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntArrayPush, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushFinish, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushFinishHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntArrayFinish, (...args: Parameters<TNodeHandler>) => {
            this.ArrayFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntBracketGetKey, (...args: Parameters<TNodeHandler>) => {
            this.BracketGetKeyHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntBracketGetKeyFinish, (...args: Parameters<TNodeHandler>) => {
            this.BracketGetKeyFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntBracketSetKey, (...args: Parameters<TNodeHandler>) => {
            this.BracketSetKeyHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntBracketSetKeyLeftFinish, (...args: Parameters<TNodeHandler>) => {
            this.BracketSetKeyLeftFinishHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntBracketSetKeyRightFinish, (...args: Parameters<TNodeHandler>) => {
            this.BracketSetKeyRightFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntFuncParamArrayUnpack, (...args: Parameters<TNodeHandler>) => {
            this.FuncParamArrayUnpackHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntFuncParamArrayUnpackFinish, (...args: Parameters<TNodeHandler>) => {
            this.FuncParamArrayUnpackFinishHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntArrayPushSeparator, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushSeparatorHandler(...args)
        });

        this.registerNodeHandler(NodeType.ntArrayPushSeparatorKey, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushSeparatorKeyHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushSeparatorKeyFinish, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushSeparatorKeyFinishHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushSeparatorFinish, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushSeparatorFinishHandler(...args)
        });

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushKeyValue, (...args: Parameters<TNodeHandler>) => {
            this.ArrayPushKeyValueHandler(...args)
        });
    }

    assignHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('assign is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntAssignFinish;
        node.nValue = token.nValue;
        context._codeItems.push(node);

        //console.log(util.inspect(token, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    assignFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();
        context.popExecutionStack(true);

        if (typeof token.nValue !== 'string')
            throw new InterpreterException('variable name must be string', token.cursorPos);

        context.setVariable(token.nValue, context.createVariable(variable.type, variable._value));
    }

    expressionAssignHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('assign is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntExpressionAssignFinish;
        node.nValue = token.nValue;
        context._codeItems.push(node);

        //console.log(util.inspect(token, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    expressionAssignFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack(true);

        let cloneVariable = context.cloneVariable(variable);

        /*
        if (context.getVariable(token.nValue)) { //check for defined variable
            context.setVariable(token.nValue, cloneVariable);
        }
         */

        if (typeof token.nValue !== 'string')
            throw new InterpreterException('variable name must be string', token.cursorPos);

        context.setVariable(token.nValue, cloneVariable);

        context.pushStackVar(cloneVariable);
    }

    numericHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.createVariable(VariableType.vtInteger, token.nValue);

        context.pushStackVar(variable);
    }

    floatHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.createVariable(VariableType.vtFloat, token.nValue);

        context.pushStackVar(variable);
    }

    stringHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.createVariable(VariableType.vtString, token.nValue);

        context.pushStackVar(variable);
    }

    plusHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        let rightVar = context.popStackVar(),
            rightTmp;

        let variable;

        if (!context._stackVars.length) {
            rightTmp = rightVar.castAs(VariableType.vtNumber);
            if (!rightTmp)
                throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

            context.pushStackVar(context.createVariable(VariableType.vtNumber, rightTmp.value));
            return;
        }

        let leftVar = context.popStackVar(),
            leftTmp;

        if (leftVar.isNumeric && rightVar.isNumeric) {
            leftTmp = leftVar.castAs(VariableType.vtNumber);
            if (!leftTmp)
                throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

            rightTmp = rightVar.castAs(VariableType.vtNumber);
            if (!rightTmp)
                throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

            variable = context.createVariable(VariableType.vtNumber, leftTmp.value + rightTmp.value);
        } else {
            leftTmp = leftVar.castAs(VariableType.vtString);
            if (!leftTmp)
                throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as string', token.cursorPos);

            rightTmp = rightVar.castAs(VariableType.vtString);
            if (!rightTmp)
                throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as string', token.cursorPos);

            variable = context.createVariable(VariableType.vtString, leftTmp.value + rightTmp.value);
        }

        context.pushStackVar(variable);
    }

    minusHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        let rightVar = context.popStackVar(),
            rightVarTmp = rightVar.castAs(VariableType.vtNumber),
            variable;

        if (!rightVarTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        if (!context._stackVars.length) {
            variable = context.createVariable(VariableType.vtNumber, -rightVarTmp.value);
            context.pushStackVar(variable);
            return;
        }

        let leftVar = context.popStackVar(),
            leftVarTmp = leftVar.castAs(VariableType.vtNumber);

        if (!leftVarTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        variable = context.createVariable(VariableType.vtNumber, leftVarTmp.value - rightVarTmp.value);

        context.pushStackVar(variable);
    }

    mulHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        let rightVar = context.popStackVar(),
            leftVar = context.popStackVar(),
            rightTmp, leftTmp;

        leftTmp = leftVar.castAs(VariableType.vtNumber);
        if (!leftTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        rightTmp = rightVar.castAs(VariableType.vtNumber);
        if (!rightTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        let variable = context.createVariable(VariableType.vtNumber, leftTmp.value * rightTmp.value);

        context.pushStackVar(variable);
    }

    divHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        let rightVar = context.popStackVar(),
            leftVar = context.popStackVar(),
            rightTmp, leftTmp;

        leftTmp = leftVar.castAs(VariableType.vtNumber);
        if (!leftTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        rightTmp = rightVar.castAs(VariableType.vtNumber);
        if (!rightTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        let variable = context.createVariable(VariableType.vtNumber, leftTmp.value / rightTmp.value);

        context.pushStackVar(variable);
    }

    shortIncrementHandler(context: ContextInterpreter, token: ParseNode) {
        if (context._stackVars.length) {
            let variable = context.popStackVar(),
                variableAsNumber = variable.castAs(VariableType.vtNumber);

            if (!variableAsNumber) {
                throw new InterpreterException('Failed cast ' + variable.typeName + ' as number', token.cursorPos);
            }

            let newVariable = context.createVariable(VariableType.vtNumber, variableAsNumber.value);
            context.pushStackVar(newVariable);

            if (variable instanceof StackVariableRef) {
                variable.refValue = context.createVariable(VariableType.vtNumber, variableAsNumber.value + 1);
            } else {
                //example string.length++;
                //throw new InterpreterException('Variable must be reference', token.cursorPos);
            }
        } else {
            context.execGetVariable();

            let variable = context.popStackVar(),
                variableAsNumber = variable.castAs(VariableType.vtNumber);

            if (!variableAsNumber) {
                throw new InterpreterException('Failed cast ' + variable.typeName + ' as number', token.cursorPos);
            }

            if (variable instanceof StackVariableRef) {
                variable.refValue = context.createVariable(VariableType.vtNumber, variableAsNumber.value + 1);
            }

            variableAsNumber.value = variableAsNumber.value + 1;
            context.pushStackVar(variableAsNumber);
        }
    }

    shortDecrementHandler(context: ContextInterpreter, token: ParseNode) {
        if (context._stackVars.length) {
            let variable = context.popStackVar(),
                variableAsNumber = variable.castAs(VariableType.vtNumber);

            if (!variableAsNumber) {
                throw new InterpreterException('Failed cast ' + variable.typeName + ' as number', token.cursorPos);
            }

            let newVariable = context.createVariable(VariableType.vtNumber, variableAsNumber.value);
            context.pushStackVar(newVariable);

            if (variable instanceof StackVariableRef) {
                variable.refValue = context.createVariable(VariableType.vtNumber, variableAsNumber.value - 1);
            } else {
                //example string.length--;
                //throw new InterpreterException('Variable must be reference', token.cursorPos);
            }
        } else {
            context.execGetVariable();

            let variable = context.popStackVar(),
                variableAsNumber = variable.castAs(VariableType.vtNumber);

            if (!variableAsNumber) {
                throw new InterpreterException('Failed cast ' + variable.typeName + ' as number', token.cursorPos);
            }

            if (variable instanceof StackVariableRef) {
                variable.refValue = context.createVariable(VariableType.vtNumber, variableAsNumber.value - 1);
            }

            variableAsNumber.value = variableAsNumber.value - 1;
            context.pushStackVar(variableAsNumber);
        }
    }

    subExpressionHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('Sub expression is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntSubExpressionFinish;
        context._codeItems.push(node);
    }

    subExpressionFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    funcCallHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('funcCall is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntFuncCallFinish;
        node.nValue = token;
        node.nValue2 = context._stackVars.length; //stack position
        context._codeItems.push(node);
    }

    funcParamHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('funcParam is empty', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntFuncParamFinish;
        context._codeItems.push(node);
    }

    funcParamFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    funcCallFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue2 !== 'number' || !Number.isInteger(token.nValue2))
            throw new InterpreterException('Invalid drop stack length', token.cursorPos);

        let paramCount = context._stackVars.length - token.nValue2;

        let parameters = [];

        while (paramCount > 0) {
            parameters.unshift(context.popStackVar());
            paramCount--;
        }

        context.popExecutionStack();

        if (token.nValue2 > context._stackVars.length)
            throw new InterpreterException('Stack corruption', token.cursorPos);

        if (!(token.nValue instanceof ParseNode))
            throw new InterpreterException('token nValue invalid', token.cursorPos);

        if (typeof token.nValue.nValue !== 'string')
            throw new InterpreterException('call function or class name must be string');

        let funcName = token.nValue.nValue;

        if (token.nValue.nValue2) {
            funcName += '::' + token.nValue.nValue2;
        }

        context.pushStackVar(context.callFunction(funcName, parameters));
    }

    selfFuncCallHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('selfFuncCall is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntSelfFuncCallFinish;
        node.nValue = token;
        node.nValue2 = context._stackVars.length; //stack position
        context._codeItems.push(node);
    }

    selfFuncCallFinishHandler(context: ContextInterpreter, token: ParseNode) {
        //let paramCount = context._stackVars.length - token.nValue2;
        let paramCount = context._stackVars.length;

        let parameters = [];

        while (paramCount > 0) {
            parameters.unshift(context.popStackVar());
            paramCount--;
        }

        context.popExecutionStack();

        if (typeof token.nValue2 !== 'number' || !Number.isInteger(token.nValue2))
            throw new InterpreterException('Stack corruption', token.cursorPos);

        if (token.nValue2 > context._stackVars.length)
            throw new InterpreterException('Stack corruption', token.cursorPos);

        if (!(token.nValue instanceof ParseNode))
            throw new InterpreterException('Invalid nValue, expected ParseNode', token.cursorPos);

        if (typeof token.nValue.nValue !== 'string')
            throw new InterpreterException('call function or class name must be string');

        let funcName = token.nValue.nValue;

        if (token.nValue.nValue2) {
            funcName += '::' + token.nValue.nValue2;
        }

        let self = context.popStackVar();

        context.pushStackVar(context.selfCallFunction(self, funcName, parameters));
    }

    shiftSPHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue !== 'number' || !Number.isInteger(token.nValue))
            throw new InterpreterException('Invalid shiftSP value', token.cursorPos);

        let count = token.nValue;

        while (count < 0) {
            if (!context._stackVars.length)
                throw new InterpreterException('Stack corruption', token.cursorPos);

            context.popStackVar();

            count++;
        }
    }

    objPropHandler(context: ContextInterpreter, token: ParseNode) {
        /*
        let variable = context.getVariable(token.nValue);

        if (!variable)
            throw new MSLangException('variable not defined ' + token.nValue);

        context.pushStackVar(variable);
         */

        let variable = context.popStackVar(),
            getVar;

        if (typeof token.nValue !== 'string')
            throw new InterpreterException('token nValue invalid', token.cursorPos);

        getVar = variable.getProperty(token.nValue);
        if (!(getVar instanceof StackVariable)) {
            getVar = variable.getFunctionEntry(token.nValue);
            if (getVar)
                getVar = new StackVariableFunction(getVar, variable);
        }

        if (!getVar) {
            getVar = new StackVariableUndefined(false);
            //throw new InterpreterException('Property or function "' + token.nValue + '" not found on ' + variable.typeName, token.cursorPos);
        }

        context.pushStackVar(getVar);
    }

    contextVariableHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue !== 'string')
        {
            throw new InterpreterException('variable name must be string');
        }

        let variable = context.getVariableRef(token.nValue);

        if (!variable)
            throw new InterpreterException('variable not defined ' + token.nValue, token.cursorPos);

        context.pushStackVar(variable);
    }

    ifHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('if (...) is empty', token.cursorPos);

        let variable = context.createVariable(VariableType.vtBoolean, false);

        context.pushStackVar(variable);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntIFFinish;
        context._codeItems.push(node);
        //console.log(util.inspect(token.childItems, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    ifValueHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('ifValue is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntIFValueFinish;
        context._codeItems.push(node);

        //console.log(util.inspect(token, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    ifValueBOOLHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('ifValueBOOL is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntIFValueBOOLFinish;
        context._codeItems.push(node);
    }

    ifValueFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    ifValueBOOLFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack();

        let compareVariable = context.createVariable(VariableType.vtBoolean, false);

        if (variable.isNumeric) {
            compareVariable.value = variable.value !== 0;
        } else {
            switch (variable.type) {
                case VariableType.vtString:
                    compareVariable.value = (variable.value as string).length > 0;
                    break;
                case VariableType.vtBoolean:
                    compareVariable.value = variable.value;
                    break;
                default:
                    compareVariable.value = !!variable.value;
            }
        }

        context.pushStackVar(compareVariable);
    }

    expressionCompareHandler(context: ContextInterpreter, token: ParseNode) {
        //context.execStepOver();
        context.execGetVariable();

        let rightCompare = context.popStackVar(),
            leftCompare = context.popStackVar(),
            compareResult = context.createVariable(VariableType.vtBoolean, false);

        this.compareVariable(token.nValue as CompareType, leftCompare, rightCompare, compareResult, token.cursorPos);

        context.pushStackVar(compareResult);
    }

    ifCompareHandler(context: ContextInterpreter, token: ParseNode) {
        //context.execStepOver();
        context.execGetVariable();

        let rightCompare = context.popStackVar(),
            leftCompare = context.popStackVar(),
            compareResult = context.createVariable(VariableType.vtBoolean, false);

        this.compareVariable(token.nValue as CompareType, leftCompare, rightCompare, compareResult, token.cursorPos);

        context.pushStackVar(compareResult);

        /*
        context.execStepOver();

        let rightCompare = context.popStackVar(),
            leftCompare = context.popStackVar(),
            compareResult = context.popStackVar();

        this.compareVariable(token.nValue, leftCompare, rightCompare, compareResult);

        context.pushStackVar(compareResult);
         */
    }

    compareVariable(compareType: CompareType, leftCompare: StackVariable, rightCompare: StackVariable, compareResult: StackVariable, cursorPosition?: TokenCursor) {
        let leftPriority = leftCompare.comparePriority(rightCompare, compareType),
            rightPriority = rightCompare.comparePriority(leftCompare, compareType);

        if (leftPriority === false && rightPriority === false) {
            throw new InterpreterException('Invalid compare types ' + leftCompare.typeName + ' and ' + rightCompare.typeName, cursorPosition)
        }

        if (leftPriority >= rightPriority) {
            compareResult.value = leftCompare.compare(rightCompare, compareType)
            return;
        }

        if ((compareType & CompareType.ctGreat) === CompareType.ctGreat) {
            compareType &= ~CompareType.ctGreat;
            compareType |= CompareType.ctLess;
        } else if ((compareType & CompareType.ctLess) === CompareType.ctLess) {
            compareType &= ~CompareType.ctLess;
            compareType |= CompareType.ctGreat;
        }

        compareResult.value = rightCompare.compare(leftCompare, compareType)
    }

    ifCompareOrHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        if (variable.type !== VariableType.vtBoolean)
            throw new InterpreterException('Invalid variable in IF Handler', token.cursorPos);

        context.pushStackVar(variable);

        if (variable.value === true) {
            if (!context._codeItems)
                throw new InterpreterException('codeItems not initialized', token.cursorPos);

            context._pos = context._codeItems.length - 1;
        }
    }

    ifCompareAndHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        if (variable.type !== VariableType.vtBoolean)
            throw new InterpreterException('Invalid variable in IF Handler', token.cursorPos);

        context.pushStackVar(variable);

        if (variable.value !== true) {
            if (!context._codeItems)
                throw new InterpreterException('codeItems not initialized', token.cursorPos);

            context._pos = context._codeItems.length - 1;
        }
    }

    negativeIfHandler(context: ContextInterpreter, token: ParseNode) {
        //context.execStepOver();
        context.execGetVariable();

        let variable = context.popStackVar(),
            varAsBoolean = variable.castAs(VariableType.vtBoolean);

        if (!varAsBoolean) {
            throw new InterpreterException('Failed cast ' + variable.typeName + ' as boolean', token.cursorPos);
        }

        let newVariable = context.createVariable(VariableType.vtBoolean, !varAsBoolean.value);

        context.pushStackVar(newVariable);
    }

    negativeIfFinishHandler(context: ContextInterpreter, token: ParseNode) {
    }

    ifFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        if (variable.type !== VariableType.vtBoolean)
            throw new InterpreterException('Invalid variable in IF Handler', token.cursorPos);

        context.popExecutionStack();

        if (!variable.value) {
            context.getNextInterToken();

            if (context.whoNextTypeInterToken === NodeType.ntELSE) {
                context.getNextInterToken();
            }
        }
    }

    subCodeHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('subCode is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntSubCodeFinish;
        context._codeItems.push(node);
    }

    subCodeFinishHandler(context: ContextInterpreter, token: ParseNode) {
        context.popExecutionStack();
    }

    elseHandler(context: ContextInterpreter, token: ParseNode) {
        /* если попали на выполнение ELSE значит сравнение в IF было TRUE, и пропускаем данный блок */
        context.getNextInterToken();
    }

    forHandler(context: ContextInterpreter, token: ParseNode) {
        if (token.childItems?.length !== 4)
            throw new InterpreterException('for handler must be 4 child items', token.cursorPos);

        if (!(token.childItems[0] instanceof ParseNode))
            throw new InterpreterException('for handler must be contains ParseNode', token.cursorPos)

        if (!token.childItems[0].childItems?.length)
            throw new InterpreterException('for handler ParseNode is empty', token.cursorPos)

        context.pushExecutionStack();

        context._type = ContextType.ctAllowBreak;
        context._codeItems = [];

        context._codeItems.push(...token.childItems[0].childItems); //init for variable;

        context._codeItems.push(token.childItems[1]); //check condition
        context._codeItems.push(token.childItems[3]); //execution for code
        context._codeItems.push(token.childItems[2]); //increment condition

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntForLoop;
        context._codeItems.push(node);
    }

    forCompareHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems?.length)
            throw new InterpreterException('forCompare is empty', token.cursorPos)

        let variable = context.createVariable(VariableType.vtBoolean, false);
        context.pushStackVar(variable);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntForCompareFinish;
        context._codeItems.push(node);
    }

    forCompareFinishHandler(context: ContextInterpreter, token: ParseNode) {

        if (context._stackVars.length) {
            let variable = context.popStackVar();

            if (variable.type !== VariableType.vtBoolean)
                throw new InterpreterException('For compare invalid variable type', token.cursorPos);

            context.popExecutionStack();

            if (!variable.value) {
                context.popExecutionStack();
            }
        } else { // for (;;;)
            context.popExecutionStack();
        }
    }

    forLoopHandler(context: ContextInterpreter, token: ParseNode) {
        context._pos -= 4;
    }

    returnHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('return childItems not initialized', token.cursorPos);

        if (token.childItems?.length === 0) {
            let variable = context.createVariable(VariableType.vtVoid, false);

            while (context._executionStack.length)
                context.popExecutionStack();

            context.pushStackVar(variable);
        }

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntReturnFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    returnFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        while (context._executionStack.length)
            context.popExecutionStack();

        context.pushStackVar(variable);

        context._type = ContextType.ctReturn;
    }

    breakHandler(context: ContextInterpreter, token: ParseNode) {
        while (context._executionStack.length) {
            let allowBreak = context._type === ContextType.ctAllowBreak;

            if (!allowBreak && context._type !== ContextType.ctNormal) {
                throw new InterpreterException('Invalid context execution stack type', token.cursorPos);
            }

            context.popExecutionStack();

            if (allowBreak)
                return;
        }

        throw new InterpreterException('break invalid statement', token.cursorPos);
    }

    ArrayHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Array childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        context._contextVariable = new StackVariableArray(false, []);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    ArrayPushHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('arrayPush childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    ArrayPushFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        if (!context._contextVariable)
        {
            throw new InterpreterException('ArrayPushFinish contextVariable not defined', token.cursorPos);
        }

        context._contextVariable.funcInvoke_push(context.cloneVariable(variable));

        context.popExecutionStack();
    }

    ArrayFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context._contextVariable;

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    BracketGetKeyHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('bracket Get Key childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntBracketGetKeyFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    BracketGetKeyFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        if (variable.type !== VariableType.vtNumber && variable.type !== VariableType.vtString) {
            throw new InterpreterException('You can access a property by string or numeric key, given ' + variable.typeName, token.cursorPos);
        }

        context.popExecutionStack();

        let accessTo = context.popStackVar(),
            propertyValue = accessTo.getProperty(variable.value as string);

        if (!propertyValue) {
            context.pushStackVar(context.createVariable(VariableType.vtUndefined, undefined));
        } else {
            if (propertyValue instanceof StackVariable) {
                context.pushStackVar(propertyValue);
            } else {
                throw new InterpreterException('Property return unknown variable', token.cursorPos);
            }
        }
    }

    BracketSetKeyHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Bracket Set Key childItems not initialized', token.cursorPos);

        if (!token.childItems.length)
            throw new InterpreterException('Bracket Set Key childItems is empty', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        /** @see /src/parser.ts */
        /** @see CodeParser::parseExpression */

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntBracketSetKeyLeftFinish;
        node.nValue = token.nValue2;
        context._codeItems.push(node);
    }

    BracketSetKeyLeftFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        if (variable.type !== VariableType.vtNumber && variable.type !== VariableType.vtString) {
            throw new InterpreterException('You can access a property by string or numeric key, given ' + variable.typeName, token.cursorPos);
        }

        if (!(token.nValue instanceof ParseNode))
            throw new InterpreterException('Bracket Set Key Left Finish: nValue must be ParseNode', token.cursorPos);

        if (!token.nValue.childItems)
            throw new InterpreterException('Bracket Set Key Left Finish: nValue childItems is empty', token.cursorPos);

        context.popExecutionStack();

        //выполнение выражения

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nValue.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntBracketSetKeyRightFinish;
        node.nValue = variable;
        context._codeItems.push(node);
    }

    BracketSetKeyRightFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack();

        let accessTo = context.popStackVar();

        if (!(token.nValue instanceof StackVariable))
            throw new InterpreterException('Invalid bracket key', token.cursorPos);

        accessTo.setProperty(token.nValue.value as string, variable);

        context.pushStackVar(variable);
    }

    FuncParamArrayUnpackHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Func Param Array Unpack, childItems not initialized', token.cursorPos)

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntFuncParamArrayUnpackFinish;
        context._codeItems.push(node);
    }

    FuncParamArrayUnpackFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar() as StackVariableArray;

        if (variable.type !== VariableType.vtArray) {
            throw new InterpreterException('variable must be array, given ' + variable.typeName, token.cursorPos);
        }

        context.popExecutionStack();

        Array.from(variable.value.values()).forEach(v => {
            context.pushStackVar(v);
        });
    }

    ArrayPushSeparatorHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Array Push Separator, childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(token.childItems[0]);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushSeparatorFinish;
        node.childItems = token.childItems.splice(1);
        context._codeItems.push(node);
    }

    ArrayPushSeparatorKeyHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Array Push Separator Key, childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushSeparatorKeyFinish;
        context._codeItems.push(node);
    }

    ArrayPushSeparatorKeyFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let arrayKey = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(arrayKey);
    }

    ArrayPushSeparatorFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Array Push Separator Finish, childItems not initialized', token.cursorPos);

        let arrayKey = context.popStackVar();

        if (arrayKey.type !== VariableType.vtNumber && arrayKey.type !== VariableType.vtString) {
            throw new InterpreterException('array key must be number or string', token.cursorPos);
        }

        context.popExecutionStack();

        context.pushStackVar(arrayKey);
        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.childItems);

        let node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushKeyValue;
        context._codeItems.push(node);
    }

    ArrayPushKeyValueHandler(context: ContextInterpreter, token: ParseNode) {
        let arrayValue = context.popStackVar();

        context.popExecutionStack();

        let arrayKey = context.popStackVar();

        if (!context._contextVariable)
            throw new InterpreterException('ArrayPushKeyValue contextVariable not initialized', token.cursorPos);

        context._contextVariable.setProperty(arrayKey.value as string, arrayValue);
    }
}

export const ContextType = {
    'ctNormal': 0,
    'ctAllowBreak': 1,
    'ctReturn': 2,
}

interface ExecutionStackItem {
    variables: Record<string, StackVariable>;
    functions: {};
    codeItems?: ParseNode[];
    type: number;
    pos: number;
    stackVars: StackVariable[];
    contextVariable?: StackVariableArray;
}

export class ContextInterpreter {
    _variables: Record<string, StackVariable>;
    _functions
    _codeItems?: ParseNode[];
    _stackVars: StackVariable[];
    _pos:number;
    _executionStack:ExecutionStackItem[];
    _type
    _interpreter
    _contextVariable?: StackVariableArray; //используется для создания массивов "Array"

    constructor(codeItems: ParseNode[], interpreter: Interpreter) {
        this._variables = {};
        this._functions = {};
        this._stackVars = [];
        this._pos = 0;
        this._executionStack = [];
        this._type = ContextType.ctNormal;
        this._contextVariable = undefined;

        this._codeItems = codeItems;
        this._interpreter = interpreter;
    }

    destroy() {
        this.reset();

        this._variables = (undefined as unknown as typeof this._variables);
        this._functions = (undefined as unknown as typeof this._functions);
        this._codeItems = (undefined as unknown as typeof this._codeItems);
        this._stackVars = (undefined as unknown as typeof this._stackVars);
        this._executionStack = (undefined as unknown as typeof this._executionStack);
        this._interpreter = (undefined as unknown as typeof this._interpreter);
        this._contextVariable = (undefined as unknown as typeof this._contextVariable);
    }

    registerConst() {
        this.setVariable('undefined', new StackVariableUndefined(true));
        this.setVariable('null', new StackVariableNull(true));
        this.setVariable('true', new StackVariableBoolean(true, true));
        this.setVariable('false', new StackVariableBoolean(true, false));
        this.setVariable('NaN', new StackVariableNumber(true, NaN));
        this.setVariable('Infinity', new StackVariableNumber(true, Infinity));
        this.setVariable('Math', new MathFunctions());
        this.setVariable('DateTime', new StackVariableDateTime(undefined));
        this.setVariable('debug', new StackVariableFunction(new FunctionEntry('debug', undefined, (...args: unknown[]) => {
            console.log(...args);
        })))
    }

    pushExecutionStack() {
        this._executionStack.push({
            variables: this._variables,
            functions: this._functions,
            codeItems: this._codeItems,
            type: this._type,
            pos: this._pos,
            stackVars: this._stackVars,
            contextVariable: this._contextVariable,
        });

        this._variables = Object.assign({}, this._variables);
        this._functions = Object.assign({}, this._functions);
        this._stackVars = [];

        this._codeItems = undefined;
        this._pos = 0;
        this._type = ContextType.ctNormal;
    }

    popExecutionStack(saveVariables?: boolean) {
        if (!this._executionStack.length)
            throw new MSLangException('Execution stack is empty');

        const data = this._executionStack.pop();

        if (!data)
        {
            throw new MSLangException('Faield pop execution pop stack');
        }

        if (saveVariables !== true) {
            let tmp = this._variables;

            this._variables = data.variables;

            Object.keys(this._variables).forEach(k => {
                if (this._variables[k].isConst)
                    return;

                if (this._variables[k].type !== tmp[k].type) {
                    this._variables[k] = this.createVariable(tmp[k].type, tmp[k].value);
                } else {
                    this._variables[k].value = tmp[k].value;
                }
            });
        }

        this._functions = data.functions;
        this._codeItems = data.codeItems;
        this._pos = data.pos;
        this._type = data.type;
        this._stackVars = data.stackVars;
        this._contextVariable = data.contextVariable;
    }

    pushStackVar(data: unknown) {
        if (!(data instanceof StackVariable))
            throw Error('non StackVariable');

        this._stackVars.push(data);
    }

    popStackVar() {
        let r = this._stackVars.pop();

        if (r === undefined)
            throw new MSLangException('Stack is empty');

        return r;
    }

    cloneVariable(variable: StackVariable): StackVariable {
        return this.createVariable(variable.type, variable.value);
    }

    getNextInterToken() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        if (this._pos >= this._codeItems.length)
            throw new MSLangException('End of execution code');

        return this._codeItems[this._pos++];
    }

    get whoNextTypeInterToken() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        if (this._pos >= this._codeItems.length)
            return NodeType.ntNotSet;

        return this._codeItems[this._pos].nType;
    }

    get currentToken() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        if (this._pos >= this._codeItems.length)
            return null;

        return this._codeItems[this._pos];
    }

    get eof() {
        if (!this._codeItems)
            throw new MSLangException('codeItems not initialized');

        return this._pos >= this._codeItems.length;
    }

    execOne() {

        let token = this.getNextInterToken(),
            handler = this._interpreter.getCodeHandler(token.nType);

        if (!handler)
            throw new MSLangException('no registered handler for token ' + token.typeName + '(' + token.nType + ')');

        //handler.call(this._interpreter, this, token);
        handler(this, token);
    }

    execStepOver() {
        let executionPos = this._executionStack.length;

        do {
            this.execOne();
        } while (executionPos !== this._executionStack.length)
    }

    execGetVariable() {
        while (true) {
            this.execStepOver();

            let nextToken = this.currentToken;
            if (!nextToken)
                break;

            if ([NodeType.ntExpressionCompare, NodeType.ntCompareOr, NodeType.ntCompareAnd].indexOf(nextToken.nType) >= 0)
                break;

            if (nextToken.isMathNode())
                break;

            if (nextToken instanceof InterpreterNode)
                break;
        }
    }

    exec(returnVal?: boolean) {
        let stackPosition = this._stackVars.length;

        while (!this.eof) {
            this.execOne();
            if (this._type === ContextType.ctReturn)
                break;
        }

        if (returnVal === true) {
            if (this._stackVars.length > stackPosition) {
                return this.popStackVar();
            }

            return this.createVariable(VariableType.vtVoid, undefined);
        } else {
            if (stackPosition !== this._stackVars.length)
                throw new MSLangException('Execution stack corrupted');
        }
    }

    getVariable(name: string): StackVariable|undefined {
        return this._variables[name];
    }

    getVariableRef(name: string) {
        if (!this.getVariable(name))
            return undefined;

        let refValue = (new StackVariableRef({
            get:() => {
                return this.getVariable(name) as object;
            },
            set: (value: unknown) => {

                if (!(value instanceof StackVariable))
                {
                    throw new MSLangException('set variable by ref value must be instance of StackVariable');
                }

                this.setVariable(name, value);
            }
        }));

        return refValue.getProxy();
    }

    setVariable(name:string, value: StackVariable) {
        if (!!this._variables[name] && this._variables[name].isConst)
            throw new MSLangException('Cannot override constant "' + name + '"');

        this._variables[name] = value;
    }

    static createVariable(type: VariableType, value: unknown): StackVariable {
        switch (type) {
            case VariableType.vtInteger:
            case VariableType.vtFloat:
            case VariableType.vtNumber:
                return new StackVariableNumber(false, value);
            case VariableType.vtString:
                return new StackVariableString(false, value as string);
            case VariableType.vtBoolean:
                return new StackVariableBoolean(false, !!value);
            case VariableType.vtArray:
                return new StackVariableArray(false, value);
            case VariableType.vtNull:
                return new StackVariableNull(false);
            case VariableType.vtUndefined:
                return new StackVariableUndefined(false);
            case VariableType.vtVoid:
                return new StackVariable(VariableType.vtVoid);
            case VariableType.vtFunction:
                return new StackVariableFunction(value, null);
            default:
                throw new MSLangException('Unknown variable type ' + type);
        }
    }

    createVariable(type: VariableType, value: unknown) {
        return ContextInterpreter.createVariable(type, value);
    }

    reset() {
        while (this._executionStack.length)
            this.popExecutionStack();

        this._variables = {};
        this._functions = {};
        this._stackVars = [];
        this._pos = 0;
        this._type = ContextType.ctNormal;
        this._executionStack = [];
    }

    callFunction(name: string, parameters: StackVariable[]) {
        let variable = this.getVariable(name);

        if (!variable) {
            throw new MSLangException('global function "' + name + '" not defined');
        }

        if (variable.type !== VariableType.vtFunction) {
            throw new MSLangException('variable "' + name + '" is not function');
        }


        let funcEntry = variable.value;

        if (!(funcEntry instanceof FunctionEntry)) {
            throw new MSLangException('variable type is function, value must be instance of "' + FunctionEntry.name + '"');
        }

        if (funcEntry.getRequiredCount() > parameters.length) {
            throw new MSLangException('Invalid number of arguments for function "' + name + '"');
        }

        let callFuncArgs: (StackVariable|null)[] = [null];
        let index = 0;

        let funcParameters = funcEntry.getParameters();
        let paramCount = Math.max(parameters.length, funcParameters.length);

        for (let index = 0; index < paramCount; index++) {

            if (index < parameters.length) {
                callFuncArgs.push(parameters[index]);
            } else {
                callFuncArgs.push(funcParameters[index].createVariableDefaultValue());
            }
        }

        let returnVal = funcEntry.invokeArguments(callFuncArgs);

        if (!(returnVal instanceof StackVariable)) {
            returnVal = new StackVariableUndefined(false);
        }

        return returnVal;
    }

    selfCallFunction(self: StackVariable, name: string, parameters: StackVariable[]) {
        /** @var self StackVariable  */

        let funcEntry = self.getFunctionEntry(name);

        if (!funcEntry) {
            throw new MSLangException('Unknown function "' + name + '"');
        }

        if (funcEntry.getRequiredCount() > parameters.length) {
            throw new MSLangException('Invalid number of arguments for function "' + name + '"');
        }

        let callFuncArgs = [self];

        let funcParameters = funcEntry.getParameters();
        let paramCount = Math.max(parameters.length, funcParameters.length);

        for (let index = 0; index < paramCount; index++) {
            if (index < parameters.length) {
                callFuncArgs.push(parameters[index]);
            } else {
                callFuncArgs.push(funcParameters[index].createVariableDefaultValue());
            }
        }

        return funcEntry.invokeArguments(callFuncArgs);
    }
}
