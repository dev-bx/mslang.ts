import {LexerException} from "./exceptions.js";


interface CharMapTable {
    [key: string]: string;
}

export const LexerType = {
    'ltNotSet': 0,
    'ltStartCode': 1,
    'ltEndCode': 2,
    'ltCompare': 3,
    'ltColon': 4,
    'ltSemicolon': 5,
    'ltLPar': 6,
    'ltRPar': 7,
    'ltPlus': 8,
    'ltMinus': 9,
    'ltDiv': 10,
    'ltMul': 11,
    'ltMod': 12,
    'ltBitAnd': 13,
    'ltAssign': 14,
    'ltNameSpace': 15,
    'ltNumeric': 16,
    'ltFloat': 17,
    'ltIDStr': 18,
    'ltObjProp': 19,
    'ltIF': 20,
    'ltELSE': 21,
    'ltComma': 22,
    'ltCompareAnd': 23,
    'ltCompareOr': 24,
    'ltString': 25,
    'ltSwitch': 26,
    'ltCase': 27,
    'ltBreak': 28,
    'ltFor': 29,
    'ltWhile': 30,
    'ltEof': 31,
    'ltShortIncrement': 32,
    'ltShortDecrement': 33,
    'ltNegativeIf': 34,
    'ltBracketOpen': 35,
    'ltBracketClose': 36,
    'ltArrayUnpack': 37,
    'ltArraySeparator': 38,
    'ltContinue': 39,
    'ltDefault': 40,
    'ltFunction': 41,
    'ltTry': 42,
    'ltCatch': 43,
    'ltFinally': 44,
    'ltThrow': 45,
    'ltNew': 46,
    'ltClass': 47,
    'ltThis': 48,
    'ltExtends': 49,
    'ltSuper': 50,
    'ltInstanceof': 51,
}

export class FullTokenInfo {
    tokenValue: string = '';
    lastChar: string | null = null;
    tokenSym: number = 0;
}

export class LexerTypeArray extends Array<number> {
    get asNames() {
        const result: string[] = [],
            k = Object.keys(LexerType),
            v = Object.values(LexerType);

        this.forEach(value => {
            const idx = v.indexOf(value);

            if (idx === -1)
                throw new LexerException('Unknown LexerType ' + value);

            result.push(k[idx]);
        });

        return result;
    }

    static one(value: number) {
        const r = new LexerTypeArray();
        r.push(value);
        return r;
    }

    cloneAdd(value: number | number[]) {
        const r = new LexerTypeArray();

        r.push(...this);

        if (Array.isArray(value)) {
            r.push(...value);
        } else {
            r.push(value);
        }

        return r;
    }
}

export class Lexer {
    _text: string = '';
    _textPos = 0
    _lastChar: string | null = null;
    _lastCursorLine: number = 0;
    _lastCursorCol: number = 0;
    _cursorLine = 1
    _cursorCol = 1

    constructor(text: unknown) {
        if (typeof text !== 'string')
            throw new LexerException('text is not string');

        this._text = text;
    }

    get textPos() {
        return this._textPos;
    }

    get lastChar() {
        return this._lastChar;
    }

    get lastCursorLine() {
        return this._lastCursorLine;
    }

    get lastCursorCol() {
        return this._lastCursorCol;
    }

    get cursorLine() {
        return this._cursorLine;
    }

    get cursorCol() {
        return this._cursorCol;
    }

    getCh() {
        this._lastCursorLine = this.cursorLine;
        this._lastCursorCol = this.cursorCol;

        this._lastChar = this._text.charAt(this._textPos);

        if (this._lastChar === '') {
            this._lastChar = null;
        } else {
            if (this._lastChar === '\n') {
                this._cursorLine++;
                this._cursorCol = 1;
            } else {
                this._cursorCol++;
            }

            this._textPos++;
        }

        return this._lastChar;
    }

    whoNextCh(offset = 0) {
        const ch = this._text.charAt(this._textPos + offset);

        if (ch === '')
            return null;

        return ch;
    }

    isLetter(ch: unknown) {
        if (typeof ch !== 'string')
            return null;

        const n = ch.charCodeAt(0);

        return (n >= 65 && n < 91) || (n >= 97 && n < 123);
    }

