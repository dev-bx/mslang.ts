import {TokenCursor} from "./lexer";
import type {ParseNode} from "./parser";

export class MSLangException extends Error {

}

export class LexerException extends MSLangException {

    _cursorLine
    _cursorColumn
    constructor(message: string = '', cursorLine: number = 0, cursorColumn: number = 0) {
        // Зеркало PHP LexerException: префикс [строка:столбец] при наличии позиции.
        if (cursorLine && cursorColumn) {
            message = '[' + cursorLine + ':' + cursorColumn + '] ' + message;
        }

        super(message);

        this._cursorLine = cursorLine;
        this._cursorColumn = cursorColumn;
    }

    getCursorLine()
    {
        return this._cursorLine;
    }

    getCursorColumn()
    {
        return this._cursorColumn;
    }

}

// Зеркало PHP ContextException — ошибки контекста выполнения (стек, область
// видимости, переопределение константы, неизвестная функция/переменная).
export class ContextException extends MSLangException {

}

export class InterpreterException extends MSLangException {

    _cursorPosition
    constructor(message: string, cursorPosition?: TokenCursor) {
        // Зеркало PHP: к сообщению приписывается позиция [строка:столбец], если она есть.
        if (cursorPosition && cursorPosition.startCursorLine && cursorPosition.startCursorCol) {
            message = '[' + cursorPosition.startCursorLine + ':' + cursorPosition.startCursorCol + '] ' + message;
        }

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
// (TokenCursor) в исходнике. Использовать вместо голого `new Error(...)`.
export class ParserCursorException extends MSLangException {

    _cursor
    constructor(message: string, cursor?: TokenCursor) {
        // Зеркало PHP ParserCursorException: префикс [строка:столбец] при наличии позиции.
        if (cursor && cursor.startCursorLine && cursor.startCursorCol) {
            message = '[' + cursor.startCursorLine + ':' + cursor.startCursorCol + '] ' + message;
        }

        super(message);

        this._cursor = cursor;
    }

    getCursor()
    {
        return this._cursor;
    }

}

// Зеркало PHP ParserNodeException — ошибка парсера с привязкой к узлу разбора
// (ParseNode). Позиция [строка:столбец] берётся из cursorPos узла.
export class ParserNodeException extends MSLangException {

    _node
    constructor(message: string, node?: ParseNode | false | null) {
        const cursor = node ? node.cursorPos : null;
        if (cursor && cursor.startCursorLine && cursor.startCursorCol) {
            message = '[' + cursor.startCursorLine + ':' + cursor.startCursorCol + '] ' + message;
        }

        super(message);

        this._node = node;
    }

    getNode()
    {
        return this._node;
    }

}