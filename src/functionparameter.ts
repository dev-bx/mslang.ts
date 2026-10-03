import type {ContextInterpreter} from "./contextinterpreter.js";
import {VariableType} from "./variabletype.js";
import {MSLangException} from "./exceptions";

export class FunctionParameter {

    _name
    _type
    _isRequired
    _defaultValue
    _isPassedByReference

    // Тип по умолчанию — null («любой»), как PHP `?int $_type = null` (раньше было vtUndefined).
    constructor(name: string, type: VariableType | null = null, isRequired = false, isPassedByReference = false, defaultValue: unknown = null) {

        this._name = name;
        this._type = type;
        this._isRequired = isRequired;
        this._isPassedByReference = isPassedByReference;
        this._defaultValue = defaultValue;

    }

    getName()
    {
        return this._name;
    }

    getType(): VariableType | null
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

        // Значение по умолчанию без типа создать нельзя — ошибка описания функции хостом.
        const type = this.getType();
        if (type === null)
            throw new MSLangException('Parameter "' + this._name + '" has a default value but no type');

        return context.createVariable(type, value);
    }

}