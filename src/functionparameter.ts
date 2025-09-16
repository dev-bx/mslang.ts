import {ContextInterpreter} from "./interpreter.js";
import {VariableType} from "./variabletype.js";

export class FunctionParameter {

    _name
    _type
    _isRequired
    _defaultValue
    _isPassedByReference

    constructor(name: string, type: VariableType = VariableType.vtUndefined, isRequired = false, isPassedByReference = false, defaultValue: unknown = null) {

        this._name = name;
        this._type = type;
        this._isRequired = isRequired;
        this._isPassedByReference = isPassedByReference; // @TODO
        this._defaultValue = defaultValue;

    }

    getName()
    {
        return this._name;
    }

    getType()
    {
        return this._type;
    }

    isRequired()
    {
        return this._isRequired;
    }

    getDefaultValue()
    {
        return this._defaultValue;
    }

    createVariableDefaultValue()
    {
        let value = this.getDefaultValue();

        if (value === null)
            return ContextInterpreter.createVariable(VariableType.vtNull, null);

        return ContextInterpreter.createVariable(this.getType(), value);
    }

}