    isLetterOrDigit(ch: unknown) {
        if (typeof ch !== 'string')
            return null;

        const n = ch.charCodeAt(0);

        return (n >= 65 && n < 91) || (n >= 97 && n < 123) || (n >= 48 && n <= 57);
    }

    isDigit(ch: unknown) {
        if (typeof ch !== 'string')
            return null;

        const n = ch.charCodeAt(0);

        return (n >= 48 && n <= 57);
    }
}

export class TokenCursor {
    startCursorLine: number | null = null
    startCursorCol: number | null = null
    endCursorLine: number | null = null
    endCursorCol: number | null = null
}

export class CodeLexer extends Lexer {
    _tokenCursor?: TokenCursor
    _tokenValue: string = ''
    _lastChar: string | null
    _tokenSym: number = 0;

    constructor(text: unknown) {
        super(text);

        this._lastChar = null;
    }

    get tokenCursor() {
        if (!this._tokenCursor)
            throw new LexerException('token cursor is not initialized.');

        return this._tokenCursor;
    }

    get tokenValue() {
        return this._tokenValue;
    }

    get lastChar() {
        return this._lastChar;
    }

    get tokenSym() {
        return this._tokenSym;
    }

    get tokenName() {
        const idx = Object.values(LexerType).indexOf(this._tokenSym);

        if (idx === -1)
            return 'Unknown';

        return Object.keys(LexerType)[idx];
    }


    indexOfAny(chars: string[], fromPos = 0) {
        const result: number[] = [];

        chars.forEach(ch => {
            const i = this._text.indexOf(ch, fromPos);

            if (i > -1)
                result.push(i);
        });

        return result;
    }

    indexOfAnyFirst(chars: string[], fromPos = 0) {
        const result = this.indexOfAny(chars, fromPos);

        if (!result.length)
            return -1;

        return Math.min(...result);
    }

    getPCHValue(pch: unknown): string {
        throw new LexerException('Not applicable');
    }

