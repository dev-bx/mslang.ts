import {TokenCursor} from "./lexer";
import type {ParseNode} from "./parser";

// Зеркало PHP Exception/ErrorCode: машинные коды ошибок MSLang. Хост строит на них
// свою реакцию на ошибку формулы, не разбирая текст сообщения. Набор и написание —
// бит-в-бит с PHP.
export const ErrorCode = {
    /** Ошибка разбора исходника (лексер или парсер). */
    ParseError: 'ParseError',
    /** Ошибка исполнения без более точного кода. */
    RuntimeError: 'RuntimeError',
    /** Условие (`if`, `while`, `for`, `?:`, `!`, `&&`, `||`, колбэк-условие) получило не boolean. */
    NotBoolean: 'NotBoolean',
    /** Операция не определена для типов операндов (`"a" + 1`, `null > 0`). */
    TypeMismatch: 'TypeMismatch',
    /** Неизвестное имя: переменная, функция, метод, класс. */
    UnknownName: 'UnknownName',
    /** Вызов значения, которое не является функцией или конструктором. */
    NotCallable: 'NotCallable',
    /** Повторная регистрация имени хостом без разрешения на замену. */
    DuplicateName: 'DuplicateName',
    /** Исчерпан лимит числа шагов исполнения. */
    StepLimit: 'StepLimit',
    /** Исчерпан лимит времени исполнения. */
    TimeLimit: 'TimeLimit',
    /** Исчерпан лимит объёма создаваемых данных. */
    AllocLimit: 'AllocLimit',
    /** Скрипт бросил значение через `throw`, и его никто не поймал. */
    Thrown: 'Thrown',
} as const;

export type ErrorCodeValue = typeof ErrorCode[keyof typeof ErrorCode];

// Зеркало PHP MSLangException: машинный код ошибки и место в исходнике. Текст
// сообщения прежний (с приставкой [строка:столбец], если место известно).
export class MSLangException extends Error {

    static readonly DEFAULT_CODE: ErrorCodeValue = ErrorCode.RuntimeError;

    _errorCode: ErrorCodeValue
    _rawMessage: string
    _sourceLine: number | null = null
    _sourceColumn: number | null = null
    _sourceEndLine: number | null = null
    _sourceEndColumn: number | null = null

    constructor(message: string = '', errorCode?: ErrorCodeValue | null, cursor?: TokenCursor | null) {
        const rawMessage = message;
        let line: number | null = null, column: number | null = null;
        if (cursor && cursor.startCursorLine && cursor.startCursorCol) {
            line = cursor.startCursorLine;
            column = cursor.startCursorCol;
            message = '[' + line + ':' + column + '] ' + message;
        }

        super(message);

        this._errorCode = errorCode ?? (this.constructor as typeof MSLangException).DEFAULT_CODE;
        this._rawMessage = rawMessage;
        if (line !== null && column !== null && cursor) {
            this._sourceLine = line;
            this._sourceColumn = column;
            this._sourceEndLine = cursor.endCursorLine || line;
            this._sourceEndColumn = cursor.endCursorCol || column;
        }
    }

    getErrorCode(): ErrorCodeValue
    {
        return this._errorCode;
    }

    /** Сообщение без приставки `[строка:столбец]`. */
    getRawMessage(): string
    {
        return this._rawMessage;
    }

    getSourceLine(): number | null
    {
        return this._sourceLine;
    }

    getSourceColumn(): number | null
    {
        return this._sourceColumn;
    }

    getSourceEndLine(): number | null
    {
        return this._sourceEndLine;
    }

    getSourceEndColumn(): number | null
    {
        return this._sourceEndColumn;
    }

    /** Всё об ошибке одним объектом — для журналов и ответов API. */
    toArray(): {code: ErrorCodeValue, message: string, line: number | null, column: number | null, endLine: number | null, endColumn: number | null}
    {
        return {
            code: this._errorCode,
            message: this._rawMessage,
            line: this._sourceLine,
            column: this._sourceColumn,
            endLine: this._sourceEndLine,
            endColumn: this._sourceEndColumn,
        };
    }

}

export class LexerException extends MSLangException {

    static override readonly DEFAULT_CODE: ErrorCodeValue = ErrorCode.ParseError;

    _cursorLine
    _cursorColumn
    constructor(message: string = '', cursorLine: number = 0, cursorColumn: number = 0, errorCode?: ErrorCodeValue | null) {
        // Зеркало PHP LexerException: позиция собирается в TokenCursor и уходит в базовый класс.
        const cursor = new TokenCursor();
        cursor.startCursorLine = cursorLine || null;
        cursor.startCursorCol = cursorColumn || null;

        super(message, errorCode, cursor);

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
    constructor(message: string, cursorPosition?: TokenCursor, errorCode?: ErrorCodeValue | null) {
        super(message, errorCode, cursorPosition);

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

    static override readonly DEFAULT_CODE: ErrorCodeValue = ErrorCode.ParseError;

    _cursor
    constructor(message: string, cursor?: TokenCursor, errorCode?: ErrorCodeValue | null) {
        super(message, errorCode, cursor);

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

    static override readonly DEFAULT_CODE: ErrorCodeValue = ErrorCode.ParseError;

    _node
    constructor(message: string, node?: ParseNode | false | null, errorCode?: ErrorCodeValue | null) {
        super(message, errorCode, node ? node.cursorPos : null);

        this._node = node;
    }

    getNode()
    {
        return this._node;
    }

}
