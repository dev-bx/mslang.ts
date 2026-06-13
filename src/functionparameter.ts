import type {ContextInterpreter} from "./contextinterpreter.js";
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

    isPassedByReference()
    {
        return this._isPassedByReference;
    }

    getDefaultValue()
    {
        return this._defaultValue;
    }

    createVariableDefaultValue(context: ContextInterpreter)
    {
        // Зеркало PHP: создаём через контекст, чтобы дефолт-строки/массивы
        // попадали в бюджет данных (раньше звался статический createVariable).
        const value = this.getDefaultValue();

        if (value === null)
            return context.createVariable(VariableType.vtNull, null);

        return context.createVariable(this.getType(), value);
    }

}