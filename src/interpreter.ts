import {CompareType, NodeType, ParseNode} from "./parser";
import {TokenCursor} from "./lexer";
import {VariableType} from "./variabletype";
import {StackVariable} from "./stackvariable";
import {StackVariableNumber} from "./stackvariablenumber";
import {StackVariableString} from "./stackvariablestring";
import {StackVariableBoolean} from "./stackvariableboolean";
import {StackVariableArray} from "./stackvariablearray";
import {StackVariableNull} from "./stackvariablenull";
import {StackVariableUndefined} from "./stackvariableundefined";
import {StackVariableFunction} from "./stackvariablefunction";
import {StackVariableUserFunction} from "./stackvariableuserfunction";
import {StackVariableClass} from "./stackvariableclass";
import {StackVariableTDZ} from "./stackvariabletdz";
import {isBuiltinConstructor} from "./builtinconstructor";
import {InterpreterException, MSLangException} from "./exceptions";
import {StackVariableRef} from "./stackvariableref";
import {StackVariableObject} from "./stackvariableobject";
import {StackVariablePlainObject} from "./stackvariableplainobject";
import {ContextType} from "./contexttype";
import type {ContextInterpreter} from "./contextinterpreter";
import {InterpreterNode} from "./interpreternode";
import {InterpreterNodeType} from "./interpreternodetype";

type TNodeHandler = (context: ContextInterpreter, token: ParseNode) => void;
type NodeHandlerItems = Record<number, TNodeHandler>;

/**
 * Приведение JS-числа к 64-битному целому со знаком — как PHP `(int)` в связке с
 * 64-битным int. Невалидное (NaN/±Infinity) → 0n (зеркало PHP (int)NAN/(int)INF=0).
 * Нужно для 64-битных битовых операций: нативные JS-битовые усекают к 32 битам.
 */
