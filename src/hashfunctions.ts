import {StackVariable} from "./stackvariable.js";
import {VariableType} from "./variabletype.js";

/**
 * Зеркало PHP HashFunctions. Namespace-объект `Hash`: `Hash.md5`/`Hash.sha1` (hex-строка,
 * нижний регистр) и `Hash.crc32` (беззнаковое 32-битное число). Считается по UTF-8 байтам.
 *
 * В PHP это встроенные функции; здесь — ручная реализация (в браузере нет зависимостей).
 * У md5/sha1/crc32 результат канонический и единственно верный, поэтому совпадает с PHP
 * бит-в-бит. Константы md5/sha1 зашиты таблицами (НЕ через Math.sin) — иначе 1 ULP в sin
 * мог бы сломать значение на другой платформе.
 */
export class HashFunctions extends StackVariable {
    constructor() {
        super(VariableType.vtObject, true);
    }

    funcInvoke_md5Return = () => VariableType.vtString;

    funcInvoke_md5(...args: unknown[]): string {
        return HashFunctions.md5(new TextEncoder().encode(HashFunctions.argToString(args[0])));
    }

    funcInvoke_sha1Return = () => VariableType.vtString;

    funcInvoke_sha1(...args: unknown[]): string {
        return HashFunctions.sha1(new TextEncoder().encode(HashFunctions.argToString(args[0])));
    }

    funcInvoke_crc32Return = () => VariableType.vtNumber;

    funcInvoke_crc32(...args: unknown[]): number {
        return HashFunctions.crc32(new TextEncoder().encode(HashFunctions.argToString(args[0])));
    }

    private static crc32(bytes: Uint8Array): number {
        let c = ~0;
        for (let i = 0; i < bytes.length; i++) {
            c ^= bytes[i];
            for (let k = 0; k < 8; k++) {
                c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
            }
        }
        return (~c) >>> 0;
    }

    private static readonly MD5_K = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
    ];

    private static readonly MD5_S = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];

    private static md5(bytes: Uint8Array): string {
        const msg = HashFunctions.padMessage(bytes, true); //длина в little-endian

        let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
        const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));

        for (let off = 0; off < msg.length; off += 64) {
            const m = new Array<number>(16);
            for (let i = 0; i < 16; i++) {
                const j = off + i * 4;
                m[i] = (msg[j]) | (msg[j + 1] << 8) | (msg[j + 2] << 16) | (msg[j + 3] << 24);
            }

            let a = a0, b = b0, c = c0, d = d0;
            for (let i = 0; i < 64; i++) {
                let f: number, g: number;
                if (i < 16) {
                    f = (b & c) | (~b & d);
                    g = i;
                } else if (i < 32) {
                    f = (d & b) | (~d & c);
                    g = (5 * i + 1) % 16;
                } else if (i < 48) {
                    f = b ^ c ^ d;
                    g = (3 * i + 5) % 16;
                } else {
                    f = c ^ (b | ~d);
                    g = (7 * i) % 16;
                }
                f = (f + a + HashFunctions.MD5_K[i] + m[g]) | 0;
                a = d;
                d = c;
                c = b;
                b = (b + rotl(f, HashFunctions.MD5_S[i])) | 0;
            }

            a0 = (a0 + a) | 0;
            b0 = (b0 + b) | 0;
            c0 = (c0 + c) | 0;
            d0 = (d0 + d) | 0;
        }

        return HashFunctions.toHexLE(a0) + HashFunctions.toHexLE(b0) + HashFunctions.toHexLE(c0) + HashFunctions.toHexLE(d0);
    }

    private static sha1(bytes: Uint8Array): string {
        const msg = HashFunctions.padMessage(bytes, false); //длина в big-endian

        let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
        const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));

        for (let off = 0; off < msg.length; off += 64) {
            const w = new Array<number>(80);
            for (let i = 0; i < 16; i++) {
                const j = off + i * 4;
                w[i] = (msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | (msg[j + 3]);
            }
            for (let i = 16; i < 80; i++) {
                w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
            }

            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let i = 0; i < 80; i++) {
                let f: number, k: number;
                if (i < 20) {
                    f = (b & c) | (~b & d);
                    k = 0x5A827999;
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ED9EBA1;
                } else if (i < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8F1BBCDC;
                } else {
                    f = b ^ c ^ d;
                    k = 0xCA62C1D6;
                }
                const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
                e = d;
                d = c;
                c = rotl(b, 30);
                b = a;
                a = t;
            }

            h0 = (h0 + a) | 0;
            h1 = (h1 + b) | 0;
            h2 = (h2 + c) | 0;
            h3 = (h3 + d) | 0;
            h4 = (h4 + e) | 0;
        }

        return HashFunctions.toHexBE(h0) + HashFunctions.toHexBE(h1) + HashFunctions.toHexBE(h2)
            + HashFunctions.toHexBE(h3) + HashFunctions.toHexBE(h4);
    }

    /**
     * Дополнение сообщения по схеме md5/sha1: байт 0x80, нули до 56 mod 64, затем длина в
     * битах 64-битным числом. md5 кладёт длину little-endian, sha1 — big-endian.
     */
    private static padMessage(bytes: Uint8Array, lengthLittleEndian: boolean): Uint8Array {
        const bitLen = bytes.length * 8;
        const totalLen = ((bytes.length + 8) >> 6 << 6) + 64;
        const msg = new Uint8Array(totalLen);
        msg.set(bytes);
        msg[bytes.length] = 0x80;

        //64-битная длина: укладываем младшие 32 бита (старшие у нас всегда 0 для разумных
        //строк, bitLen < 2^32). Порядок байт зависит от алгоритма.
        const lo = bitLen >>> 0;
        if (lengthLittleEndian) {
            msg[totalLen - 8] = lo & 0xff;
            msg[totalLen - 7] = (lo >>> 8) & 0xff;
            msg[totalLen - 6] = (lo >>> 16) & 0xff;
            msg[totalLen - 5] = (lo >>> 24) & 0xff;
        } else {
            msg[totalLen - 4] = (lo >>> 24) & 0xff;
            msg[totalLen - 3] = (lo >>> 16) & 0xff;
            msg[totalLen - 2] = (lo >>> 8) & 0xff;
            msg[totalLen - 1] = lo & 0xff;
        }
        return msg;
    }

    /** 32-битное слово → hex в порядке little-endian (для md5). */
    private static toHexLE(x: number): string {
        let out = '';
        for (let i = 0; i < 4; i++) {
            out += ((x >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
        }
        return out;
    }

    /** 32-битное слово → hex в порядке big-endian (для sha1). */
    private static toHexBE(x: number): string {
        return (x >>> 0).toString(16).padStart(8, '0');
    }

    private static argToString(arg: unknown): string {
        if (arg instanceof StackVariable) {
            const asString = arg.castAs(VariableType.vtString);
            return asString ? String(asString.value) : '';
        }
        return '';
    }
}