    getRealToken() {
        switch (this._lastChar) {
            case '{':
                this._tokenSym = LexerType.ltStartCode;
                return;
            case '}':
                this._tokenSym = LexerType.ltEndCode;
                return;
            case ';':
                this._tokenSym = LexerType.ltSemicolon;
                return;
            case '(':
                this._tokenSym = LexerType.ltLPar;
                return;
            case ')':
                this._tokenSym = LexerType.ltRPar;
                return;
            case '[':
                this._tokenSym = LexerType.ltBracketOpen;
                return;
            case ']':
                this._tokenSym = LexerType.ltBracketClose;
                return;
            case '+':
                if (this.whoNextCh() === '+') {
                    this.getCh();
                    this._tokenSym = LexerType.ltShortIncrement;
                } else {
                    this._tokenSym = LexerType.ltPlus;
                }

                return;
            case '-':
                if (this.whoNextCh() === '-') {
                    this.getCh();
                    this._tokenSym = LexerType.ltShortDecrement;
                    return;
                } else {
                    this._tokenSym = LexerType.ltMinus;
                    return;
                }
            case '/':
                this._tokenSym = LexerType.ltDiv;
                return;
            case '*':
                this._tokenSym = LexerType.ltMul;
                return;
            case '%':
                this._tokenSym = LexerType.ltMod;
                return;
            case ',':
                this._tokenSym = LexerType.ltComma;
                return;
        }

        if (this._lastChar === '<' || this._lastChar === '>') {
            this._tokenValue += this._lastChar;

            if (this.whoNextCh() === '=')
                this._tokenValue += this.getCh();
            this._tokenSym = LexerType.ltCompare;
            return;
        }

        if (this._lastChar === '=') {
            this._tokenValue += this._lastChar;

            switch (this.whoNextCh()) {
                case '=':
                    this._tokenValue += this.getCh();
                    this._tokenSym = LexerType.ltCompare;
                    break;
                case '>':
                    this._tokenValue += this.getCh();
                    this._tokenSym = LexerType.ltArraySeparator;
                    break;
                default:
                    this._tokenSym = LexerType.ltAssign;
            }

            return;
        }

        if (this.lastChar === '!') {
            this._tokenValue += this.lastChar;

            if (this.whoNextCh() === '=') {
                this._tokenValue += this.getCh();
                this._tokenSym = LexerType.ltCompare;
                return;
            } else {
                this._tokenSym = LexerType.ltNegativeIf;
                return;
            }
        }

        if (this.lastChar === ':') {
            if (this.whoNextCh() === ':') {
                this.getCh();
                this._tokenValue = "";
                this._tokenSym = LexerType.ltNameSpace;
                return;
            } else {
                this._tokenValue = "";
                this._tokenSym = LexerType.ltColon;
                return;
            }

        }

        if (this.lastChar === '&') {
            if (this.whoNextCh() === '&') {
                this.getCh();
                this._tokenValue = "";
                this._tokenSym = LexerType.ltCompareAnd;
            } else {
                this._tokenValue = "";
                this._tokenSym = LexerType.ltBitAnd;
            }
            return;
        }

        if (this.lastChar === '|' && this.whoNextCh() === '|') {
            this.getCh();
            this._tokenValue = "";
            this._tokenSym = LexerType.ltCompareOr;
            return;
        }

        if (this.lastChar === '"' || this.lastChar === '\'') {
            const strSym = this.lastChar;
            let strSpecSym:CharMapTable = {};

            if (this.lastChar === '"') {
                strSpecSym = {
                    't': '\t',
                    'r': '\r',
                    'n': '\n',
                    '\\': '\\',
                }
            }

            while (true) {
                this.getCh();

                if (this.lastChar === null)
                    throw new LexerException('unexpected end of file');

                if (this.lastChar as string === '\\') {
                    if (this.whoNextCh() === strSym) {
                        this._tokenValue += this.getCh();
                        continue;
                    }

                    const nextCh = this.whoNextCh();

                    if (nextCh !== null && strSpecSym.hasOwnProperty(nextCh)) {
                        this.getCh();
                        this._tokenValue += strSpecSym[nextCh];
                        continue;
                    }
                }

                if (this.lastChar === strSym) {
                    this._tokenSym = LexerType.ltString;
                    return;
                }

                /*
                if (this.lastChar === '\r' || this.lastChar === '\n')
                {
                    throw new LexerException("Invalid string");
                }
                 */

                this._tokenValue += this.lastChar;
            }
        }

        this._tokenValue += this.lastChar;

        const allowStopChars = ['{', '}', '(', ')', ';', '-', '+', '*', '/', '=', '<', '>', '\r', '\n', ':', ' ', ',', '!', '[', ']'];

        if (this.isDigit(this.lastChar) || this.lastChar === '-') {
            let isFloat = false;

            while (true) {
                const nextCh = this.whoNextCh();

                if (this.isDigit(nextCh)) {
                    this._tokenValue += this.getCh();
                    continue;
                }

                if (nextCh === '.') {
                    if (isFloat)
                        throw new LexerException("Parse numeric failed");
                    this._tokenValue += this.getCh();
                    isFloat = true;
                    continue;
                }

                if (nextCh === null || allowStopChars.indexOf(nextCh) !== -1) {
                    if (isFloat)
                        this._tokenSym = LexerType.ltFloat;
                    else
                        this._tokenSym = LexerType.ltNumeric;
                    return;
                }

                throw new LexerException("Parse numeric failed " + this.whoNextCh());
            }
        }

        if (this.lastChar === '@') {
            while (true) {
                if (this.isLetterOrDigit(this.whoNextCh()) || this.whoNextCh() === '_') {
                    this._tokenValue += this.getCh();

                    continue;
                }

                this._tokenValue = this.getPCHValue(this._tokenValue);
                this._tokenSym = LexerType.ltNumeric;
                return;
            }
        }

        if (!this.isLetter(this.lastChar) && this.lastChar !== '.') {
            throw new LexerException("Parse failed");
        }

        const isObjProp = this._tokenValue === '.';

        if (isObjProp && this.whoNextCh(0) === '.' && this.whoNextCh(1) === '.') {
            this.getCh(); // skip dot
            this.getCh(); // skip dot
            this._tokenSym = LexerType.ltArrayUnpack;
            return;
        }

        if (isObjProp)
            this._tokenValue = '';

        while (true) {
            const nextCh = this.whoNextCh();

            if (this.isLetterOrDigit(nextCh) || nextCh === '_') {
                this._tokenValue += this.getCh();

                continue;
            }

            if (nextCh === '.') {
                break;
            }

            if (nextCh !== null && allowStopChars.indexOf(nextCh) !== -1) {
                break;
            }

            throw new LexerException("Parse IDStr failed");
        }

        if (!this._tokenValue.length) {
            throw new LexerException("syntax error, unexpected token \"" + this.whoNextCh() + "\"");
        }

        if (isObjProp && this._tokenValue[this._tokenValue.length - 1] === '.') {
            throw new LexerException("Invalid object property");
        }

        if (this._tokenValue === "if") {
            this._tokenSym = LexerType.ltIF;
            return;
        }

        if (this._tokenValue === "else") {
            this._tokenSym = LexerType.ltELSE;
            return;
        }

        if (this._tokenValue === "switch") {
            this._tokenSym = LexerType.ltSwitch;
            return;
        }

        if (this._tokenValue === "case") {
            this._tokenSym = LexerType.ltCase;
            return;
        }

        if (this._tokenValue === "default") {
            this._tokenSym = LexerType.ltDefault;
            return;
        }

        if (this._tokenValue === "function") {
            this._tokenSym = LexerType.ltFunction;
            return;
        }

        if (this._tokenValue === "try") {
            this._tokenSym = LexerType.ltTry;
            return;
        }

        if (this._tokenValue === "catch") {
            this._tokenSym = LexerType.ltCatch;
            return;
        }

        if (this._tokenValue === "finally") {
            this._tokenSym = LexerType.ltFinally;
            return;
        }

        if (this._tokenValue === "throw") {
            this._tokenSym = LexerType.ltThrow;
            return;
        }

        if (this._tokenValue === "new") {
            this._tokenSym = LexerType.ltNew;
            return;
        }

        if (this._tokenValue === "class") {
            this._tokenSym = LexerType.ltClass;
            return;
        }

        if (this._tokenValue === "this") {
            this._tokenSym = LexerType.ltThis;
            return;
        }

        if (this._tokenValue === "extends") {
            this._tokenSym = LexerType.ltExtends;
            return;
        }

        if (this._tokenValue === "super") {
            this._tokenSym = LexerType.ltSuper;
            return;
        }

        if (this._tokenValue === "instanceof") {
            this._tokenSym = LexerType.ltInstanceof;
            return;
        }

        if (this._tokenValue === "break") {
            this._tokenSym = LexerType.ltBreak;
            return;
        }

        if (this._tokenValue === "continue") {
            this._tokenSym = LexerType.ltContinue;
            return;
        }

        if (this._tokenValue === "for") {
            this._tokenSym = LexerType.ltFor;
            return;
        }

        if (this._tokenValue === "while") {
            this._tokenSym = LexerType.ltWhile;
            return;
        }

        if (isObjProp) {
            this._tokenSym = LexerType.ltObjProp;
        } else {
            this._tokenSym = LexerType.ltIDStr;
        }
    }

