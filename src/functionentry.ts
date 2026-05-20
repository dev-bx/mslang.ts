import {FunctionParameter} from "./functionparameter.js";
import {StackVariable} from "./stackvariable";
import {VariableType} from "./variabletype";
import {MSLangException} from "./exceptions";

type InvokeCallback = (this: any, ...args: InvokeArguments[]) => any;

export class FunctionEntry {
    _name: string
    _parameters: FunctionParameter[]
    _returnType: VariableType
    _invoke: InvokeCallback;

    constructor(name: string, returnType = VariableType.vtVoid, invoke: InvokeCallback) {
        this._name = name;
        this._returnType = returnType;
        this._parameters = [];
        this._invoke = invoke;
    }

    getName()
    {
        return this._name;
    }

    addParameter(name: string|FunctionParameter, type?: VariableType, isRequired = false, isPassedByReference = false, defaultValue = null)
    {
        if (isRequired && this._parameters.length>0) {

            const lastParameter = this._parameters.at(-1) as FunctionParameter;

            if (!lastParameter.isRequired()) {
                throw new MSLangException('Previous parameter not required');
            }
        }

        if (name instanceof FunctionParameter)
        {
            this._parameters.push(name);
        } else {
            this._parameters.push(new FunctionParameter(name, type, isRequired, isPassedByReference, defaultValue));
        }

        return this;
    }

    getParameters()
    {
        return this._parameters;
    }

    getReturnType(): VariableType
    {
        return this._returnType;
    }

    getRequiredCount()
    {
        return this.getParameters().filter(p => p.isRequired()).length;
    }

    invokeArguments(callArguments: InvokeArguments)
    {
        return this._invoke.apply(this, callArguments);
    }

    setInvoke(invoke: InvokeCallback)
    {
        this._invoke = invoke;
    }
}