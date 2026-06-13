import {TokenCursor} from "./lexer";

export class MSLangException extends Error {

}

export class LexerException extends MSLangException {

}

// Зеркало PHP ContextException — ошибки контекста выполнения (стек, область
// видимости, переопределение константы, неизвестная функция/переменная).
export class ContextException extends MSLangException {

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

// Зеркало PHP ResourceLimitException — превышение ресурсного лимита песочницы
// (инструкции / время / создаваемые данные). Скриптовый try/catch его НЕ ловит:
// ContextInterpreter.exec пробрасывает наружу, минуя оборачивание в Error-объект,
// иначе скрипт перехватил бы собственную остановку и продолжил работу.
export class ResourceLimitException extends InterpreterException {

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