import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";

/**
 * Зеркало PHP UrlFunctions. Namespace-объект `Url`: `Url.encode`/`Url.decode` ровно как
 * JS `encodeURIComponent`/`decodeURIComponent`. Регистрируется под именем `"Url"`.
 *
 * Собрано вручную на UTF-8 байтах (а не нативно), чтобы совпадать с PHP-эталоном бит-в-бит,
 * включая мягкий разбор: неполная `%XX`-последовательность остаётся как есть (не падает).
 */
export class UrlFunctions extends StackVariable {
    private static readonly UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()";

    constructor() {
        super(VariableType.vtObject, true);
    }

    /** `Url.encode(str)` — как JS encodeURIComponent (UTF-8 байты → %XX, верхний регистр). */
    funcInvoke_encodeReturn = () => VariableType.vtString;

    funcInvoke_encode(...args: unknown[]): string {
        const bytes = new TextEncoder().encode(UrlFunctions.argToString(args[0]));

        let out = '';
        for (const b of bytes) {
            const ch = String.fromCharCode(b);
            if (b < 0x80 && UrlFunctions.UNRESERVED.indexOf(ch) >= 0) {
                out += ch;
            } else {
                out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
            }
        }
        return out;
    }

    /** `Url.decode(str)` — как JS decodeURIComponent: %XX → байт. '+' не трогаем. */
    funcInvoke_decodeReturn = () => VariableType.vtString;

    funcInvoke_decode(...args: unknown[]): string {
        const inBytes = new TextEncoder().encode(UrlFunctions.argToString(args[0]));

        const out: number[] = [];
        const len = inBytes.length;
        for (let i = 0; i < len; i++) {
            if (inBytes[i] === 0x25 /* % */ && i + 2 < len
                && UrlFunctions.isHexByte(inBytes[i + 1]) && UrlFunctions.isHexByte(inBytes[i + 2])) {
                out.push((UrlFunctions.hexVal(inBytes[i + 1]) << 4) | UrlFunctions.hexVal(inBytes[i + 2]));
                i += 2;
            } else {
                out.push(inBytes[i]);
            }
        }
        return new TextDecoder().decode(new Uint8Array(out));
    }

    private static isHexByte(b: number): boolean {
        return (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66);
    }

    private static hexVal(b: number): number {
        if (b >= 0x30 && b <= 0x39) return b - 0x30;
        if (b >= 0x41 && b <= 0x46) return b - 0x41 + 10;
        return b - 0x61 + 10;
    }

    private static argToString(arg: unknown): string {
        if (arg instanceof StackVariable) {
            const asString = arg.castAs(VariableType.vtString);
            return asString ? String(asString.value) : '';
        }
        return '';
    }
}
