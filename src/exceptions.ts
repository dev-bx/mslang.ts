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