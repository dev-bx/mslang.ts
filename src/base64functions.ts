import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";

/**
 * Зеркало PHP Base64Functions. Namespace-объект `Base64`: `Base64.encode(str)` /
 * `Base64.decode(str)`. Регистрируется в `registerConst()` под именем `"Base64"`.
 *
 * Алгоритм собран вручную (а не `btoa`/`atob`), на UTF-8 байтах строки — поэтому PHP и
 * TS дают бит-в-бит одно и то же и одинаково игнорируют мусор при разборе. Текст (валидный
 * UTF-8) round-trip'ится точно; произвольные двоичные данные — вне сферы (язык строковый).
 */
export class Base64Functions extends StackVariable {
    private static readonly ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    constructor() {
        super(VariableType.vtObject, true);
    }

    /** `Base64.encode(str)` — base64 от UTF-8 байт строки. */
    funcInvoke_encodeReturn = () => VariableType.vtString;

    funcInvoke_encode(...args: unknown[]): string {
        const bytes = new TextEncoder().encode(Base64Functions.argToString(args[0]));
        return Base64Functions.encodeBytes(bytes);
    }

    /** `Base64.decode(str)` — из base64 обратно в строку. Символы вне алфавита игнорируются. */
    funcInvoke_decodeReturn = () => VariableType.vtString;

    funcInvoke_decode(...args: unknown[]): string {
        const bytes = Base64Functions.decodeToBytes(Base64Functions.argToString(args[0]));
        return new TextDecoder().decode(bytes);
    }

    private static encodeBytes(bytes: Uint8Array): string {
        const a = Base64Functions.ALPHABET;
        let out = '';
        const len = bytes.length;
        for (let i = 0; i < len; i += 3) {
            const b0 = bytes[i];
            const b1 = i + 1 < len ? bytes[i + 1] : 0;
            const b2 = i + 2 < len ? bytes[i + 2] : 0;

            out += a[b0 >> 2];
            out += a[((b0 & 0x03) << 4) | (b1 >> 4)];
            out += i + 1 < len ? a[((b1 & 0x0F) << 2) | (b2 >> 6)] : '=';
            out += i + 2 < len ? a[b2 & 0x3F] : '=';
        }
        return out;
    }

    private static decodeToBytes(text: string): Uint8Array {
        const a = Base64Functions.ALPHABET;

        let clean = '';
        for (const ch of text) {
            if (a.indexOf(ch) >= 0) {
                clean += ch;
            }
        }

        const out: number[] = [];
        const len = clean.length;
        for (let i = 0; i + 1 < len; i += 4) {
            const c0 = a.indexOf(clean[i]);
            const c1 = a.indexOf(clean[i + 1]);
            const c2 = i + 2 < len ? a.indexOf(clean[i + 2]) : -1;
            const c3 = i + 3 < len ? a.indexOf(clean[i + 3]) : -1;

            out.push((c0 << 2) | (c1 >> 4));
            if (c2 >= 0) {
                out.push(((c1 & 0x0F) << 4) | (c2 >> 2));
            }
            if (c3 >= 0) {
                out.push(((c2 & 0x03) << 6) | c3);
            }
        }
        return new Uint8Array(out);
    }

    private static argToString(arg: unknown): string {
        if (arg instanceof StackVariable) {
            const asString = arg.castAs(VariableType.vtString);
            return asString ? String(asString.value) : '';
        }
        return '';
    }
}