function toInt64(v: number): bigint {
    return Number.isFinite(v) ? BigInt.asIntN(64, BigInt(Math.trunc(v))) : 0n;
}

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
        this.registerNodeHandler(NodeType.ntAssign, this.assignHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntAssignFinish, this.assignFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntExpressionAssign, this.expressionAssignHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntExpressionAssignFinish, this.expressionAssignFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntCompoundAssign, this.compoundAssignHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntCompoundAssignFinish, this.compoundAssignFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntTernary, this.ternaryHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntTernaryFinish, this.ternaryFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntForOf, this.forOfHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntForOfStart, this.forOfStartHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntForOfTick, this.forOfTickHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntArrayCallbackTick, this.arrayCallbackTickHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntArrayCallbackCollect, this.arrayCallbackCollectHandler.bind(this));

        this.registerNodeHandler(NodeType.ntNumeric, this.numericHandler.bind(this));
        this.registerNodeHandler(NodeType.ntFloat, this.floatHandler.bind(this));
        this.registerNodeHandler(NodeType.ntString, this.stringHandler.bind(this));

        this.registerNodeHandler(NodeType.ntPlus, this.plusHandler.bind(this));
        this.registerNodeHandler(NodeType.ntMinus, this.minusHandler.bind(this));
        this.registerNodeHandler(NodeType.ntMul, this.mulHandler.bind(this));
        this.registerNodeHandler(NodeType.ntDiv, this.divHandler.bind(this));
        this.registerNodeHandler(NodeType.ntMod, this.modHandler.bind(this));
        this.registerNodeHandler(NodeType.ntBitAnd, this.bitAndHandler.bind(this));
        this.registerNodeHandler(NodeType.ntBitOr, this.bitOrHandler.bind(this));
        this.registerNodeHandler(NodeType.ntBitXor, this.bitXorHandler.bind(this));
        this.registerNodeHandler(NodeType.ntShiftLeft, this.shiftLeftHandler.bind(this));
        this.registerNodeHandler(NodeType.ntShiftRight, this.shiftRightHandler.bind(this));
        this.registerNodeHandler(NodeType.ntUShiftRight, this.uShiftRightHandler.bind(this));

        this.registerNodeHandler(NodeType.ntShortIncrement, this.shortIncrementHandler.bind(this));
        this.registerNodeHandler(NodeType.ntShortDecrement, this.shortDecrementHandler.bind(this));

        this.registerNodeHandler(NodeType.ntSubExpression, this.subExpressionHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntSubExpressionFinish, this.subExpressionFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntFuncCall, this.funcCallHandler.bind(this));

        this.registerNodeHandler(NodeType.ntFuncNameSpaceCall, this.funcCallHandler.bind(this));
        this.registerNodeHandler(NodeType.ntFuncParam, this.funcParamHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntFuncParamFinish, this.funcParamFinishHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntFuncCallFinish, this.funcCallFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntSelfFuncCall, this.selfFuncCallHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntSelfFuncCallFinish, this.selfFuncCallFinishHandler.bind(this));


        this.registerNodeHandler(NodeType.ntShiftSP, this.shiftSPHandler.bind(this));

        this.registerNodeHandler(NodeType.ntObjSetPropValue, this.objSetPropValueHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntObjSetPropValueFinish, this.objSetPropValueFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntObject, this.ObjectHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntObjectFinish, this.ObjectFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntObjectEntry, this.ObjectEntryHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntObjectEntryFinish, this.ObjectEntryFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntArrayPushArrayUnpack, this.arrayPushArrayUnpackHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntArrayPushArrayUnpackFinish, this.arrayPushArrayUnpackFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntObjProp, this.objPropHandler.bind(this));

        this.registerNodeHandler(NodeType.ntContextVariable, this.contextVariableHandler.bind(this));

        this.registerNodeHandler(NodeType.ntIF, this.ifHandler.bind(this));
        this.registerNodeHandler(NodeType.ntIFValue, this.ifValueHandler.bind(this));
        this.registerNodeHandler(NodeType.ntIFValueBOOL, this.ifValueBOOLHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntIFValueFinish, this.ifValueFinishHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntIFValueBOOLFinish, this.ifValueBOOLFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntExpressionCompare, this.expressionCompareHandler.bind(this));

        this.registerNodeHandler(NodeType.ntCompare, this.ifCompareHandler.bind(this));
        this.registerNodeHandler(NodeType.ntCompareOr, this.ifCompareOrHandler.bind(this));
        this.registerNodeHandler(NodeType.ntCompareAnd, this.ifCompareAndHandler.bind(this));

        this.registerNodeHandler(NodeType.ntNegativeIf, this.negativeIfHandler.bind(this));
        this.registerNodeHandler(NodeType.ntTypeof, this.typeofHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntIFFinish, this.ifFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntSubCode, this.subCodeHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntSubCodeFinish, this.subCodeFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntELSE, this.elseHandler.bind(this));

        this.registerNodeHandler(NodeType.ntFor, this.forHandler.bind(this));
        this.registerNodeHandler(NodeType.ntForCompare, this.forCompareHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntForCompareFinish, this.forCompareFinishHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntForLoop, this.forLoopHandler.bind(this));

        this.registerNodeHandler(NodeType.ntWhile, this.whileHandler.bind(this));

        this.registerNodeHandler(NodeType.ntReturn, this.returnHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntReturnFinish, this.returnFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntContinue, this.continueHandler.bind(this));

        this.registerNodeHandler(NodeType.ntBreak, this.breakHandler.bind(this));

        this.registerNodeHandler(NodeType.ntSwitch, this.switchHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntSwitchEvaluated, this.switchEvaluatedHandler.bind(this));

        this.registerNodeHandler(NodeType.ntFunctionDef, this.functionDefHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntUserFuncFinish, this.userFuncFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntTry, this.tryHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntTryFinish, this.tryFinishHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntFinallyFinish, this.finallyFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntThrow, this.throwHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntThrowFinish, this.throwFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntNew, this.newHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntNewFinish, this.newFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntClassDecl, this.classDeclHandler.bind(this));
        this.registerNodeHandler(NodeType.ntThis, this.thisHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntCtorReturnInstance, this.ctorReturnInstanceHandler.bind(this));

        this.registerNodeHandler(NodeType.ntSuperCall, this.superCallHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntSuperCallFinish, this.superCallFinishHandler.bind(this));
        this.registerNodeHandler(NodeType.ntSuperMethodCall, this.superMethodCallHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntSuperMethodCallFinish, this.superMethodCallFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntInstanceof, this.instanceofHandler.bind(this));

        this.registerNodeHandler(NodeType.ntVarDecl, this.varDeclHandler.bind(this));
        this.registerNodeHandler(InterpreterNodeType.ntVarDeclFinish, this.varDeclFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntArray, this.ArrayHandler.bind(this));

        this.registerNodeHandler(NodeType.ntArrayPush, this.ArrayPushHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushFinish, this.ArrayPushFinishHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntArrayFinish, this.ArrayFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntBracketGetKey, this.BracketGetKeyHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntBracketGetKeyFinish, this.BracketGetKeyFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntBracketSetKey, this.BracketSetKeyHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntBracketSetKeyLeftFinish, this.BracketSetKeyLeftFinishHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntBracketSetKeyRightFinish, this.BracketSetKeyRightFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntFuncParamArrayUnpack, this.FuncParamArrayUnpackHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntFuncParamArrayUnpackFinish, this.FuncParamArrayUnpackFinishHandler.bind(this));

        this.registerNodeHandler(NodeType.ntArrayPushSeparator, this.ArrayPushSeparatorHandler.bind(this));

        this.registerNodeHandler(NodeType.ntArrayPushSeparatorKey, this.ArrayPushSeparatorKeyHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushSeparatorKeyFinish, this.ArrayPushSeparatorKeyFinishHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushSeparatorFinish, this.ArrayPushSeparatorFinishHandler.bind(this));

        this.registerNodeHandler(InterpreterNodeType.ntArrayPushKeyValue, this.ArrayPushKeyValueHandler.bind(this));
    }

    assignHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('assign is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntAssignFinish;
        node.nValue = token.nValue;
        context._codeItems.push(node);

        //console.log(util.inspect(token, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    assignFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();
        context.popExecutionStack(true);

        if (typeof token.nValue !== 'string')
            throw new InterpreterException('variable name must be string', token.cursorPos);

        // Через cloneVariable, чтобы корректно работали vtObject (DateTime/Math/хост)
        // и StackVariableRef — иначе обращение к variable._value напрямую теряет состояние.
        context.setVariable(token.nValue, context.cloneVariable(variable));
    }

    expressionAssignHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('assign is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntExpressionAssignFinish;
        node.nValue = token.nValue;
        context._codeItems.push(node);

        //console.log(util.inspect(token, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    compoundAssignHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems || token.childItems.length === 0)
            throw new InterpreterException('compound-assign is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntCompoundAssignFinish;
        node.nValue = token.nValue;
        node.nValue2 = token.nValue2;
        context._codeItems.push(node);
    }

    compoundAssignFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let rightVar: StackVariable = context.popStackVar();
        context.popExecutionStack(true);

        if (rightVar instanceof StackVariableRef) {
            rightVar = rightVar.refValue as StackVariable;
        }

        const name = String(token.nValue);
        const op = String(token.nValue2);

        let current = context.getVariable(name);
        if (current === null || current === undefined) {
            throw new InterpreterException('Compound-assign on undefined variable "' + name + '"', token.cursorPos);
        }
        if (current instanceof StackVariableRef) {
            current = current.refValue as StackVariable;
        }

        let newVar: StackVariable;
        if (op === '+'
            && (current.type === VariableType.vtString || rightVar.type === VariableType.vtString)
        ) {
            const lt = current.castAs(VariableType.vtString);
            const rt = rightVar.castAs(VariableType.vtString);
            if (!lt || !rt) throw new InterpreterException('Failed cast to string in +=', token.cursorPos);
            newVar = context.createVariable(VariableType.vtString, String(lt.value) + String(rt.value));
        } else {
            const lt = current.castAs(VariableType.vtNumber);
            if (!lt) throw new InterpreterException('Failed ' + current.typeName + ' cast as number', token.cursorPos);
            const rt = rightVar.castAs(VariableType.vtNumber);
            if (!rt) throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

            const l = lt.value as number;
            const r = rt.value as number;
            let value: number;
            switch (op) {
                case '+': value = l + r; break;
                case '-': value = l - r; break;
                case '*': value = l * r; break;
                case '/':
                    if (r === 0) throw new InterpreterException('Division by zero', token.cursorPos);
                    value = l / r; break;
                case '%':
                    if (r === 0) throw new InterpreterException('Modulo by zero', token.cursorPos);
                    value = l % r; break;
                default: throw new InterpreterException('Unknown compound-assign op ' + op, token.cursorPos);
            }
            newVar = context.createVariable(VariableType.vtNumber, value);
        }

        context.setVariable(name, newVar);
        context.pushStackVar(newVar);
    }

    ternaryHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems || token.childItems.length !== 3)
            throw new InterpreterException('ternary must have 3 children (cond, then, else)', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        const cond = token.childItems[0];
        if (!(cond instanceof ParseNode))
            throw new InterpreterException('ternary cond invalid', token.cursorPos);
        context._codeItems.push(cond);

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntTernaryFinish;
        finish.childItems = [token.childItems[1] as ParseNode, token.childItems[2] as ParseNode];
        context._codeItems.push(finish);
    }

    ternaryFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const cond: StackVariable = context.popStackVar();

        //Выбор ветки — через единую точку истинности (JS): []?a:b → a, NaN?a:b → b.
        const branches = token.childItems!;
        const chosen = Interpreter.isTruthy(cond) ? branches[0] : branches[1];
        if (!(chosen instanceof ParseNode))
            throw new InterpreterException('ternary branch invalid', token.cursorPos);

        context.popExecutionStack(true);

        //Запускаем выбранную ветку в новом подкадре, чтобы её результат
        //единым значением попал в parent через popStackVar.
        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...chosen.nodeChildren());

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntSubExpressionFinish;
        context._codeItems.push(finish);
    }

    forOfHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems || token.childItems.length !== 2)
            throw new InterpreterException('for-of must have iterable and body', token.cursorPos);

        context.pushExecutionStack();
        context._type = ContextType.ctAllowBreak;
        context._codeItems = [];

        const iterable = token.childItems[0];
        if (!(iterable instanceof ParseNode))
            throw new InterpreterException('for-of: invalid iterable node', token.cursorPos);
        context._codeItems.push(iterable);

        const start = new InterpreterNode(token.cursorPos);
        start.nType = InterpreterNodeType.ntForOfStart;
        start.nValue = token.nValue;
        start.nValue2 = token.nValue2;
        start.childItems = [token.childItems[1] as ParseNode];
        context._codeItems.push(start);
    }

    forOfStartHandler(context: ContextInterpreter, token: ParseNode) {
        let iter: StackVariable = context.popStackVar();
        if (iter instanceof StackVariableRef) iter = iter.refValue as StackVariable;
        if (iter.type !== VariableType.vtArray)
            throw new InterpreterException('for-of: iterable must be an array', token.cursorPos);

        context._codeData['__forof_iter'] = iter;
        context._codeData['__forof_idx'] = 0;
        context._codeData['__forof_var'] = String(token.nValue);
        context._codeData['__forof_kind'] = String(token.nValue2);
        context._codeData['__forof_body'] = (token.childItems as ParseNode[])[0];

        const tick = new InterpreterNode(token.cursorPos);
        tick.nType = InterpreterNodeType.ntForOfTick;
        context._codeItems!.push(tick);
    }

    forOfTickHandler(context: ContextInterpreter, token: ParseNode) {
        const iter = context._codeData['__forof_iter'] as StackVariable;
        const idx  = context._codeData['__forof_idx'] as number;
        const vName = context._codeData['__forof_var'] as string;
        const body = context._codeData['__forof_body'] as ParseNode;

        const arr = Array.from((iter.value as Map<string, StackVariable>).values());
        if (idx >= arr.length) {
            context.popExecutionStack();
            return;
        }

        const elem = arr[idx];
        if (!(elem instanceof StackVariable))
            throw new InterpreterException('for-of: element is not a StackVariable', token.cursorPos);

        context._variables[vName] = elem;
        context._letNames[vName] = true;

        context._codeData['__forof_idx'] = idx + 1;

        context._codeItems!.push(body);
        const tickIdx = context._codeItems!.length;
        const tickNext = new InterpreterNode(token.cursorPos);
        tickNext.nType = InterpreterNodeType.ntForOfTick;
        context._codeItems!.push(tickNext);
        context._codeData['continue'] = tickIdx;
    }

    /** Имена массивных методов высшего порядка → внутренний код операции. */
    static readonly ARRAY_CALLBACK_METHODS: Record<string, string> = {
        'map': 'map', 'filter': 'filter', 'reduce': 'reduce', 'foreach': 'foreach',
        'find': 'find', 'findindex': 'findindex', 'some': 'some', 'every': 'every',
    };

    /**
     * Запускает массивный метод с колбэком. Заводит отдельный кадр цикла (его _codeData
     * переживёт вызовы колбэка — pushFunctionScope сохраняет _codeData), кладёт состояние
     * и ставит первый tick. Итог кладётся на стек в финальном tick.
     */
    private startArrayCallback(context: ContextInterpreter, array: StackVariableArray, op: string, parameters: StackVariable[], token: ParseNode): void {
        let callback: unknown = parameters[0];
        if (callback instanceof StackVariableRef) {
            callback = callback.refValue;
        }
        if (!(callback instanceof StackVariableUserFunction)) {
            throw new InterpreterException(op.charAt(0).toUpperCase() + op.slice(1) + ' callback is not a function', token.cursorPos);
        }

        const elements = Array.from((array.value as Map<string, StackVariable>).values());

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeData['__cb_op'] = op;
        context._codeData['__cb_fn'] = callback;
        context._codeData['__cb_elems'] = elements;
        context._codeData['__cb_self'] = array;
        context._codeData['__cb_idx'] = 0;
        context._codeData['__cb_results'] = [];

        if (op === 'reduce') {
            if (parameters.length >= 2) {
                let acc: unknown = parameters[1];
                if (acc instanceof StackVariableRef) {
                    acc = acc.refValue;
                }
                context._codeData['__cb_acc'] = acc;
            } else if (elements.length === 0) {
                throw new InterpreterException('Reduce of empty array with no initial value', token.cursorPos);
            } else {
                context._codeData['__cb_acc'] = elements[0];
                context._codeData['__cb_idx'] = 1;
            }
        }

        const tick = new InterpreterNode(token.cursorPos);
        tick.nType = InterpreterNodeType.ntArrayCallbackTick;
        context._codeItems!.push(tick);
    }

    arrayCallbackTickHandler(context: ContextInterpreter, token: ParseNode): void {
        const op = context._codeData['__cb_op'] as string;
        const elements = context._codeData['__cb_elems'] as StackVariable[];
        const idx = context._codeData['__cb_idx'] as number;

        if (idx >= elements.length) {
            const result = this.buildArrayCallbackResult(context, op);
            context.popExecutionStack();
            context.pushStackVar(result);
            return;
        }

        const fn = context._codeData['__cb_fn'] as StackVariableUserFunction;
        const elem = elements[idx];
        const array = context._codeData['__cb_self'] as StackVariableArray;

        //Аргументы как в JS. reduce: (acc, elem, idx, array); прочие: (elem, idx, array).
        const indexVar = context.createVariable(VariableType.vtNumber, idx);
        let args: StackVariable[];
        if (op === 'reduce') {
            args = [context._codeData['__cb_acc'] as StackVariable, elem, indexVar, array];
        } else {
            args = [elem, indexVar, array];
        }
        args = this.trimCallbackArgs(fn, args);

        //Collect ставим ДО запуска колбэка: pushFunctionScope сохранит этот кадр, а после
        //возврата колбэка кадр восстановится и collect отработает.
        const collect = new InterpreterNode(token.cursorPos);
        collect.nType = InterpreterNodeType.ntArrayCallbackCollect;
        context._codeItems!.push(collect);

        this.invokeUserFunction(context, fn, args, token);
    }

    arrayCallbackCollectHandler(context: ContextInterpreter, token: ParseNode): void {
        const op = context._codeData['__cb_op'] as string;
        const idx = context._codeData['__cb_idx'] as number;
        const elements = context._codeData['__cb_elems'] as StackVariable[];

        let result: StackVariable = context.popStackVar();
        if (result instanceof StackVariableRef) {
            result = result.refValue as StackVariable;
        }

        const truthy = Interpreter.isTruthy(result);

        switch (op) {
            case 'map':
                (context._codeData['__cb_results'] as StackVariable[]).push(result);
                break;
            case 'filter':
                if (truthy) {
                    (context._codeData['__cb_results'] as StackVariable[]).push(elements[idx]);
                }
                break;
            case 'reduce':
                context._codeData['__cb_acc'] = result;
                break;
            case 'foreach':
                break;
            case 'find':
                if (truthy) {
                    const found = elements[idx];
                    context.popExecutionStack();
                    context.pushStackVar(found);
                    return;
                }
                break;
            case 'findindex':
                if (truthy) {
                    context.popExecutionStack();
                    context.pushStackVar(context.createVariable(VariableType.vtNumber, idx));
                    return;
                }
                break;
            case 'some':
                if (truthy) {
                    context.popExecutionStack();
                    context.pushStackVar(context.createVariable(VariableType.vtBoolean, true));
                    return;
                }
                break;
            case 'every':
                if (!truthy) {
                    context.popExecutionStack();
                    context.pushStackVar(context.createVariable(VariableType.vtBoolean, false));
                    return;
                }
                break;
        }

        context._codeData['__cb_idx'] = idx + 1;

        const tick = new InterpreterNode(token.cursorPos);
        tick.nType = InterpreterNodeType.ntArrayCallbackTick;
        context._codeItems!.push(tick);
    }

    /** Итог метода, когда массив пройден до конца без короткого замыкания. */
    private buildArrayCallbackResult(context: ContextInterpreter, op: string): StackVariable {
        switch (op) {
            case 'map':
            case 'filter':
                return new StackVariableArray(false, context._codeData['__cb_results'] as StackVariable[], context);
            case 'reduce':
                return context._codeData['__cb_acc'] as StackVariable;
            case 'findindex':
                return context.createVariable(VariableType.vtNumber, -1);
            case 'some':
                return context.createVariable(VariableType.vtBoolean, false);
            case 'every':
                return context.createVariable(VariableType.vtBoolean, true);
            default:
                //find и forEach без результата → undefined.
                return context.createVariable(VariableType.vtUndefined, undefined);
        }
    }

    /**
     * Оставляет столько аргументов колбэка, сколько он объявил параметров (если нет rest),
     * чтобы не плодить предупреждения о лишних аргументах. Колбэк всё равно видит только
     * объявленные параметры (объекта arguments нет).
     */
    private trimCallbackArgs(fn: StackVariableUserFunction, args: StackVariable[]): StackVariable[] {
        const params = fn.params;
        for (const param of params) {
            if ((param.nValue2 ?? null) === 'rest') {
                return args;
            }
        }
        return args.slice(0, params.length);
    }

    expressionAssignFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        context.popExecutionStack(true);

        //Развёртка Ref: если value — Ref на let/const-локалку или параметр
        //вложенного блока, после pop этой области переменная исчезнет и Ref
        //начнёт выдавать undefined. cloneVariable для vtObject возвращает сам
        //объект без разворота, поэтому Ref пропустился бы дальше и сидел в
        //долгоживущей переменной до тех пор, пока кто-нибудь не прочитает.
        if (variable instanceof StackVariableRef) {
            variable = variable.refValue as StackVariable;
        }

        const cloneVariable = context.cloneVariable(variable);

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
        const variable = context.createVariable(VariableType.vtInteger, token.nValue);

        context.pushStackVar(variable);
    }

    floatHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.createVariable(VariableType.vtFloat, token.nValue);

        context.pushStackVar(variable);
    }

    stringHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.createVariable(VariableType.vtString, token.nValue);

        context.pushStackVar(variable);
    }

    plusHandler(context: ContextInterpreter, token: ParseNode) {
        // Зеркало PHP applyStringOrNumericBinaryOperator для оператора '+'.
        // 1) Унарный '+': берём правый, приводим к числу.
        // 2) Если хоть один операнд — строка, кастуем оба к строке и склеиваем.
        // 3) Иначе делаем toPrimitive у обоих.
        // 4) Если после этого хоть один — строка, склейка.
        // 5) Иначе арифметическое сложение через приведение к числу.
        context.execGetVariable();

        let rightVar = context.popStackVar();

        if (!context._stackVars.length) {
            const rightTmp = rightVar.castAs(VariableType.vtNumber);
            if (!rightTmp)
                throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

            context.pushStackVar(context.createVariable(VariableType.vtNumber, rightTmp.value));
            return;
        }

        let leftVar = context.popStackVar();

        // снимаем возможные ссылки, кастуя в собственный тип
        leftVar = leftVar.castAs(leftVar.type) ?? leftVar;
        rightVar = rightVar.castAs(rightVar.type) ?? rightVar;

        // если хоть одна сторона — строка, сразу кастуем оба к строке
        if (leftVar.type === VariableType.vtString || rightVar.type === VariableType.vtString) {
            leftVar = leftVar.castAs(VariableType.vtString) ?? leftVar;
            rightVar = rightVar.castAs(VariableType.vtString) ?? rightVar;
        }

        // приводим к примитиву (массивы → строка, объекты → строка, и т.п.)
        leftVar = leftVar.toPrimitive();
        rightVar = rightVar.toPrimitive();

        // после toPrimitive ещё раз проверяем — мог появиться строковый операнд
        if (leftVar.type === VariableType.vtString || rightVar.type === VariableType.vtString) {
            const leftStr = leftVar.castAs(VariableType.vtString);
            if (!leftStr)
                throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as string', token.cursorPos);

            const rightStr = rightVar.castAs(VariableType.vtString);
            if (!rightStr)
                throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as string', token.cursorPos);

            context.pushStackVar(context.createVariable(VariableType.vtString, (leftStr.value as string) + (rightStr.value as string)));
            return;
        }

        // оба операнда — не строки, считаем как числа. После toPrimitive они
        // уже Number (boolean/null в toPrimitive дают Number), поэтому проверяем
        // isNumeric и берём value напрямую — зеркало PHP (бросает 'Type error').
        if (!leftVar.isNumeric || !rightVar.isNumeric)
            throw new InterpreterException('Type error', token.cursorPos);

        context.pushStackVar(context.createVariable(VariableType.vtNumber, (leftVar.value as number) + (rightVar.value as number)));
    }

    minusHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        const rightVar = context.popStackVar();
        const rightVarTmp = rightVar.castAs(VariableType.vtNumber);
        let variable;

        if (!rightVarTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        if (!context._stackVars.length) {
            variable = context.createVariable(VariableType.vtNumber, -rightVarTmp.value);
            context.pushStackVar(variable);
            return;
        }

        const leftVar = context.popStackVar(),
            leftVarTmp = leftVar.castAs(VariableType.vtNumber);

        if (!leftVarTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        variable = context.createVariable(VariableType.vtNumber, leftVarTmp.value - rightVarTmp.value);

        context.pushStackVar(variable);
    }

    mulHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        const rightVar = context.popStackVar();
        const leftVar = context.popStackVar();

        const leftTmp = leftVar.castAs(VariableType.vtNumber);
        if (!leftTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        const rightTmp = rightVar.castAs(VariableType.vtNumber);
        if (!rightTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        const variable = context.createVariable(VariableType.vtNumber, leftTmp.value * rightTmp.value);

        context.pushStackVar(variable);
    }

    divHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        const rightVar = context.popStackVar();
        const leftVar = context.popStackVar();

        const leftTmp = leftVar.castAs(VariableType.vtNumber);
        if (!leftTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        const rightTmp = rightVar.castAs(VariableType.vtNumber);
        if (!rightTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        const variable = context.createVariable(VariableType.vtNumber, leftTmp.value / rightTmp.value);

        context.pushStackVar(variable);
    }

    modHandler(context: ContextInterpreter, token: ParseNode) {
        context.execGetVariable();

        const rightVar = context.popStackVar(),
            leftVar = context.popStackVar();

        const leftTmp = leftVar.castAs(VariableType.vtNumber);
        if (!leftTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        const rightTmp = rightVar.castAs(VariableType.vtNumber);
        if (!rightTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        const variable = context.createVariable(VariableType.vtNumber, (leftTmp.value as number) % (rightTmp.value as number));

        context.pushStackVar(variable);
    }

    //Битовые операции 64-битные (зеркало PHP, где int 64-битный), а не 32-битные
    //как нативные JS-битовые. Считаем через BigInt и сворачиваем в 64-битное знаковое.
    //Сдвиги маскируют правый операнд по модулю 32 (JS-семантика), uShiftRight даёт
    //беззнаковое 32-битное представление. Результат >2^53 теряет точность при
    //возврате в number — это предел модели (для типичных значений безопасно).
    bitAndHandler(context: ContextInterpreter, token: ParseNode) {
        this.bitwiseBinaryHandler(context, token, (a, b) => Number(BigInt.asIntN(64, toInt64(a) & toInt64(b))));
    }

    bitOrHandler(context: ContextInterpreter, token: ParseNode) {
        this.bitwiseBinaryHandler(context, token, (a, b) => Number(BigInt.asIntN(64, toInt64(a) | toInt64(b))));
    }

    bitXorHandler(context: ContextInterpreter, token: ParseNode) {
        this.bitwiseBinaryHandler(context, token, (a, b) => Number(BigInt.asIntN(64, toInt64(a) ^ toInt64(b))));
    }

    shiftLeftHandler(context: ContextInterpreter, token: ParseNode) {
        this.bitwiseBinaryHandler(context, token, (a, b) => Number(BigInt.asIntN(64, toInt64(a) << (toInt64(b) & 31n))));
    }

    shiftRightHandler(context: ContextInterpreter, token: ParseNode) {
        this.bitwiseBinaryHandler(context, token, (a, b) => Number(BigInt.asIntN(64, toInt64(a) >> (toInt64(b) & 31n))));
    }

    uShiftRightHandler(context: ContextInterpreter, token: ParseNode) {
        this.bitwiseBinaryHandler(context, token, (a, b) => Number(((toInt64(a) & 0xFFFFFFFFn) >> (toInt64(b) & 31n)) & 0xFFFFFFFFn));
    }

    /**
     * Общий шаблон битовых бинарных операторов: достаёт два операнда со
     * стека, кастит их к числу, проверяет тип, применяет op и возвращает
     * результат. Точечный фикс операции делается в передаваемом замыкании.
     */
    private bitwiseBinaryHandler(context: ContextInterpreter, token: ParseNode, op: (a: number, b: number) => number) {
        context.execGetVariable();

        const rightVar = context.popStackVar(),
            leftVar = context.popStackVar();

        const leftTmp = leftVar.castAs(VariableType.vtNumber);
        if (!leftTmp)
            throw new InterpreterException('Failed ' + leftVar.typeName + ' cast as number', token.cursorPos);

        const rightTmp = rightVar.castAs(VariableType.vtNumber);
        if (!rightTmp)
            throw new InterpreterException('Failed ' + rightVar.typeName + ' cast as number', token.cursorPos);

        const result = op(leftTmp.value as number, rightTmp.value as number);
        const variable = context.createVariable(VariableType.vtNumber, result);

        context.pushStackVar(variable);
    }

    shortIncrementHandler(context: ContextInterpreter, token: ParseNode) {
        if (context._stackVars.length) {
            const variable = context.popStackVar(),
                variableAsNumber = variable.castAs(VariableType.vtNumber);

            if (!variableAsNumber) {
                throw new InterpreterException('Failed cast ' + variable.typeName + ' as number', token.cursorPos);
            }

            const newVariable = context.createVariable(VariableType.vtNumber, variableAsNumber.value);
            context.pushStackVar(newVariable);

            if (variable instanceof StackVariableRef) {
                variable.refValue = context.createVariable(VariableType.vtNumber, variableAsNumber.value + 1);
            } else {
                //example string.length++;
                //throw new InterpreterException('Variable must be reference', token.cursorPos);
            }
        } else {
            context.execGetVariable();

            const variable = context.popStackVar(),
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
            const variable = context.popStackVar(),
                variableAsNumber = variable.castAs(VariableType.vtNumber);

            if (!variableAsNumber) {
                throw new InterpreterException('Failed cast ' + variable.typeName + ' as number', token.cursorPos);
            }

            const newVariable = context.createVariable(VariableType.vtNumber, variableAsNumber.value);
            context.pushStackVar(newVariable);

            if (variable instanceof StackVariableRef) {
                variable.refValue = context.createVariable(VariableType.vtNumber, variableAsNumber.value - 1);
            } else {
                //example string.length--;
                //throw new InterpreterException('Variable must be reference', token.cursorPos);
            }
        } else {
            context.execGetVariable();

            const variable = context.popStackVar(),
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
        if (!token.childItems)
            throw new InterpreterException('Sub expression is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntSubExpressionFinish;
        context._codeItems.push(node);
    }

    subExpressionFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    funcCallHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('funcCall is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntFuncCallFinish;
        node.nValue = token;
        node.nValue2 = context._stackVars.length; //stack position
        context._codeItems.push(node);
    }

    funcParamHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('funcParam is empty', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntFuncParamFinish;
        context._codeItems.push(node);
    }

    funcParamFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    funcCallFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue2 !== 'number' || !Number.isInteger(token.nValue2))
            throw new InterpreterException('Invalid drop stack length', token.cursorPos);

        let paramCount = context._stackVars.length - token.nValue2;

        const parameters = [];

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

        //Если функция объявлена пользователем в скрипте — идём по новому пути:
        //открываем scope, биндим параметры, ставим тело в _codeItems.
        //Иначе — стандартный синхронный вызов хост-функции через callFunction.
        if (!token.nValue.nValue2) {
            let userFunc: StackVariable | undefined = context.getVariable(funcName);
            if (!(userFunc instanceof StackVariableUserFunction)) {
                //Fallback на корневую область: top-level функции видны из любого
                //вложенного scope (нужно для взаимной рекурсии).
                userFunc = context.getGlobalVariable(funcName);
            }
            if (userFunc instanceof StackVariableUserFunction) {
                this.invokeUserFunction(context, userFunc, parameters as StackVariable[], token);
                return;
            }
        }

        context.pushStackVar(context.callFunction(funcName, parameters));
    }

    selfFuncCallHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('selfFuncCall is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntSelfFuncCallFinish;
        node.nValue = token;
        node.nValue2 = context._stackVars.length; //stack position
        context._codeItems.push(node);
    }

    selfFuncCallFinishHandler(context: ContextInterpreter, token: ParseNode) {
        //let paramCount = context._stackVars.length - token.nValue2;
        let paramCount = context._stackVars.length;

        const parameters = [];

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

        const self = context.popStackVar();

        //Развернём Ref, иначе self — это обёртка вокруг переменной, и проверка
        //instanceof StackVariableObject не сработает (а instance прячется внутри).
        let selfResolved: StackVariable = self;
        if (selfResolved instanceof StackVariableRef) {
            selfResolved = selfResolved.refValue as StackVariable;
        }

        //Массивные методы высшего порядка (map/filter/reduce/forEach/find/findIndex/some/
        //every): колбэк надо выполнить через стековую машину — отдельная ветка ДО обычного
        //funcInvoke-диспетчера. См. startArrayCallback.
        if (selfResolved instanceof StackVariableArray) {
            const op = Interpreter.ARRAY_CALLBACK_METHODS[funcName.toLowerCase()];
            if (op !== undefined) {
                this.startArrayCallback(context, selfResolved, op, parameters as StackVariable[], token);
                return;
            }
        }

        //Метод пользовательского класса: если у self есть класс и в нём
        //(или в его родителе) объявлен метод с этим именем — вызываем его
        //как UserFunction с this = self.
        if (selfResolved instanceof StackVariableObject) {
            const cls = selfResolved.getClass();
            if (cls !== null) {
                //Поиск метода идёт по цепочке наследования; нужно найти, КЕМ
                //именно объявлен этот метод — чтобы super(...) внутри метода
                //смотрел на правильного родителя (не на класс instance).
                let methodOwner: StackVariableClass | null = cls;
                let method: StackVariableUserFunction | null = null;
                while (methodOwner !== null) {
                    method = methodOwner.getOwnMethod(funcName);
                    if (method !== null) {
                        break;
                    }
                    methodOwner = methodOwner.getParent(context);
                }
                if (method !== null && methodOwner !== null) {
                    this.invokeUserFunction(context, method, parameters, token, selfResolved, methodOwner, false);
                    return;
                }
            }

            //Свойство-функция (старый JS-стиль: this.greet = function() { ... }).
            //Используется в function-конструкторах — методы цепляются прямо
            //к instance. Если совпадает с именем вызова — выполняем её как
            //метод с this = self.
            let prop: StackVariable | undefined = selfResolved.getProperty(funcName) as StackVariable | undefined;
            if (prop instanceof StackVariableRef) {
                prop = prop.refValue as StackVariable;
            }
            if (prop instanceof StackVariableUserFunction) {
                this.invokeUserFunction(context, prop, parameters, token, selfResolved, null, false);
                return;
            }
        }

        //Fallback на хост-функции через FunctionEntry (Math.abs, [1,2,3].push и т.п.).
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

    arrayPushArrayUnpackHandler(context: ContextInterpreter, token: ParseNode) {
        // Распаковка массива в литерал-массив: [1, ...a, 4]
        if (!token.childItems)
            throw new InterpreterException('arrayPushArrayUnpack childItems not initialized', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushArrayUnpackFinish;
        context._codeItems.push(node);
    }

    arrayPushArrayUnpackFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        if (variable.type !== VariableType.vtArray)
            throw new InterpreterException('variable must be array, given ' + variable.typeName, token.cursorPos);

        context.popExecutionStack();

        if (!(context._contextVariable instanceof StackVariableArray))
            throw new InterpreterException('context variable expected array', token.cursorPos);

        (variable.value as Map<string, StackVariable>).forEach(v => {
            (context._contextVariable as StackVariableArray).funcInvoke_push(context.cloneVariable(v));
        });
    }

    objSetPropValueHandler(context: ContextInterpreter, token: ParseNode) {
        // obj.prop = value. На стеке уже лежит obj (из ntObjProp слева),
        // имя свойства — в token.nValue, выражение справа — в childItems.
        if (!token.childItems)
            throw new InterpreterException('objSetPropValue childItems not initialized', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntObjSetPropValueFinish;
        node.nValue = token.nValue;
        context._codeItems.push(node);
    }

    objSetPropValueFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();
        context.popExecutionStack();

        let obj = context.popStackVar();

        //Развёртка Ref на обеих сторонах: если obj пришёл как ссылка на переменную
        //(p.x = ..., где p — обычная переменная типа object), это `p` через Ref;
        //если value пришло как Ref на локальную переменную — после popFunctionScope
        //эта переменная исчезнет, поэтому фиксируем её значение прямо сейчас.
        if (obj instanceof StackVariableRef) {
            obj = obj.refValue as StackVariable;
        }
        if (variable instanceof StackVariableRef) {
            variable = variable.refValue as StackVariable;
        }

        obj.setProperty(token.nValue as string, variable);

        // Возвращаем значение на стек — как в JS, присваивание это выражение.
        context.pushStackVar(variable);
    }

    objPropHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        if (typeof token.nValue !== 'string')
            throw new InterpreterException('token nValue invalid', token.cursorPos);

        const propname = token.nValue;
        const getVar = variable.getProperty(propname);

        // Зеркало PHP objPropHandler: если у объекта есть это свойство,
        // отдаём его обёрткой StackVariableRef через get/set — тогда `obj.prop++`
        // запишется обратно через setProperty.
        // ЯЗЫКОВОЕ ОТЛИЧИЕ от PHP (P2-7): PHP передаёт сюда $context в Ref, но в
        // TS это нельзя — funcEntryCache захватывает Proxy(StackVariableRef) с его
        // scope, и после выхода из короткоживущего scope ломается чужой вызов
        // (баг исправлен в 5c6d5ad, страж — Bug_FuncEntryCache_ProxyOnDeadScope).
        // Поэтому Ref здесь без context, а отсутствующее свойство отдаём обычным
        // StackVariableUndefined, а не записываемым Ref.
        if (getVar instanceof StackVariable) {
            const refProp = new StackVariableRef({
                get: () => variable.getProperty(propname) as object,
                set: (value: unknown) => {
                    if (!(value instanceof StackVariable))
                        throw new MSLangException('set property value must be instance of StackVariable');
                    variable.setProperty(propname, value);
                },
            });
            context.pushStackVar(refProp.getProxy());
            return;
        }

        const fn = variable.getFunctionEntry(propname);
        if (fn) {
            context.pushStackVar(new StackVariableFunction(fn, variable));
            return;
        }

        // Нет ни свойства, ни функции — отдаём undefined.
        context.pushStackVar(new StackVariableUndefined(false));
    }

    contextVariableHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue !== 'string')
        {
            throw new InterpreterException('variable name must be string');
        }

        //TDZ для let/const: переменная объявлена в текущем блоке, но строка
        //декларации ещё не выполнена — sentinel лежит в _variables. Чтение
        //должно сразу падать с понятным сообщением, не создавая Ref.
        const direct = context.getVariable(token.nValue);
        if (direct instanceof StackVariableTDZ) {
            throw new InterpreterException(
                "Cannot access '" + token.nValue + "' before initialization",
                token.cursorPos,
            );
        }

        const variable = context.getVariableRef(token.nValue);

        if (!variable)
            throw new InterpreterException('variable not defined ' + token.nValue, token.cursorPos);

        context.pushStackVar(variable);
    }

    ifHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('if (...) is empty', token.cursorPos);

        const variable = context.createVariable(VariableType.vtBoolean, false);

        context.pushStackVar(variable);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntIFFinish;
        context._codeItems.push(node);
        //console.log(util.inspect(token.childItems, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    ifValueHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('ifValue is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntIFValueFinish;
        context._codeItems.push(node);

        //console.log(util.inspect(token, { compact: true, depth: null, breakLength: 80, colors: true, getters: true, showHidden: true }));
    }

    ifValueBOOLHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('ifValueBOOL is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntIFValueBOOLFinish;
        context._codeItems.push(node);
    }

    ifValueFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    ifValueBOOLFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        context.popExecutionStack();

        //Истинность условия — через единую точку isTruthy (JS): NaN→ложь, []→истина.
        context.pushStackVar(context.createVariable(VariableType.vtBoolean, Interpreter.isTruthy(variable)));
    }

    expressionCompareHandler(context: ContextInterpreter, token: ParseNode) {
        //context.execStepOver();
        context.execGetVariable();

        const rightCompare = context.popStackVar(),
            leftCompare = context.popStackVar(),
            compareResult = context.createVariable(VariableType.vtBoolean, false);

        this.compareVariable(token.nValue as CompareType, leftCompare, rightCompare, compareResult, token.cursorPos);

        context.pushStackVar(compareResult);
    }

    ifCompareHandler(context: ContextInterpreter, token: ParseNode) {
        //context.execStepOver();
        context.execGetVariable();

        const rightCompare = context.popStackVar(),
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
        // Refs прозрачно разворачиваем — иначе instanceof-проверки внутри
        // comparePriority/compare (например, у StackVariableDateTime) видят
        // прокси StackVariableRef и не узнают исходный тип.
        if (leftCompare instanceof StackVariableRef)
            leftCompare = (leftCompare as unknown as { refValue: StackVariable }).refValue;
        if (rightCompare instanceof StackVariableRef)
            rightCompare = (rightCompare as unknown as { refValue: StackVariable }).refValue;

        const leftPriority = leftCompare.comparePriority(rightCompare, compareType),
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
        const variable = context.popStackVar();
        context.pushStackVar(variable);

        //JS-семантика: `a || b` коротко замыкается на ИСТИННОМ левом (по truthiness, не по
        //строгому === true) и возвращает сам операнд. В условии операнды уже приведены к
        //булеву через ntIFValueBOOL; в значении (`x = a || b`) — сырые.
        if (Interpreter.isTruthy(variable)) {
            if (!context._codeItems)
                throw new InterpreterException('codeItems not initialized', token.cursorPos);

            context._pos = context._codeItems.length - 1;
        }
    }

    ifCompareAndHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();
        context.pushStackVar(variable);

        //JS-семантика: `a && b` коротко замыкается на ЛОЖНОМ левом (по truthiness) и
        //возвращает сам операнд.
        if (!Interpreter.isTruthy(variable)) {
            if (!context._codeItems)
                throw new InterpreterException('codeItems not initialized', token.cursorPos);

            context._pos = context._codeItems.length - 1;
        }
    }

    /** Истинность значения по правилам JS (для &&/||). Разворачивает Ref. */
    /**
     * ЕДИНАЯ точка истинности по правилам JS (зеркало PHP Interpreter::isTruthy). Все
     * управляющие конструкции — if/while/for, !, ?:, &&/||, колбэки filter/find/some/every —
     * идут через неё. Не полагается на castAs(vtBoolean) (у хост-объекта он null).
     */
    private static isTruthy(variable: StackVariable): boolean {
        let value: StackVariable = variable;
        if (value instanceof StackVariableRef) {
            value = value.refValue as StackVariable;
        }

        const type = value.type;

        //Число: 0, -0, NaN → ложь; иначе истина.
        if (type === VariableType.vtNumber) {
            const n = Number(value.value);
            return n !== 0 && !Number.isNaN(n);
        }

        switch (type) {
            case VariableType.vtString:
                return (value.value as string).length > 0;
            case VariableType.vtBoolean:
                return Boolean(value.value);
            case VariableType.vtNull:
            case VariableType.vtUndefined:
            case VariableType.vtVoid:
                return false;
            default:
                //Массив (даже пустой), объект, plain-объект, функция, класс, DateTime,
                //хост-объект — всегда истина (как JS).
                return true;
        }
    }

    negativeIfHandler(context: ContextInterpreter, token: ParseNode) {
        //context.execStepOver();
        context.execGetVariable();

        const variable = context.popStackVar();

        //`!x` — отрицание истинности по JS через единую точку (![]→false, !NaN→true).
        context.pushStackVar(context.createVariable(VariableType.vtBoolean, !Interpreter.isTruthy(variable)));
    }

    negativeIfFinishHandler(context: ContextInterpreter, token: ParseNode) {
    }

    typeofHandler(context: ContextInterpreter, token: ParseNode) {
        //`typeof x` — операнд вычисляется так же, как у `!`, и снимается со стека.
        context.execGetVariable();

        let variable = context.popStackVar();
        if (variable instanceof StackVariableRef) {
            variable = variable.refValue as StackVariable;
        }

        //Имена ровно как в JS typeof (НЕ как typeName): "boolean", не "bool";
        //массив/объект/null → "object"; void (внутренний) → "undefined".
        let name: string;
        switch (variable.type) {
            case VariableType.vtNumber: name = 'number'; break;
            case VariableType.vtString: name = 'string'; break;
            case VariableType.vtBoolean: name = 'boolean'; break;
            case VariableType.vtUndefined:
            case VariableType.vtVoid: name = 'undefined'; break;
            case VariableType.vtFunction: name = 'function'; break;
            default: name = 'object'; //null, array, object, хост-объект, дата
        }

        context.pushStackVar(new StackVariableString(false, name, context));
    }

    ifFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

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
        if (!token.childItems)
            throw new InterpreterException('subCode is empty', token.cursorPos);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        //Hoisting: все function-объявления этого блока поднимаются в его начало.
        this.hoistFunctions(context, context._codeItems);

        const node = new InterpreterNode(token.cursorPos);
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
        if (!token.childItems)
            throw new InterpreterException('child items not initialized', token.cursorPos);

        if (token.childItems.length !== 4)
            throw new InterpreterException('for handler must be 4 child items', token.cursorPos);

        const initNode = token.childItems[0];
        const checkNode = token.childItems[1];
        const incrNode = token.childItems[2];
        const bodyNode = token.childItems[3];

        if (!(initNode instanceof ParseNode) || !(checkNode instanceof ParseNode)
            || !(incrNode instanceof ParseNode) || !(bodyNode instanceof ParseNode))
            throw new InterpreterException('for handler must be contains ParseNode', token.cursorPos);

        context.pushExecutionStack();

        context._type = ContextType.ctAllowBreak;
        context._codeItems = [];

        context._codeItems.push(...initNode.nodeChildren()); //init for variable;

        context._codeItems.push(checkNode); //check condition
        context._codeItems.push(bodyNode); //execution for code

        // Точка перехода для continue — позиция, на которую надо встать,
        // чтобы пропустить остаток тела и выполнить инкремент.
        context._codeData['continue'] = context._codeItems.length;

        context._codeItems.push(incrNode); //increment condition

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntForLoop;
        node.nValue = 4;
        context._codeItems.push(node);
    }

    forCompareHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('forCompare is empty', token.cursorPos)

        const variable = context.createVariable(VariableType.vtBoolean, false);
        context.pushStackVar(variable);

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntForCompareFinish;
        context._codeItems.push(node);
    }

    forCompareFinishHandler(context: ContextInterpreter, token: ParseNode) {

        if (context._stackVars.length) {
            const variable = context.popStackVar();

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
        // Размер «шага назад» хранится в nValue: 4 для for (условие+тело+инкремент+ntForLoop),
        // 3 для while (условие+тело+ntForLoop). Зеркало PHP.
        const step = typeof token.nValue === 'number' ? token.nValue : 4;
        context._pos -= step;
    }

    whileHandler(context: ContextInterpreter, token: ParseNode) {
        // ntWhile.childItems = [condition (ntForCompare), body (ntSubCode)].
        // Используем тот же ntForLoop, что и for, но с шагом 3.
        if (!token.childItems || token.childItems.length !== 2)
            throw new InterpreterException('while handler must be 2 child items', token.cursorPos);

        context.pushExecutionStack();

        context._type = ContextType.ctAllowBreak;
        context._codeItems = [];

        const checkNode = token.childItems[0];
        const bodyNode = token.childItems[1];
        if (!(checkNode instanceof ParseNode) || !(bodyNode instanceof ParseNode))
            throw new InterpreterException('while handler must contain ParseNode children', token.cursorPos);

        context._codeItems.push(checkNode); // условие
        context._codeItems.push(bodyNode); // тело

        // У while нет отдельного increment — continue прыгает на ntForLoop,
        // который сам отматывается к условию.
        context._codeData['continue'] = context._codeItems.length;

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntForLoop;
        node.nValue = 3;
        context._codeItems.push(node);
    }

    returnHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('return childItems not initialized', token.cursorPos);

        if (!token.childItems.length) {
            //`return;` без значения — отдаём undefined и сразу отматываем стек.
            const variable = new StackVariableUndefined(false);
            this.unwindReturn(context, variable);
            return;
        }

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntReturnFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    returnFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let variable = context.popStackVar();

        //Если выражение вернуло Ref на локальную переменную функции, развернём его
        //сейчас, пока scope ещё активен. После popFunctionScope в unwindReturn
        //эта локальная переменная исчезнет, и Ref начнёт выдавать undefined.
        if (variable instanceof StackVariableRef) {
            variable = variable.refValue as StackVariable;
        }

        //Выходим из push'а, сделанного returnHandler-ом для оценки выражения.
        context.popExecutionStack();

        this.unwindReturn(context, variable);
    }

    /**
     * Отматывает стек, останавливаясь на ближайшей границе вызова функции
     * (ctFunctionCall). Если такой границы нет — это глобальный return из скрипта.
     */
    protected unwindReturn(context: ContextInterpreter, value: StackVariable): void {
        while (context._executionStack.length) {
            if (context._type === ContextType.ctFunctionCall) {
                context.popFunctionScope();
                context.pushStackVar(value);
                return;
            }
            context.popExecutionStack();
        }

        //Дошли до верхнего уровня — это return из скрипта.
        context.pushStackVar(value);
        context._type = ContextType.ctReturn;
    }

    continueHandler(context: ContextInterpreter, token: ParseNode) {
        // continue: разматываем кадры до ближайшего цикла (ctAllowBreak)
        // и переставляем _pos на точку перехода, сохранённую в _codeData['continue'].
        while (context._executionStack.length) {
            const allowBreak = context._type === ContextType.ctAllowBreak;

            if (!allowBreak && context._type !== ContextType.ctNormal) {
                throw new InterpreterException('Invalid context execution stack type', token.cursorPos);
            }

            if (allowBreak) {
                const pos = context._codeData['continue'];
                if (typeof pos !== 'number')
                    throw new InterpreterException('"continue" failed find end loop node', token.cursorPos);

                context._pos = pos;
                return;
            }

            context.popExecutionStack();
        }

        throw new InterpreterException('continue invalid statement', token.cursorPos);
    }

    breakHandler(context: ContextInterpreter, token: ParseNode) {
        while (context._executionStack.length) {
            const allowBreak = context._type === ContextType.ctAllowBreak;

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
        context._codeItems.push(...token.nodeChildren());

        context._contextVariable = new StackVariableArray(false, [], context);

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    ArrayPushHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('arrayPush childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    ArrayPushFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        if (!(context._contextVariable instanceof StackVariableArray))
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
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntBracketGetKeyFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    BracketGetKeyFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        if (variable.type !== VariableType.vtNumber && variable.type !== VariableType.vtString) {
            throw new InterpreterException('You can access a property by string or numeric key, given ' + variable.typeName, token.cursorPos);
        }

        context.popExecutionStack();

        const accessTo = context.popStackVar();

        // Зеркало PHP (раздельные двери offsetGet/getProperty), сведённое в один
        // обработчик: строка индексируема (str[i] → символ, как JS); массив/объект —
        // через getProperty; скаляр (число/булево/null/undefined) индексировать
        // нельзя — "Cannot read offset" (а не молчаливый undefined).
        if (accessTo.type === VariableType.vtString) {
            const idx = Number(variable.value);
            const chars = Array.from(accessTo.value as string);
            if (Number.isInteger(idx) && idx >= 0 && idx < chars.length) {
                context.pushStackVar(new StackVariableString(false, chars[idx], context));
            } else {
                context.pushStackVar(context.createVariable(VariableType.vtUndefined, undefined));
            }
            return;
        }

        if (accessTo.type !== VariableType.vtArray && accessTo.type !== VariableType.vtObject) {
            throw new InterpreterException('Cannot read offset', token.cursorPos);
        }

        //Нормализуем дробный ключ к строке, как PHP (целый float уже совпадает с int).
        let key = variable.value;
        if (typeof key === 'number' && !Number.isInteger(key)) {
            key = String(key);
        }

        const propertyValue = accessTo.getProperty(key as string);

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

        // Эталон PHP: childItems[0] — путь к ячейке (ParseNode[]),
        // childItems[1] — выражение присваивания (ParseNode[]).
        // См. CodeParser::parseExpression и Interpreter::BracketSetKeyHandler.
        const leftItems = token.childItems[0];
        const rightItems = token.childItems[1];

        if (!Array.isArray(leftItems) || !Array.isArray(rightItems))
            throw new InterpreterException('Bracket Set Key: childItems[0]/[1] must be ParseNode[]', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...leftItems);

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntBracketSetKeyLeftFinish;
        node.nValue = rightItems;
        context._codeItems.push(node);
    }

    BracketSetKeyLeftFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar();

        if (variable.type !== VariableType.vtNumber && variable.type !== VariableType.vtString) {
            throw new InterpreterException('You can access a property by string or numeric key, given ' + variable.typeName, token.cursorPos);
        }

        if (!Array.isArray(token.nValue))
            throw new InterpreterException('Bracket Set Key Left Finish: nValue must be ParseNode[]', token.cursorPos);

        context.popExecutionStack();

        //выполнение выражения

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nValue);

        const node = new InterpreterNode(token.cursorPos);
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

        //Развёртка Ref: если value пришло как Ref на параметр функции или на
        //локальную let-переменную, то после popFunctionScope/popExecutionStack
        //эта переменная исчезнет и массив будет хранить «мёртвую» ссылку.
        //Фиксируем StackVariable прямо сейчас.
        if (variable instanceof StackVariableRef) {
            variable = variable.refValue as StackVariable;
        }
        if (accessTo instanceof StackVariableRef) {
            accessTo = accessTo.refValue as StackVariable;
        }

        accessTo.setProperty(token.nValue.value as string, variable);

        context.pushStackVar(variable);
    }

    FuncParamArrayUnpackHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Func Param Array Unpack, childItems not initialized', token.cursorPos)

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntFuncParamArrayUnpackFinish;
        context._codeItems.push(node);
    }

    FuncParamArrayUnpackFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context.popStackVar() as StackVariableArray;

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
        const first = token.childItems[0];
        if (!(first instanceof ParseNode))
            throw new InterpreterException('Array Push Separator: childItems[0] must be ParseNode', token.cursorPos);
        context._codeItems.push(first);

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushSeparatorFinish;
        node.childItems = token.nodeChildren().slice(1);
        context._codeItems.push(node);
    }

    ArrayPushSeparatorKeyHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Array Push Separator Key, childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushSeparatorKeyFinish;
        context._codeItems.push(node);
    }

    ArrayPushSeparatorKeyFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const arrayKey = context.popStackVar();

        context.popExecutionStack();

        context.pushStackVar(arrayKey);
    }

    ArrayPushSeparatorFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Array Push Separator Finish, childItems not initialized', token.cursorPos);

        const arrayKey = context.popStackVar();

        if (arrayKey.type !== VariableType.vtNumber && arrayKey.type !== VariableType.vtString) {
            throw new InterpreterException('array key must be number or string', token.cursorPos);
        }

        context.popExecutionStack();

        context.pushStackVar(arrayKey);
        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntArrayPushKeyValue;
        context._codeItems.push(node);
    }

    ArrayPushKeyValueHandler(context: ContextInterpreter, token: ParseNode) {
        let arrayValue = context.popStackVar();

        context.popExecutionStack();

        const arrayKey = context.popStackVar();

        if (!context._contextVariable)
            throw new InterpreterException('ArrayPushKeyValue contextVariable not initialized', token.cursorPos);

        //Развёртка Ref: внутри литерала массива тоже могут быть параметры функций
        //или let-переменные. Их Ref сохранять в массив нельзя — после возврата
        //из функции мы получим undefined вместо значения.
        if (arrayValue instanceof StackVariableRef) {
            arrayValue = arrayValue.refValue as StackVariable;
        }

        context._contextVariable.setProperty(arrayKey.value as string, arrayValue);
    }

    //Литерал объекта `{ key: value, ... }`. Строится тем же приёмом «повторного
    //входа», что и литерал массива: ObjectHandler заводит кадр и пустой
    //StackVariablePlainObject в _contextVariable, по узлу ntObjectEntry на каждый
    //ключ кладёт значение в объект, ObjectFinish возвращает готовый объект на стек.
    ObjectHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('Object childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        context._contextVariable = new StackVariablePlainObject(false, context);

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntObjectFinish;
        node.nValue = context._stackVars.length;
        context._codeItems.push(node);
    }

    ObjectFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = context._contextVariable;

        context.popExecutionStack();

        context.pushStackVar(variable);
    }

    ObjectEntryHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems)
            throw new InterpreterException('objectEntry childItems not initialized', token.cursorPos);

        context.pushExecutionStack();

        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const node = new InterpreterNode(token.cursorPos);
        node.nType = InterpreterNodeType.ntObjectEntryFinish;
        node.nValue = token.nValue; //имя ключа
        context._codeItems.push(node);
    }

    ObjectEntryFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let value = context.popStackVar();

        //Развёртка Ref как у ключа массива (ArrayPushKeyValue): значение-параметр
        //или let нельзя класть ссылкой — после выхода из функции получим undefined.
        if (value instanceof StackVariableRef) {
            value = value.refValue as StackVariable;
        }

        if (!(context._contextVariable instanceof StackVariablePlainObject))
            throw new InterpreterException('context variable expected object', token.cursorPos);

        context._contextVariable.setProperty(token.nValue as string, value);

        context.popExecutionStack();
    }

    /**
     * Обработчик `switch (expr) { ... }`.
     *
     * Создаёт новую область выполнения с `ctAllowBreak`, ставит на выполнение
     * switch-выражение, а финал передаёт в {@see switchEvaluatedHandler}.
     *
     * Зеркало PHP-эталона `Interpreter::switchHandler`.
     */
    switchHandler(context: ContextInterpreter, token: ParseNode) {
        const children = token.childItems;
        if (!children || children.length < 1) {
            throw new InterpreterException('Switch: missing expression', token.cursorPos);
        }

        const exprNode = children[0];
        if (!(exprNode instanceof ParseNode)) {
            throw new InterpreterException('Switch: invalid expression node', token.cursorPos);
        }

        context.pushExecutionStack();
        context._type = ContextType.ctAllowBreak;
        context._codeItems = [];

        context._codeItems.push(exprNode);

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntSwitchEvaluated;
        const finishChildren: ParseNode[] = [];
        for (let i = 1; i < children.length; i++) {
            const item = children[i];
            if (item instanceof ParseNode) {
                finishChildren.push(item);
            }
        }
        finish.childItems = finishChildren;
        context._codeItems.push(finish);
    }

    /**
     * Доработка `switch` после того, как выражение вычислено:
     * сравнивает значение со списком `case`, поддерживает fall-through и `default`.
     *
     * Значение `case` обязано быть литералом (`ntNumeric`/`ntFloat`/`ntString`)
     * или контекстной переменной — динамические выражения не поддерживаются.
     *
     * Важно: после переназначения `_codeItems` сбрасываем `_pos = 0`, иначе
     * интерпретатор продолжит с позиции, где был, и пропустит начало body.
     *
     * Зеркало PHP-эталона `Interpreter::switchEvaluatedHandler`.
     */
    switchEvaluatedHandler(context: ContextInterpreter, token: ParseNode) {
        let switchValue = context.popStackVar();
        if (switchValue instanceof StackVariableRef) {
            //На стеке лежит getProxy()-обёртка StackVariableRef, через Proxy метод
            //getRefValue() не доступен напрямую (см. stackvariableref.ts get-trap).
            //Геттер refValue — особый случай, его Proxy пробрасывает.
            switchValue = (switchValue as StackVariableRef).refValue as StackVariable;
        }

        const caseNodes = token.childItems ?? [];
        let matchIndex = -1;
        let defaultIndex = -1;

        for (let i = 0; i < caseNodes.length; i++) {
            const caseNode = caseNodes[i];
            if (!(caseNode instanceof ParseNode)) continue;

            if (caseNode.nType === NodeType.ntCase) {
                const caseLiteral = this.evalCaseLiteral(context, caseNode, token);

                if (switchValue.compare(caseLiteral, CompareType.ctEqual)) {
                    matchIndex = i;
                    break;
                }
            } else if (caseNode.nType === NodeType.ntDefault) {
                if (defaultIndex < 0) {
                    defaultIndex = i;
                }
            }
        }

        if (matchIndex < 0) {
            matchIndex = defaultIndex;
        }

        if (matchIndex < 0) {
            //ни case не совпал, и default не задан — просто выходим.
            context.popExecutionStack();
            return;
        }

        //fall-through: ставим на выполнение тело найденного case'а и всех следующих,
        //пока не встретим break (он сам отмотает наш execution-stack).
        context._codeItems = [];
        context._pos = 0;
        for (let j = matchIndex; j < caseNodes.length; j++) {
            const caseNode = caseNodes[j];
            if (!(caseNode instanceof ParseNode)) continue;

            const bodyStart = (caseNode.nType === NodeType.ntCase) ? 1 : 0;
            const caseChildren = caseNode.childItems ?? [];
            for (let k = bodyStart; k < caseChildren.length; k++) {
                const bodyItem = caseChildren[k];
                if (bodyItem instanceof ParseNode) {
                    context._codeItems.push(bodyItem);
                }
            }
        }

        //Естественное завершение switch без break: снимаем execution-stack.
        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntSubCodeFinish;
        context._codeItems.push(finish);
    }

    /**
     * Распознаёт литеральное значение `case` — для первой реализации мы
     * сознательно ограничиваемся литералами и контекстными переменными.
     *
     * Зеркало PHP-эталона `Interpreter::evalCaseLiteral`.
     */
    protected evalCaseLiteral(context: ContextInterpreter, caseNode: ParseNode, errToken: ParseNode): StackVariable {
        const caseChildren = caseNode.childItems ?? [];
        if (caseChildren.length < 1) {
            throw new InterpreterException('Switch: case is missing value', errToken.cursorPos);
        }

        const valueWrap = caseChildren[0];
        if (!(valueWrap instanceof ParseNode) || valueWrap.nType !== NodeType.ntSubExpression) {
            throw new InterpreterException('Switch: invalid case value structure', errToken.cursorPos);
        }

        const inner = valueWrap.childItems ?? [];
        if (inner.length !== 1) {
            throw new InterpreterException(
                'Switch: case value must be a single literal (number, string or const variable)',
                errToken.cursorPos
            );
        }

        const literal = inner[0];
        if (!(literal instanceof ParseNode)) {
            throw new InterpreterException('Switch: invalid case literal', errToken.cursorPos);
        }

        switch (literal.nType) {
            case NodeType.ntNumeric:
                return context.createVariable(VariableType.vtNumber, +(literal.nValue as number));
            case NodeType.ntFloat:
                return context.createVariable(VariableType.vtFloat, +(literal.nValue as number));
            case NodeType.ntString:
                return context.createVariable(VariableType.vtString, String(literal.nValue));
            case NodeType.ntContextVariable: {
                const varName = String(literal.nValue);
                const variable = context.getVariable(varName);
                if (!variable) {
                    throw new InterpreterException('Switch: unknown case variable "' + varName + '"', errToken.cursorPos);
                }
                return variable;
            }
        }

        throw new InterpreterException(
            'Switch: case value must be literal (number, float, string) or const variable',
            errToken.cursorPos
        );
    }

    /**
     * Обработчик `function name(params) { body }`.
     *
     * Создаёт {@link StackVariableUserFunction} и регистрирует её в текущей
     * области видимости под именем функции. Тело не выполняется до явного вызова.
     *
     * Зеркало PHP-эталона `Interpreter::functionDefHandler`.
     */
    functionDefHandler(context: ContextInterpreter, token: ParseNode) {
        const name = String(token.nValue);

        //function-выражение: `x = function() { ... }` или `this.greet = function() {...}`.
        //Парсер ставит метку nValue2 = 'expr'. Имя может быть пустым (anonymous)
        //или непустым (named expression). Здесь мы НЕ регистрируем функцию
        //в _variables — она используется как значение и попадает на стек.
        if (token.nValue2 === 'expr') {
            const func = this.buildUserFunction(context, token);
            context.pushStackVar(func);
            return;
        }

        if (name === '') {
            throw new InterpreterException('Function definition has empty name', token.cursorPos);
        }

        const func = this.buildUserFunction(context, token);
        //Прямая запись минуя setVariable: функция const, повторный setVariable отказался бы.
        context._variables[name] = func;
    }

    /**
     * Регистрирует в текущей области видимости все определения функций (`ntFunctionDef`)
     * и классов (`ntClassDecl`), лежащие в переданном списке узлов. Hoisting работает
     * на уровне «своей области»: вызывается в начале exec, в начале subCode и в начале
     * тела функции.
     *
     * Зеркало PHP-эталона `Interpreter::hoistFunctions`.
     */
    hoistFunctions(context: ContextInterpreter, nodes: Array<ParseNode | ParseNode[]>) {
        for (const node of nodes) {
            if (!(node instanceof ParseNode)) continue;
            if (node.nType === NodeType.ntFunctionDef) {
                //function-выражения (`x = function() {...}`) не hoist'им — они
                //живут как обычные значения и присваиваются по месту.
                if (node.nValue2 === 'expr') continue;
                const name = String(node.nValue);
                if (name === '') continue;
                const func = this.buildUserFunction(context, node);
                //Прямая запись, чтобы повторный functionDefHandler не упёрся в isConst.
                context._variables[name] = func;
                continue;
            }
            if (node.nType === NodeType.ntClassDecl) {
                const name = String(node.nValue);
                if (name === '') continue;
                const cls = this.buildUserClass(context, node);
                //Тоже прямая запись — класс уже const, setVariable отказался бы.
                context._variables[name] = cls;
                continue;
            }
        }

        //Hoisting var-объявлений: рекурсивно по всем вложенным блокам внутри
        //текущей функции, без захода в вложенные функции/методы. Каждая
        //переменная создаётся в _variables со значением undefined.
        this.hoistVars(context, nodes);

        //Hoisting let/const-объявлений: только текущий блок (без захода во
        //вложенные blocks/if/for/while/try). Создаём TDZ-sentinel и помечаем
        //имя в letNames — чтобы при popExecutionStack переменная не утекла.
        this.hoistLetConst(context, nodes);
    }

    /**
     * Hoisting var-объявлений (JS-семантика): рекурсивно обходим текущий блок
     * и все вложенные блочные конструкции (if/else/for/while/switch/try/catch/
     * finally) — НО НЕ заходим внутрь вложенных функций/классов, у них свой
     * function scope.
     *
     * Для каждой найденной `ntVarDecl` с kind='var' создаём переменную с
     * undefined в текущем функциональном scope.
     */
    hoistVars(context: ContextInterpreter, nodes: Array<ParseNode | ParseNode[]>) {
        for (const node of nodes) {
            if (!(node instanceof ParseNode)) continue;
            //Вложенные функции/классы пропускаем — у них свой scope для var.
            if (node.nType === NodeType.ntFunctionDef) continue;
            if (node.nType === NodeType.ntClassDecl) continue;

            if (node.nType === NodeType.ntVarDecl && node.nValue2 === 'var') {
                const name = String(node.nValue);
                if (name === '') continue;
                //Уже объявлена (let/const до или сам var повторно) — пропускаем,
                //runtime varDeclHandler сам перезапишет значение при выполнении.
                if (!(name in context._variables)) {
                    context._variables[name] = new StackVariableUndefined(false);
                }
                continue;
            }

            //Рекурсивный спуск по childItems всех блочных узлов.
            //childItems может содержать как ParseNode, так и вложенные
            //list<ParseNode> (см. ntBracketSetKey); hoistVars игнорирует
            //не-ParseNode на верхнем уровне рекурсии.
            if (node.childItems) {
                this.hoistVars(context, node.childItems);
            }
        }
    }

    /**
     * Hoisting let/const-объявлений в текущем блоке. В отличие от var,
     * НЕ заходит внутрь вложенных блочных узлов (subCode/if/while/for/try/...)
     * — у них свой block scope, и там этим займётся `pushExecutionStack`
     * со своим вызовом `hoistFunctions` → `hoistLetConst`.
     */
    hoistLetConst(context: ContextInterpreter, nodes: Array<ParseNode | ParseNode[]>) {
        for (const node of nodes) {
            if (!(node instanceof ParseNode)) continue;
            if (node.nType !== NodeType.ntVarDecl) continue;
            const kind = String(node.nValue2);
            if (kind !== 'let' && kind !== 'const') continue;
            const name = String(node.nValue);
            if (name === '') continue;
            //Запрет переобъявления: let/const с тем же именем в том же блоке.
            if (context._letNames[name] === true) {
                throw new InterpreterException(
                    "Identifier '" + name + "' has already been declared in this block",
                    node.cursorPos,
                );
            }
            const sentinel = new StackVariableTDZ(name);
            context._variables[name] = sentinel;
            context._letNames[name] = true;
        }
    }

    /**
     * Собирает {@link StackVariableUserFunction} из узла `ntFunctionDef`,
     * разделяя его childItems на параметры и тело. Захватывает снимок
     * переменных текущей области для замыкания.
     */
    protected buildUserFunction(context: ContextInterpreter, defNode: ParseNode): StackVariableUserFunction {
        const params: ParseNode[] = [];
        const body: ParseNode[] = [];

        for (const child of defNode.childItems ?? []) {
            if (!(child instanceof ParseNode)) continue;
            if (child.nType === NodeType.ntFuncDefParam) {
                params.push(child);
            } else {
                body.push(child);
            }
        }

        const func = new StackVariableUserFunction(String(defNode.nValue), params, body);

        //Замыкание: запоминаем снимок переменных области, где функция объявлена.
        //Обычное копирование (Object.assign) — мутации внешних переменных после
        //объявления внутрь функции не пробрасываются.
        func.setCapturedScope(Object.assign({}, context._variables));

        return func;
    }

    /**
     * Запускает выполнение тела пользовательской функции:
     * биндит параметры, открывает функциональный scope и ставит тело в _codeItems.
     *
     * @param thisValue Если не null, после открытия scope выставляется
     *        `_currentThis = thisValue` — функция вызывается как
     *        метод/конструктор и видит `this` внутри тела.
     * @param ownerClass Класс, в котором определён этот метод/ctor. Нужен
     *        для `super(...)` и `super.method(...)`: они ищут родителя
     *        именно владельца, а не класса instance.
     * @param isCtorTDZ true, если это конструктор extends-класса и
     *        super() ещё не вызывали — `this` под TDZ до первого `super(...)`.
     */
    protected invokeUserFunction(
        context: ContextInterpreter,
        func: StackVariableUserFunction,
        parameters: StackVariable[],
        callToken: ParseNode,
        thisValue: StackVariable | null = null,
        ownerClass: StackVariableClass | null = null,
        isCtorTDZ: boolean = false,
    ): void {
        const funcParams = func.params;
        const body = func.body;

        //Rest-параметр (`function f(...args)`) допустим только как последний.
        //Сам он не обязателен — пустой массив тоже валиден.
        let restIndex: number | null = null;
        for (let i = 0; i < funcParams.length; i++) {
            if ((funcParams[i].nValue2 ?? null) === 'rest') {
                restIndex = i;
                break;
            }
        }

        //Считаем обязательные параметры (без default-выражения, не rest).
        let requiredCount = 0;
        for (let i = 0; i < funcParams.length; i++) {
            if (i === restIndex) continue;
            const p = funcParams[i];
            if (!p.childItems || p.childItems.length === 0) {
                requiredCount++;
            }
        }

        if (parameters.length < requiredCount) {
            throw new InterpreterException(
                'Function "' + func.name + '" requires at least ' + requiredCount
                + ' argument(s), got ' + parameters.length,
                callToken.cursorPos,
            );
        }

        //Лишние аргументы — WARNING, но вызов продолжается. С rest-param они
        //собираются в массив без предупреждения.
        if (restIndex === null && parameters.length > funcParams.length) {
            context.addWarning(
                'Function "' + func.name + '" called with ' + parameters.length
                + ' arguments, expected at most ' + funcParams.length
            );
        }

        //Заранее разрешаем Ref-обёртки и копируем примитивы. Делается ДО pushFunctionScope,
        //пока внешние переменные ещё видны — иначе Ref начнёт читать пустой scope функции.
        const boundValues: Array<StackVariable | null> = [];
        for (let i = 0; i < funcParams.length; i++) {
            if (i === restIndex) {
                //Собираем оставшиеся args в StackVariableArray.
                const restItems: StackVariable[] = [];
                for (let j = i; j < parameters.length; j++) {
                    let arg = parameters[j];
                    if (arg instanceof StackVariableRef) {
                        arg = arg.refValue as StackVariable;
                    }
                    if (arg.type === VariableType.vtObject || arg.type === VariableType.vtArray) {
                        restItems.push(arg);
                    } else {
                        restItems.push(context.createVariable(arg.type, arg.value));
                    }
                }
                //Зеркало PHP: строим rest-массив сразу из элементов с контекстом —
                //так его размер списывается из бюджета данных (count*16).
                const restArray = new StackVariableArray(false, restItems, context);
                boundValues.push(restArray);
                continue;
            }

            if (i < parameters.length) {
                let arg = parameters[i];
                if (arg instanceof StackVariableRef) {
                    arg = arg.refValue as StackVariable;
                }
                //Объекты и массивы — по ссылке, остальное — копия (как в JavaScript).
                if (arg.type === VariableType.vtObject || arg.type === VariableType.vtArray) {
                    boundValues.push(arg);
                } else {
                    boundValues.push(context.createVariable(arg.type, arg.value));
                }
            } else {
                //Заглушка — заполним значением по умолчанию уже внутри scope.
                boundValues.push(null);
            }
        }

        //Передаём в pushFunctionScope снимок переменных области, где функция была определена.
        context.pushFunctionScope(func.capturedScope);

        //Если функция вызывается как метод/конструктор — выставляем this уже после
        //того, как pushFunctionScope сбросил его в null. Так внутри тела `ntThis`
        //видит именно переданный instance.
        if (thisValue !== null) {
            context._currentThis = thisValue;
        }

        //Кто владеет этим телом — нужно для super(...) и super.method(...),
        //чтобы знать, какой класс считать «родителем». pushFunctionScope сбросил
        //это в null, поэтому выставляем явно тут.
        if (ownerClass !== null) {
            context._currentMethodOwner = ownerClass;
        }
        context._isCtorTDZ = isCtorTDZ;

        //Имя функции видно внутри её тела — позволяет прямую рекурсию.
        context._variables[func.name] = func;

        for (let i = 0; i < funcParams.length; i++) {
            const paramNode = funcParams[i];
            const paramName = String(paramNode.nValue);

            const bound = boundValues[i] ?? this.evalDefaultValue(context, paramNode, callToken);
            //Параметр пишем прямо в локальные переменные функции — иначе closure-walk
            //в setVariable пробил бы его через enclosing scope и затёр параметр родительского
            //рекурсивного вызова с тем же именем.
            context._variables[paramName] = bound;
        }

        //Hoisting вложенных функций тела — после регистрации параметров, чтобы
        //captured-snapshot у вложенных функций включал параметры внешней функции.
        this.hoistFunctions(context, body);

        //Ставим тело на выполнение, после него — финиш функции.
        context._codeItems = [];
        for (const stmt of body) {
            if (stmt instanceof ParseNode) {
                context._codeItems.push(stmt);
            }
        }

        const finish = new InterpreterNode(callToken.cursorPos);
        finish.nType = InterpreterNodeType.ntUserFuncFinish;
        context._codeItems.push(finish);
    }

    /**
     * Завершение функции без явного `return` — возвращаем undefined и снимаем scope.
     */
    userFuncFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const variable = new StackVariableUndefined(false);
        context.popFunctionScope();
        context.pushStackVar(variable);
    }

    /**
     * Распознаёт литеральное значение default-параметра функции.
     *
     * На этапе 1 поддерживаем только литералы и контекстные переменные —
     * как и в evalCaseLiteral для switch.
     */
    protected evalDefaultValue(
        context: ContextInterpreter,
        paramNode: ParseNode,
        callToken: ParseNode,
    ): StackVariable {
        const children = paramNode.childItems ?? [];
        if (children.length === 0) {
            return new StackVariableUndefined(false);
        }

        const wrap = children[0];
        if (!(wrap instanceof ParseNode) || wrap.nType !== NodeType.ntSubExpression) {
            throw new InterpreterException(
                'Invalid default value structure for parameter "' + paramNode.nValue + '"',
                callToken.cursorPos,
            );
        }

        const inner = wrap.childItems ?? [];
        if (inner.length !== 1) {
            throw new InterpreterException(
                'Default value for parameter "' + paramNode.nValue + '" must be a single literal',
                callToken.cursorPos,
            );
        }

        const literal = inner[0];
        if (!(literal instanceof ParseNode)) {
            throw new InterpreterException('Invalid default literal for "' + paramNode.nValue + '"', callToken.cursorPos);
        }

        switch (literal.nType) {
            case NodeType.ntNumeric:
                return context.createVariable(VariableType.vtNumber, +(literal.nValue as number));
            case NodeType.ntFloat:
                return context.createVariable(VariableType.vtFloat, +(literal.nValue as number));
            case NodeType.ntString:
                return context.createVariable(VariableType.vtString, String(literal.nValue));
            case NodeType.ntContextVariable: {
                const varName = String(literal.nValue);
                const variable = context.getVariable(varName);
                if (!variable) {
                    throw new InterpreterException('Unknown default variable "' + varName + '"', callToken.cursorPos);
                }
                return variable;
            }
        }

        throw new InterpreterException(
            'Default value for "' + paramNode.nValue + '" must be literal or const variable',
            callToken.cursorPos,
        );
    }

    /**
     * Обработчик `try { ... } catch (e) { ... } finally { ... }`.
     *
     * Открывает scope с типом `ctCatch` (граница для отмотки по throw),
     * сохраняет в `_codeData` ссылки на catch- и finally-узлы, и ставит
     * тело try на выполнение. После body — `ntTryFinish`.
     *
     * Зеркало PHP-эталона `Interpreter::tryHandler`.
     */
    tryHandler(context: ContextInterpreter, token: ParseNode) {
        const children = token.childItems;
        if (!children || children.length < 2) {
            throw new InterpreterException('Try: missing catch block', token.cursorPos);
        }

        const bodyNode = children[0];
        const catchNode = children[1];
        const finallyNode = children[2] ?? null;

        if (!(bodyNode instanceof ParseNode) || bodyNode.nType !== NodeType.ntSubCode) {
            throw new InterpreterException('Try: body must be ntSubCode', token.cursorPos);
        }
        if (!(catchNode instanceof ParseNode) || catchNode.nType !== NodeType.ntCatch) {
            throw new InterpreterException('Try: missing catch block', token.cursorPos);
        }

        context.pushExecutionStack();
        context._type = ContextType.ctCatch;
        context._codeItems = [];
        context._codeData['catchNode'] = catchNode;
        context._codeData['finallyNode'] = finallyNode;

        for (const stmt of bodyNode.nodeChildren()) {
            context._codeItems.push(stmt);
        }

        const finishNode = new InterpreterNode(token.cursorPos);
        finishNode.nType = InterpreterNodeType.ntTryFinish;
        context._codeItems.push(finishNode);
    }

    /**
     * Завершение try (без исключения) или завершение catch — снимает текущий scope
     * и, если есть finally, открывает scope для finally.
     */
    tryFinishHandler(context: ContextInterpreter, token: ParseNode) {
        const finallyNode = context._codeData['finallyNode'] ?? null;

        context.popExecutionStack();

        if (finallyNode instanceof ParseNode) {
            context.pushExecutionStack();
            context._type = ContextType.ctNormal;
            context._codeItems = [];
            for (const stmt of finallyNode.nodeChildren()) {
                context._codeItems.push(stmt);
            }
            const finallyFinish = new InterpreterNode(token.cursorPos);
            finallyFinish.nType = InterpreterNodeType.ntFinallyFinish;
            context._codeItems.push(finallyFinish);
        }
    }

    finallyFinishHandler(context: ContextInterpreter, token: ParseNode) {
        context.popExecutionStack();
    }

    /**
     * Оператор `throw <expr>;` — вычисляет выражение, после чего отматывает
     * стек выполнения до ближайшего блока try (ctCatch).
     */
    throwHandler(context: ContextInterpreter, token: ParseNode) {
        if (!token.childItems || token.childItems.length === 0) {
            throw new InterpreterException('Throw: missing expression', token.cursorPos);
        }

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntThrowFinish;
        context._codeItems.push(finish);
    }

    throwFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let value = context.popStackVar();
        if (value instanceof StackVariableRef) {
            value = value.refValue as StackVariable;
        }
        context.popExecutionStack();
        this.unwindThrow(context, value, token);
    }

    /**
     * Отматывает execution stack до ближайшего блока try.
     * Если такой границы нет — превращается в PHP/JS-исключение интерпретатора
     * (uncaught throw валит выполнение скрипта).
     */
    unwindThrow(context: ContextInterpreter, value: StackVariable, errToken: ParseNode | null = null): void {
        while (context._executionStack.length > 0) {
            if (context._type === ContextType.ctCatch) {
                const catchNode = context._codeData['catchNode'] ?? null;
                const finallyNode = context._codeData['finallyNode'] ?? null;

                context.popExecutionStack();

                context.pushExecutionStack();
                context._type = ContextType.ctNormal;
                context._codeItems = [];
                context._codeData['finallyNode'] = finallyNode;

                if (catchNode instanceof ParseNode) {
                    if (catchNode.nValue !== null && catchNode.nValue !== undefined && catchNode.nValue !== '') {
                        context.setVariable(String(catchNode.nValue), value);
                    }
                    for (const stmt of catchNode.nodeChildren()) {
                        context._codeItems.push(stmt);
                    }
                }

                const finishNode = new InterpreterNode(errToken?.cursorPos ?? null as unknown as TokenCursor);
                finishNode.nType = InterpreterNodeType.ntTryFinish;
                context._codeItems.push(finishNode);
                return;
            }

            if (context._type === ContextType.ctFunctionCall) {
                context.popFunctionScope();
            } else {
                context.popExecutionStack();
            }
        }

        //Не нашли catch — uncaught throw, валит скрипт.
        const msg = this.extractErrorMessage(value);
        throw new InterpreterException('Uncaught: ' + msg, errToken?.cursorPos ?? undefined);
    }

    /**
     * Извлекает читаемое сообщение из брошенного значения — для текста uncaught-throw.
     */
    protected extractErrorMessage(value: StackVariable): string {
        if (value.type === VariableType.vtObject) {
            const message = (value as StackVariableObject).getProperty('message');
            if (message instanceof StackVariable) {
                return String(message.value);
            }
            return '[object]';
        }

        const str = value.castAs(VariableType.vtString);
        if (str) {
            return String(str.value);
        }

        return String(value.typeName);
    }

    /**
     * Оборачивает обычное JS/TS-исключение интерпретатора в объект `Error`,
     * чтобы его можно было поймать через `catch` в скрипте.
     */
    wrapAsError(context: ContextInterpreter, e: unknown): StackVariableObject {
        const obj = new StackVariableObject(false, {});

        //Привязываем объект к встроенному классу Error из текущего контекста —
        //это позволяет ловить системные ошибки через `catch (e) { if (e instanceof Error) ... }`.
        const errorClass = context.getVariable('Error');
        if (errorClass instanceof StackVariableClass) {
            obj.setClass(errorClass);
        }

        const msg = (e instanceof Error) ? e.message : String(e);
        obj.registerProperty('message', new StackVariableString(false, msg));
        obj.registerProperty('name', new StackVariableString(false, 'Error'));

        if (e instanceof InterpreterException) {
            const cursor = e.getCursorPosition();
            if (cursor) {
                obj.registerProperty('line', new StackVariableNumber(false, cursor.startCursorLine ?? 0));
                obj.registerProperty('column', new StackVariableNumber(false, cursor.startCursorCol ?? 0));
            }
        }

        return obj;
    }

    /**
     * Проверяет, есть ли в execution stack активный блок try (ctCatch).
     * Используется главным циклом, чтобы решить — оборачивать ли системную ошибку
     * в Error и продолжать с catch, или пробрасывать наверх.
     */
    hasCatchInStack(context: ContextInterpreter): boolean {
        if (context._type === ContextType.ctCatch) {
            return true;
        }
        for (const frame of context._executionStack) {
            if (frame.type === ContextType.ctCatch) {
                return true;
            }
        }
        return false;
    }

    /**
     * Обработчик `new ClassName(args)`. Ставит на выполнение аргументы,
     * после них `ntNewFinish` вызывает builtin-конструктор и кладёт объект на стек.
     */
    newHandler(context: ContextInterpreter, token: ParseNode) {
        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntNewFinish;
        finish.nValue = token; //исходный узел — хранит имя класса в nValue
        finish.nValue2 = context._stackVars.length; //позиция стека до аргументов
        context._codeItems.push(finish);
    }

    newFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue2 !== 'number') {
            throw new InterpreterException('newFinish: invalid stack length', token.cursorPos);
        }

        let paramCount = context._stackVars.length - token.nValue2;
        const parameters: StackVariable[] = [];
        while (paramCount > 0) {
            parameters.unshift(context.popStackVar());
            paramCount--;
        }

        context.popExecutionStack();

        if (!(token.nValue instanceof ParseNode)) {
            throw new InterpreterException('newFinish: invalid token', token.cursorPos);
        }
        const className = String(token.nValue.nValue);
        const constructor = context.getVariable(className);
        if (!constructor) {
            throw new InterpreterException('Unknown class "' + className + '"', token.cursorPos);
        }

        //Нативные «классы» (Array, ...): передаём параметры самому объекту,
        //он сам строит результат. Без push кадра. Контекст — для бюджета данных
        //(зеркало PHP: construct(array $parameters, ContextInterpreter $context)).
        if (isBuiltinConstructor(constructor)) {
            context.pushStackVar(constructor.construct(parameters, context));
            return;
        }

        //Пользовательский класс: создаём instance, привязываем к классу, выполняем
        //тело конструктора (если есть) с this = instance, иначе сразу кладём
        //пустой instance на стек.
        if (constructor instanceof StackVariableClass) {
            const instance = new StackVariableObject(false, {});
            instance.setClass(constructor);

            //Свой ctor — берём его и владельца = сам класс. Иначе ищем ближайший
            //конструктор по цепочке родителей (auto super-call для extends-классов
            //без своего ctor): JS-семантика, аналог "constructor(...args) { super(...args); }".
            let ctor: StackVariableUserFunction;
            let ctorOwner: StackVariableClass;
            const ownCtor = constructor.getConstructor();
            if (ownCtor !== null) {
                ctor = ownCtor;
                ctorOwner = constructor;
            } else {
                const found = constructor.findCtorInChain(context);
                if (found === null) {
                    //Конструктора нет ни здесь, ни у родителей — просто пустой instance.
                    context.pushStackVar(instance);
                    return;
                }
                ctorOwner = found[0];
                ctor = found[1];
            }

            //Если ctor определён в extends-классе — внутри его scope действует TDZ
            //до super(...). Иначе (например, ctor только у родителя без extends
            //или auto-вызванный родительский ctor) TDZ не нужен.
            const isCtorTDZ = (ctorOwner.getParentName() !== null);

            //Кладём instance на стек ДО invokeUserFunction: pushFunctionScope
            //сохранит текущий _stackVars в кадр, после ntUserFuncFinish стек
            //восстановится с instance внизу. Сверху ляжет undefined (или то,
            //что вернул `return` из конструктора), который нам нужно снять —
            //это и делает ntCtorReturnInstance.
            context.pushStackVar(instance);

            //Вставляем ntCtorReturnInstance ровно в текущую позицию _pos —
            //между уже выполненным ntNewFinish и следующим узлом-родителем
            //(например, ntAssignFinish). Если бы мы просто дописали узел в
            //конец _codeItems, родительский finish исполнился бы раньше и
            //снял со стека undefined вместо instance.
            const afterCtor = new InterpreterNode(token.cursorPos);
            afterCtor.nType = InterpreterNodeType.ntCtorReturnInstance;
            if (!context._codeItems)
                throw new InterpreterException('newFinish: codeItems is empty', token.cursorPos);
            context._codeItems.splice(context._pos, 0, afterCtor);

            this.invokeUserFunction(context, ctor, parameters, token, instance, ctorOwner, isCtorTDZ);
            return;
        }

        //Function-конструктор (этап 4): обычная пользовательская функция,
        //вызванная через `new`. Создаём для неё класс-обёртку (lazy, кешируется
        //на самой функции — чтобы `a instanceof Foo` и `b instanceof Foo`
        //смотрели на один и тот же класс), привязываем instance к этой
        //обёртке и вызываем функцию как ctor.
        if (constructor instanceof StackVariableUserFunction) {
            const wrapperClass = constructor.getOrCreateWrapperClass();
            const instance = new StackVariableObject(false, {});
            instance.setClass(wrapperClass);

            context.pushStackVar(instance);

            const afterCtor = new InterpreterNode(token.cursorPos);
            afterCtor.nType = InterpreterNodeType.ntCtorReturnInstance;
            if (!context._codeItems)
                throw new InterpreterException('newFinish: codeItems is empty', token.cursorPos);
            context._codeItems.splice(context._pos, 0, afterCtor);

            //У function-конструктора по определению нет extends, поэтому TDZ
            //не нужен. ownerClass = обёртка — это нужно, чтобы внутри
            //конструктора возможные `super.x()` дали понятную ошибку
            //«class without extends», а не молчаливое null-обращение.
            this.invokeUserFunction(context, constructor, parameters, token, instance, wrapperClass, false);
            return;
        }

        //Не класс и не function-конструктор — `new` не применим.
        throw new InterpreterException('"' + className + '" is not a constructor', token.cursorPos);
    }

    /**
     * Финиш-узел `new ClassName(args)` после возврата из тела конструктора.
     * Снимает со стека undefined, который положил `ntUserFuncFinish` (тело без
     * `return` отдаёт undefined), и оставляет на стеке instance, который
     * лежит ниже.
     */
    ctorReturnInstanceHandler(_context: ContextInterpreter, _token: ParseNode) {
        //Снимаем undefined (или то значение, что вернул `return` в конструкторе
        //— в JS возврат примитива из конструктора игнорируется, возврат объекта
        //заменяет instance; нам пока проще всегда возвращать instance).
        _context.popStackVar();
        //instance остаётся на стеке — он был положен в newFinishHandler.
    }

    /**
     * `this` — кладёт текущий объект на стек. Вне метода/конструктора это ошибка.
     * Внутри конструктора extends-класса до первого `super(...)` тоже ошибка
     * (TDZ — зеркало JS-поведения).
     */
    thisHandler(context: ContextInterpreter, token: ParseNode) {
        if (context._currentThis === null) {
            throw new InterpreterException("'this' is not available outside of class method or constructor", token.cursorPos);
        }
        if (context._isCtorTDZ) {
            throw new InterpreterException("Must call super constructor before using 'this' in derived class constructor", token.cursorPos);
        }
        context.pushStackVar(context._currentThis);
    }

    /**
     * Обработчик `class Name { ... }`. После hoisting этот узел уже превратил
     * класс в `StackVariableClass` и положил в _variables, поэтому повторный
     * вызов handler-а ничего нового не делает.
     */
    classDeclHandler(context: ContextInterpreter, token: ParseNode) {
        const name = String(token.nValue);
        if (name === '') {
            throw new InterpreterException('Class definition has empty name', token.cursorPos);
        }
        if (!(context._variables[name] instanceof StackVariableClass)) {
            const cls = this.buildUserClass(context, token);
            context._variables[name] = cls;
        }
    }

    /**
     * Собирает {@link StackVariableClass} из узла `ntClassDecl`, превращая
     * каждый childItem (`ntFunctionDef`) в `StackVariableUserFunction`.
     * Метод с именем `constructor` записывается отдельным слотом.
     */
    protected buildUserClass(context: ContextInterpreter, defNode: ParseNode): StackVariableClass {
        const cls = new StackVariableClass(String(defNode.nValue));

        //Если у объявления есть `extends Parent`, имя родителя лежит в nValue2.
        //Реальная ссылка резолвится лениво в StackVariableClass.getParent().
        if (defNode.nValue2 !== null && defNode.nValue2 !== undefined && defNode.nValue2 !== '') {
            cls.setParentName(String(defNode.nValue2));
        }

        for (const member of defNode.childItems ?? []) {
            if (!(member instanceof ParseNode)) continue;
            if (member.nType !== NodeType.ntFunctionDef) continue;
            const methodName = String(member.nValue);
            const method = this.buildUserFunction(context, member);
            if (methodName === 'constructor') {
                cls.setConstructor(method);
            } else {
                cls.registerMethod(methodName, method);
            }
        }

        return cls;
    }

    /**
     * Обработчик `super(args)` — вызов родительского конструктора. Структура
     * напоминает newHandler: открываем кадр для аргументов, после них
     * `ntSuperCallFinish` уже знает, кого позвать.
     */
    superCallHandler(context: ContextInterpreter, token: ParseNode) {
        if (context._currentMethodOwner === null) {
            throw new InterpreterException("'super' is not available outside class method or constructor", token.cursorPos);
        }

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntSuperCallFinish;
        finish.nValue = token;
        finish.nValue2 = context._stackVars.length;
        context._codeItems.push(finish);
    }

    superCallFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue2 !== 'number') {
            throw new InterpreterException('superCallFinish: invalid stack length', token.cursorPos);
        }
        let paramCount = context._stackVars.length - token.nValue2;
        const parameters: StackVariable[] = [];
        while (paramCount > 0) {
            parameters.unshift(context.popStackVar());
            paramCount--;
        }

        context.popExecutionStack();

        const owner = context._currentMethodOwner;
        if (owner === null) {
            throw new InterpreterException("'super' is not available outside class method or constructor", token.cursorPos);
        }
        const parent = owner.getParent(context);
        if (parent === null) {
            throw new InterpreterException(
                "'super' call in class '" + owner.name + "' without extends",
                token.cursorPos,
            );
        }

        const thisValue = context._currentThis;
        if (thisValue === null) {
            //Внутри ctor `this` уже должен существовать (newFinishHandler выставил
            //его до запуска тела). Сюда попасть можно, только если super(...)
            //вызвали из контекста, где currentThis по какой-то причине null —
            //защитный путь.
            throw new InterpreterException("'super' requires 'this' which is not set", token.cursorPos);
        }

        //Ищем ближайший ctor в цепочке родителей: parent.constructor, иначе
        //parent.parent.constructor и т.д.
        const found = parent.findCtorInChain(context);
        if (found === null) {
            //У родителей нет конструктора — super() становится no-op (поля
            //не выставляются), но TDZ-флаг всё равно снимаем: super был вызван.
            context._isCtorTDZ = false;
            context.pushStackVar(new StackVariableUndefined(false));
            return;
        }
        const ctorOwner = found[0];
        const parentCtor = found[1];

        //TDZ для родительского ctor — если у него самого есть свой extends.
        const parentIsCtorTDZ = (ctorOwner.getParentName() !== null);

        //Снимаем TDZ-флаг в нашем (текущем) ctor-кадре сразу: после успешного
        //возврата из родительского ctor super считается вызванным, и обращения
        //к this в оставшейся части нашего ctor больше не валятся в TDZ.
        context._isCtorTDZ = false;

        //super(...) возвращает undefined как выражение — это финальный pushStackVar
        //ниже после возврата. Сам родительский ctor пушнет undefined через
        //ntUserFuncFinish; нам это сходит за результат.
        this.invokeUserFunction(context, parentCtor, parameters, token, thisValue, ctorOwner, parentIsCtorTDZ);
    }

    /**
     * Обработчик `super.method(args)` — вызов метода родителя. Структура
     * аналогична selfFuncCall: открываем кадр под аргументы, finish вызывает
     * найденный метод.
     */
    superMethodCallHandler(context: ContextInterpreter, token: ParseNode) {
        if (context._currentMethodOwner === null) {
            throw new InterpreterException("'super' is not available outside class method or constructor", token.cursorPos);
        }

        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntSuperMethodCallFinish;
        finish.nValue = token;
        finish.nValue2 = context._stackVars.length;
        context._codeItems.push(finish);
    }

    superMethodCallFinishHandler(context: ContextInterpreter, token: ParseNode) {
        if (typeof token.nValue2 !== 'number') {
            throw new InterpreterException('superMethodCallFinish: invalid stack length', token.cursorPos);
        }
        let paramCount = context._stackVars.length - token.nValue2;
        const parameters: StackVariable[] = [];
        while (paramCount > 0) {
            parameters.unshift(context.popStackVar());
            paramCount--;
        }

        context.popExecutionStack();

        const owner = context._currentMethodOwner;
        if (owner === null) {
            throw new InterpreterException("'super' is not available outside class method or constructor", token.cursorPos);
        }
        const parent = owner.getParent(context);
        if (parent === null) {
            throw new InterpreterException(
                "'super' call in class '" + owner.name + "' without extends",
                token.cursorPos,
            );
        }

        if (!(token.nValue instanceof ParseNode)) {
            throw new InterpreterException('superMethodCallFinish: invalid token', token.cursorPos);
        }
        const methodName = String(token.nValue.nValue);

        //Поиск метода по цепочке — найдём, КЕМ объявлен. methodOwner нужен,
        //чтобы вложенные `super` внутри super-метода смотрели правильно.
        let methodOwner: StackVariableClass | null = parent;
        let method: StackVariableUserFunction | null = null;
        while (methodOwner !== null) {
            method = methodOwner.getOwnMethod(methodName);
            if (method !== null) {
                break;
            }
            methodOwner = methodOwner.getParent(context);
        }
        if (method === null || methodOwner === null) {
            throw new InterpreterException(
                "Method '" + methodName + "' not found in parents of '" + owner.name + "'",
                token.cursorPos,
            );
        }

        const thisValue = context._currentThis;
        if (thisValue === null) {
            throw new InterpreterException("'super." + methodName + "' requires 'this' which is not set", token.cursorPos);
        }

        //super.method берёт тело у родителя, но this = текущий instance, чтобы
        //вложенный this.foo() резолвился через цепочку класса instance (JS-семантика).
        this.invokeUserFunction(context, method, parameters, token, thisValue, methodOwner, false);
    }

    /**
     * Обработчик `obj instanceof Class`. Левый операнд лежит на стеке —
     * результат предыдущих узлов выражения. Если объект (или один из его
     * родительских классов в цепочке) совпадает с переданным классом, кладём
     * на стек true. Иначе false. Если obj — не объект пользовательского
     * класса, всегда false (это безопаснее, чем JS TypeError, и удобнее
     * в catch-обработчиках).
     */
    instanceofHandler(context: ContextInterpreter, token: ParseNode) {
        let obj: StackVariable = context.popStackVar();
        if (obj instanceof StackVariableRef) {
            obj = obj.refValue as StackVariable;
        }

        const className = String(token.nValue);
        let classVar: StackVariable | undefined = context.getVariable(className);
        if (!classVar) {
            throw new InterpreterException('Unknown class "' + className + '" in instanceof', token.cursorPos);
        }
        //Function-конструктор: справа лежит обычная функция, использованная
        //как ctor. Берём её класс-обёртку (lazy create) — она и есть то,
        //к чему instance был привязан в newFinishHandler.
        if (classVar instanceof StackVariableUserFunction) {
            classVar = classVar.getOrCreateWrapperClass();
        }
        if (!(classVar instanceof StackVariableClass)) {
            throw new InterpreterException(
                'Right operand of instanceof must be a class, got ' + classVar.typeName,
                token.cursorPos,
            );
        }

        if (!(obj instanceof StackVariableObject)) {
            context.pushStackVar(new StackVariableBoolean(false, false));
            return;
        }

        const instanceClass = obj.getClass();
        if (instanceClass === null) {
            context.pushStackVar(new StackVariableBoolean(false, false));
            return;
        }

        //Ходим по цепочке родителей. Сравниваем по ССЫЛКЕ (===) — это
        //устойчиво даже если в области будут два класса с одинаковым именем
        //(например, локальное переопределение в будущем).
        let cur: StackVariableClass | null = instanceClass;
        let depth = 0;
        while (cur !== null) {
            if (cur === classVar) {
                context.pushStackVar(new StackVariableBoolean(false, true));
                return;
            }
            cur = cur.getParent(context);
            depth++;
            if (depth > StackVariableClass.PARENT_CHAIN_LIMIT) {
                throw new InterpreterException(
                    'Class inheritance chain is too deep or has a cycle',
                    token.cursorPos,
                );
            }
        }

        context.pushStackVar(new StackVariableBoolean(false, false));
    }

    /**
     * Обработчик `let|var|const name [= expr];`. Если инициализатора нет,
     * сразу записываем значение по умолчанию (undefined для var/let, для
     * const парсер этот случай отверг). Иначе открываем sub-кадр, ставим
     * выражение на выполнение, после него `ntVarDeclFinish` снимает значение
     * со стека и записывает его в переменную.
     */
    varDeclHandler(context: ContextInterpreter, token: ParseNode) {
        const kind = String(token.nValue2);
        const name = String(token.nValue);

        if (!token.childItems || token.childItems.length === 0) {
            //Без инициализатора. Для const парсер уже бросил раньше — страховка.
            if (kind === 'const') {
                throw new InterpreterException(
                    "'const' declaration of \"" + name + "\" requires an initializer",
                    token.cursorPos,
                );
            }
            const value = new StackVariableUndefined(false);
            this.writeVarDecl(context, name, kind, value, token);
            return;
        }

        //Есть инициализатор. Открываем sub-кадр для выражения.
        context.pushExecutionStack();
        context._codeItems = [];
        context._codeItems.push(...token.nodeChildren());

        const finish = new InterpreterNode(token.cursorPos);
        finish.nType = InterpreterNodeType.ntVarDeclFinish;
        finish.nValue = name;
        finish.nValue2 = kind;
        context._codeItems.push(finish);
    }

    varDeclFinishHandler(context: ContextInterpreter, token: ParseNode) {
        let value: StackVariable = context.popStackVar();
        if (value instanceof StackVariableRef) {
            value = value.refValue as StackVariable;
        }

        context.popExecutionStack();

        const name = String(token.nValue);
        const kind = String(token.nValue2);

        //Для примитивов — копия (как для параметров функций), чтобы потом
        //присваивание исходной переменной не утащило за собой нашу.
        const type = value.type;
        if (type !== VariableType.vtObject && type !== VariableType.vtArray) {
            value = context.createVariable(type, value.value);
        }

        this.writeVarDecl(context, name, kind, value, token);
    }

    /**
     * Общая запись результата var/let/const-декларации в нужный scope.
     * - var: пишет в ближайший функциональный кадр (`_executionStack` где
     *   `isFunctionScope === true`), либо, если такого нет, в текущий
     *   (top-level) scope.
     * - let/const: пишет в текущий блок, заменяет TDZ-sentinel. Регистрирует
     *   имя в `_letNames` — чтобы при popExecutionStack значение не утекло.
     * - const: пересоздаётся как isConst=true — повторное присваивание через
     *   `name = x` падает с 'Cannot override constant'.
     */
    protected writeVarDecl(
        context: ContextInterpreter,
        name: string,
        kind: string,
        value: StackVariable,
        _token: ParseNode,
    ): void {
        if (kind === 'var') {
            //Var всегда живёт в функциональном scope. Если мы внутри блока
            //(if/while/for/try) уровня функции, нам нужно записать в кадр
            //функции, а не в текущий блок.
            const functionVars = this.locateFunctionScopeVars(context);
            if (functionVars === null) {
                //Top-level: текущий _variables и есть глобальный scope.
                context._variables[name] = value;
            } else {
                //Записываем в нужный кадр _executionStack.
                functionVars[name] = value;
                //Текущий блочный _variables тоже обновляем — иначе getVariable
                //увидит «hoisted undefined» из родителя.
                context._variables[name] = value;
            }
            return;
        }

        let stored: StackVariable;
        if (kind === 'const') {
            stored = this.makeConstCopy(value);
        } else {
            stored = value;
        }

        context._variables[name] = stored;
        //Регистрируем как блочную переменную: не утечёт в parent при pop.
        context._letNames[name] = true;
    }

    /**
     * Ищет в `_executionStack` ближайший вверх кадр функции (isFunctionScope).
     * Возвращает ссылку на его словарь `variables` или null, если такого
     * кадра нет (мы на top-level, нет вложенной функции).
     */
    protected locateFunctionScopeVars(context: ContextInterpreter): Record<string, StackVariable> | null {
        for (let i = context._executionStack.length - 1; i >= 0; i--) {
            if (context._executionStack[i].isFunctionScope === true) {
                return context._executionStack[i].variables;
            }
        }
        return null;
    }

    /**
     * Делает const-копию: тот же тип/значение, но isConst=true.
     * Объекты/массивы/функции остаются по ссылке — const-объект значит
     * запрет на переприсваивание самой переменной, поля можно менять (как в JS).
     */
    protected makeConstCopy(value: StackVariable): StackVariable {
        const type = value.type;
        if (type === VariableType.vtObject || type === VariableType.vtArray || type === VariableType.vtFunction) {
            //Ставим флаг через прямое присваивание приватного _isConst —
            //это наш собственный класс, безопасно.
            (value as unknown as {_isConst: boolean})._isConst = true;
            return value;
        }
        //vtNumber/vtInteger/vtFloat все равны 3 — match по ним даёт алиасы,
        //сравниваем по vtNumber.
        if (type === VariableType.vtNumber) {
            return new StackVariableNumber(true, Number(value.value));
        }
        switch (type) {
            case VariableType.vtString:
                return new StackVariableString(true, String(value.value));
            case VariableType.vtBoolean:
                return new StackVariableBoolean(true, Boolean(value.value));
            case VariableType.vtNull:
                return new StackVariableNull(true);
            case VariableType.vtUndefined:
                return new StackVariableUndefined(true);
            default:
                return value;
        }
    }
}