    getToken() {
        this._tokenCursor = undefined;
        this._tokenValue = '';

        while (true) {
            this.getCh();

            if (this.lastChar === null) {
                this._tokenSym = LexerType.ltEof;
                return;
            }

            if (this.lastChar === ' ' || this.lastChar === '\r' || this.lastChar === '\n' || this.lastChar === '\t')
                continue;

            if (this.lastChar === '/' && this.whoNextCh() === '/') {
                let pos = this.indexOfAnyFirst(['\r', '\n'], this._textPos);

                // Комментарий // в конце файла без перевода строки —
                // нормальный код, просто перематываем курсор до конца текста,
                // тогда следующий getCh() вернёт null и токенизация даст ltEof.
                if (pos === -1)
                    pos = this._text.length;

                this._textPos = pos;
                continue;
            }

            break;
        }

        const tokenCursor = new TokenCursor();
        tokenCursor.startCursorLine = this.lastCursorLine;
        tokenCursor.startCursorCol = this.lastCursorCol;

        this.getRealToken();

        tokenCursor.endCursorLine = this.lastCursorLine;
        tokenCursor.endCursorCol = this.lastCursorCol;

        this._tokenCursor = tokenCursor;
    }

    getFullToken() {
        this.getToken();

        const info = new FullTokenInfo();
        info.tokenValue = this._tokenValue;
        info.lastChar = this._lastChar;
        info.tokenSym = this._tokenSym;

        return info;
    }
}
