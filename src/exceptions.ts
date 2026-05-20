import {TokenCursor} from "./lexer";

export class MSLangException extends Error {

}

export class LexerException extends MSLangException {

}

export class InterpreterException extends MSLangException {

    _cursorPosition
    constructor(message: string, cursorPosition?: TokenCursor) {
        super(message);

        this._cursorPosition = cursorPosition;
    }

    getCursorPosition()
    {
        return this._cursorPosition;
    }

}

// Зеркало PHP ParserCursorException — ошибка парсера с привязкой к позиции
// в исходнике. Использовать вместо голого `new Error(...)`.
export class ParserException extends MSLangException {

    _cursorPosition
    constructor(message: string, cursorPosition?: TokenCursor) {
        super(message);

        this._cursorPosition = cursorPosition;
    }

    getCursorPosition()
    {
        return this._cursorPosition;
    }

}