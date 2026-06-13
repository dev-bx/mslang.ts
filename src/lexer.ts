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
    'ltLet': 52,
    'ltVar': 53,
    'ltConst': 54,
    //Битовые операции (расширение базового ltBitAnd).
    'ltBitOr': 55,
    'ltBitXor': 56,
    'ltShiftLeft': 57,
    'ltShiftRight': 58,
    'ltUShiftRight': 59,
    //Compound-assignment.
    'ltPlusAssign': 60,
    'ltMinusAssign': 61,
    'ltMulAssign': 62,
    'ltDivAssign': 63,
    'ltModAssign': 64,
    //Тернарный.
    'ltQuestion': 65,
    //Контекстное ключевое слово `of` для for (X of iterable).
    'ltOf': 66,
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

    isHexDigit(ch: unknown) {
        if (typeof ch !== 'string')
            return null;

        const n = ch.charCodeAt(0);

        return (n >= 48 && n <= 57)         //0-9
            || (n >= 65 && n <= 70)         //A-F
            || (n >= 97 && n <= 102);       //a-f
    }

    isOctalDigit(ch: unknown) {
        if (typeof ch !== 'string')
            return null;

        const n = ch.charCodeAt(0);

        return n >= 48 && n <= 55;          //0-7
    }

    isBinaryDigit(ch: unknown) {
        if (typeof ch !== 'string')
            return null;

        return ch === '0' || ch === '1';
    }

    /**
     * Сохраняет состояние лексера для lookahead-парсинга. Используется в
     * parseFor для различения стандартного for и for-of.
     *
     * Зеркало PHP-эталона Lexer::saveState.
     */
    saveState(): Record<string, unknown> {
        return {
            textPos: this._textPos,
            lastChar: this._lastChar,
            lastCursorLine: this._lastCursorLine,
            lastCursorCol: this._lastCursorCol,
            cursorLine: this._cursorLine,
            cursorCol: this._cursorCol,
        };
    }

    restoreState(state: Record<string, unknown>): void {
        this._textPos = state.textPos as number;
        this._lastChar = state.lastChar as (string | null);
        this._lastCursorLine = state.lastCursorLine as number;
        this._lastCursorCol = state.lastCursorCol as number;
        this._cursorLine = state.cursorLine as number;
        this._cursorCol = state.cursorCol as number;
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
        throw new LexerException('Not applicable', this.lastCursorLine, this.lastCursorCol);
    }

    /**
     * Расширение Lexer.saveState — добавляет токен-state (символ + значение).
     * Зеркало PHP CodeLexer::saveState.
     */
    saveState(): Record<string, unknown> {
        const state = super.saveState();
        state.tokenSym = this._tokenSym;
        state.tokenValue = this._tokenValue;
        return state;
    }

    restoreState(state: Record<string, unknown>): void {
        super.restoreState(state);
        if ('tokenSym' in state) this._tokenSym = state.tokenSym as number;
        if ('tokenValue' in state) this._tokenValue = state.tokenValue as string;
    }

    /**
     * Читает «тело» не-десятичного литерала после уже потреблённого префикса
     * (0x, 0b, 0o). Допускает '_' как разделитель между цифрами.
     *
     * После завершения _tokenValue хранит десятичную форму числа (например,
     * '255' для исходного '0xFF_AB' → '65451'). Токен помечается как ltNumeric.
     */
    protected readNonDecimal(kind: 'hex' | 'bin' | 'oct') {
        const isOk = (ch: unknown): boolean => {
            switch (kind) {
                case 'hex': return Boolean(this.isHexDigit(ch));
                case 'oct': return Boolean(this.isOctalDigit(ch));
                case 'bin': return Boolean(this.isBinaryDigit(ch));
            }
        };

        let digits = '';
        if (!isOk(this.whoNextCh())) {
            throw new LexerException('Parse numeric failed: empty ' + kind + ' literal', this.lastCursorLine, this.lastCursorCol);
        }

        while (true) {
            const next = this.whoNextCh();
            if (isOk(next)) {
                this._tokenValue += this.getCh();
                digits += String(next);
                continue;
            }
            if (
                next === '_'
                && digits !== ''
                && isOk(this.whoNextCh(1))
            ) {
                this.getCh();    //проглатываем '_'
                continue;
            }
            break;
        }

        //Конвертируем «исходник 0xFF_AB» в «65451 в десятичной». Базовый
        //путь дальше будет parseFloat-ить _tokenValue.
        const base = kind === 'hex' ? 16 : kind === 'oct' ? 8 : 2;
        this._tokenValue = String(parseInt(digits, base));
    }

    /**
     * После прочтения hex/bin/oct литерала допускает только обычные
     * «стоп-символы» — иначе бросает ту же ошибку, что и десятичная ветка.
     */
    protected finalizeNumber(allowStopChars: string[]) {
        const next = this.whoNextCh();
        if (next === null || allowStopChars.indexOf(next) !== -1) {
            this._tokenSym = LexerType.ltNumeric;
            return;
        }
        throw new LexerException('Parse numeric failed ' + String(next), this.lastCursorLine, this.lastCursorCol);
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
                } else if (this.whoNextCh() === '=') {
                    this.getCh();
                    this._tokenSym = LexerType.ltPlusAssign;
                } else {
                    this._tokenSym = LexerType.ltPlus;
                }
                return;
            case '-':
                if (this.whoNextCh() === '-') {
                    this.getCh();
                    this._tokenSym = LexerType.ltShortDecrement;
                    return;
                } else if (this.whoNextCh() === '=') {
                    this.getCh();
                    this._tokenSym = LexerType.ltMinusAssign;
                    return;
                } else {
                    this._tokenSym = LexerType.ltMinus;
                    return;
                }
            case '/':
                if (this.whoNextCh() === '=') {
                    this.getCh();
                    this._tokenSym = LexerType.ltDivAssign;
                } else {
                    this._tokenSym = LexerType.ltDiv;
                }
                return;
            case '*':
                if (this.whoNextCh() === '=') {
                    this.getCh();
                    this._tokenSym = LexerType.ltMulAssign;
                } else {
                    this._tokenSym = LexerType.ltMul;
                }
                return;
            case '%':
                if (this.whoNextCh() === '=') {
                    this.getCh();
                    this._tokenSym = LexerType.ltModAssign;
                } else {
                    this._tokenSym = LexerType.ltMod;
                }
                return;
            case ',':
                this._tokenSym = LexerType.ltComma;
                return;
            case '^':
                this._tokenSym = LexerType.ltBitXor;
                return;
            case '?':
                this._tokenSym = LexerType.ltQuestion;
                return;
        }

        if (this._lastChar === '<' || this._lastChar === '>') {
            const opChar = this._lastChar;
            this._tokenValue += opChar;

            //Битовые сдвиги: '<<', '>>', '>>>'.
            if (this.whoNextCh() === opChar) {
                this._tokenValue += this.getCh();
                if (opChar === '>' && this.whoNextCh() === '>') {
                    this._tokenValue += this.getCh();
                    this._tokenSym = LexerType.ltUShiftRight;
                    return;
                }
                this._tokenSym = (opChar === '<')
                    ? LexerType.ltShiftLeft
                    : LexerType.ltShiftRight;
                return;
            }

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

        if (this.lastChar === '|') {
            if (this.whoNextCh() === '|') {
                this.getCh();
                this._tokenValue = "";
                this._tokenSym = LexerType.ltCompareOr;
                return;
            }
            //Одиночный '|' — побитовое ИЛИ.
            this._tokenValue = "";
            this._tokenSym = LexerType.ltBitOr;
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
                    throw new LexerException('unexpected end of file', this.lastCursorLine, this.lastCursorCol);

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
            //Префиксы для не-десятичных литералов: 0x.., 0b.., 0o..
            //(только если перед нами '0' и за ним идёт буква-маркер).
            //Numeric separators ('_') допускаются между цифрами в любом из видов.
            const firstNext = this.whoNextCh();
            if (this.lastChar === '0' && (firstNext === 'x' || firstNext === 'X')) {
                this._tokenValue += this.getCh();            //'x' или 'X'
                this.readNonDecimal('hex');
                this.finalizeNumber(allowStopChars);
                return;
            }
            if (this.lastChar === '0' && (firstNext === 'b' || firstNext === 'B')) {
                this._tokenValue += this.getCh();            //'b' или 'B'
                this.readNonDecimal('bin');
                this.finalizeNumber(allowStopChars);
                return;
            }
            if (this.lastChar === '0' && (firstNext === 'o' || firstNext === 'O')) {
                this._tokenValue += this.getCh();            //'o' или 'O'
                this.readNonDecimal('oct');
                this.finalizeNumber(allowStopChars);
                return;
            }

            let isFloat = false;
            let sawExp = false;

            while (true) {
                const nextCh = this.whoNextCh();

                if (this.isDigit(nextCh)) {
                    this._tokenValue += this.getCh();
                    continue;
                }

                //Numeric separator '_' между цифрами: '1_000_000'. По обе
                //стороны должны быть цифры — иначе это не разделитель.
                if (
                    nextCh === '_'
                    && this.isDigit(this._tokenValue.slice(-1))
                    && this.isDigit(this.whoNextCh(1))
                ) {
                    this.getCh();    //проглатываем '_', в _tokenValue не пишем
                    continue;
                }

                if (nextCh === '.') {
                    if (isFloat || sawExp)
                        throw new LexerException("Parse numeric failed", this.lastCursorLine, this.lastCursorCol);
                    this._tokenValue += this.getCh();
                    isFloat = true;
                    continue;
                }

                //Научная нотация: 1e3, 1.5e-3, 2.5E+10.
                if (!sawExp && (nextCh === 'e' || nextCh === 'E')) {
                    //Перед 'e' должна быть цифра (или точка с цифрами слева).
                    const prev = this._tokenValue.slice(-1);
                    if (!this.isDigit(prev) && prev !== '.') {
                        throw new LexerException("Parse numeric failed " + nextCh, this.lastCursorLine, this.lastCursorCol);
                    }
                    this._tokenValue += this.getCh();    //'e' или 'E'
                    sawExp = true;
                    isFloat = true;
                    //Опциональный знак.
                    const sign = this.whoNextCh();
                    if (sign === '+' || sign === '-') {
                        this._tokenValue += this.getCh();
                    }
                    //После 'e' (с возможным знаком) обязана быть хотя бы одна цифра.
                    if (!this.isDigit(this.whoNextCh())) {
                        throw new LexerException("Parse numeric failed: empty exponent", this.lastCursorLine, this.lastCursorCol);
                    }
                    continue;
                }

                if (nextCh === null || allowStopChars.indexOf(nextCh) !== -1) {
                    if (isFloat)
                        this._tokenSym = LexerType.ltFloat;
                    else
                        this._tokenSym = LexerType.ltNumeric;
                    return;
                }

                throw new LexerException("Parse numeric failed " + this.whoNextCh(), this.lastCursorLine, this.lastCursorCol);
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
            throw new LexerException("Parse failed", this.lastCursorLine, this.lastCursorCol);
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

            throw new LexerException("Parse IDStr failed", this.lastCursorLine, this.lastCursorCol);
        }

        if (!this._tokenValue.length) {
            throw new LexerException("syntax error, unexpected token \"" + this.whoNextCh() + "\"", this.lastCursorLine, this.lastCursorCol);
        }

        if (isObjProp && this._tokenValue[this._tokenValue.length - 1] === '.') {
            throw new LexerException("Invalid object property", this.lastCursorLine, this.lastCursorCol);
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

        if (this._tokenValue === "let") {
            this._tokenSym = LexerType.ltLet;
            return;
        }

        if (this._tokenValue === "var") {
            this._tokenSym = LexerType.ltVar;
            return;
        }

        if (this._tokenValue === "const") {
            this._tokenSym = LexerType.ltConst;
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

        //Контекстное ключевое слово для `for (X of iterable)`.
        if (this._tokenValue === "of") {
            this._tokenSym = LexerType.ltOf;
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
