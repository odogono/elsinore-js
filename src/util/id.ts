/**
 * flake53 (https://github.com/cablehead/python-fity3)
 * 
 * timestamp | workerId | sequence
 * 41 bits  |  8 bits   |  4 bits
 *
 * 
 * flake63 (https://github.com/luxe-eng/flake-idgen-63)
 * (63bit in order to help java, the poor thing)
 * 
 * reserved | timestamp | processId | workerId | sequence
 * 1 bit    | 42 bits   | 4 bits    | 5 bits   | 12 bits
 *                      | id                   |
 *                      | 9 bits               |
 *
 * 
 * discord/twitter64 (https://discordapp.com/developers/docs/reference#snowflakes)
 * 
 * timestamp | workerId | processId | sequence
 * 42 bits   | 5 bits   | 5 bits    | 12 bits
 *
 */



const TwitterEpoch: number = 1413370800000;
const Epoch: number = 1546333200000;

const Flake53WorkerIdBits = 4;
const Flake53SequenceBits = 8;
const Flake53TimestampLeftShift = Flake53SequenceBits + Flake53WorkerIdBits;

export interface Flake53Params {
    timestamp?: number;
    workerId?: number;
    sequence?: number;
    epoch?: number;
}

/**
 * a 53 bit flake, which helps in IEEE 754 environments, particularly javascript
 * Thankyou to https://github.com/cablehead/python-fity3 for not having to think about this
 * timestamp | workerId | sequence
 * 41 bits  |  4 bits   |  8 bits
 *
 */
export function buildFlake53({
    timestamp = Date.now(),
    workerId = 0,
    sequence = 0,
    epoch = Epoch
}: Flake53Params = {}): number {
    const workerIdShift = Flake53SequenceBits;
    return (
        lshift(timestamp - epoch, Flake53TimestampLeftShift) +
        lshift(workerId & 0xf, workerIdShift) +
        (sequence & 0xff)
    );
}

/**
 *
 * the elixir parse looks like this: << timestamp :: size(52), workerId :: size(8), sequence :: size(4) >> = <<505676010::64>>
 * @param flake53
 * @param epoch
 */
export function parseFlake53(
    flake53: number,
    epoch: number = Epoch
): Flake53Params {
    return {
        timestamp:
            rshift(flake53,  Flake53TimestampLeftShift) +
            epoch,
        workerId: rshift(flake53, Flake53SequenceBits) & 0xf,
        sequence: flake53 & 0xff,
        epoch
    };
}

// https://gist.github.com/lttlrck/4129238
function hexToInt64Array( str:string) {
    let result = new Array(8);

    let hiStr = (str + '').replace(/^0x/, '');
    let loStr = hiStr.substr(-8);
    hiStr = hiStr.length > 8 ? hiStr.substr(0, hiStr.length - 8) : '';

    let hi = parseInt(hiStr, 16);
    let lo = parseInt(loStr, 16);

    let o = 0;
    for (let i = 7; i >= 0; i--) {
        result[o + i] = lo & 0xff;
        lo = i === 4 ? hi : lo >>> 8;
    }

    return result;
}

function stringToInt64Array(str:string) {
    // because i am lame and cant find a direct means
    // of converting a dec string, i convert to hex
    // first
    return hexToInt64Array(decToHex(str));
}

// http://www.danvk.org/hex2dec.html
function decToHex(decStr) {
    let hex = convertBase(decStr, 10, 16);
    return hex ? '0x' + hex : null;
}

function convertBase(str, fromBase, toBase) {
    let digits = parseToDigitsArray(str, fromBase);
    if (digits === null) return null;

    let outArray = [];
    let power = [1];
    for (let i = 0; i < digits.length; i++) {
        // invariant: at this point, fromBase^i = power
        if (digits[i]) {
            outArray = add(
                outArray,
                multiplyByNumber(digits[i], power, toBase),
                toBase
            );
        }
        power = multiplyByNumber(fromBase, power, toBase);
    }

    let out = '';
    for (let i = outArray.length - 1; i >= 0; i--) {
        out += outArray[i].toString(toBase);
    }
    return out;
}

function parseToDigitsArray(str, base) {
    let digits = str.split('');
    let ary = [];
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], base);
        if (isNaN(n)) return null;
        ary.push(n);
    }
    return ary;
}

// Returns a*x, where x is an array of decimal digits and a is an ordinary
// JavaScript number. base is the number base of the array x.
function multiplyByNumber(num, x, base) {
    if (num < 0){ return null; }
    if (num === 0){ return []; }

    let result = [];
    let power = x;
    while (true) {
        if (num & 1) {
            result = add(result, power, base);
        }
        num = num >> 1;
        if (num === 0) break;
        power = add(power, power, base);
    }

    return result;
}

// Adds two arrays for the given base (10 or 16), returning the result.
// This turns out to be the only "primitive" operation we need.
function add(x, y, base) {
    let z = [];
    let n = Math.max(x.length, y.length);
    let carry = 0;
    let i = 0;
    while (i < n || carry) {
        let xi = i < x.length ? x[i] : 0;
        let yi = i < y.length ? y[i] : 0;
        let zi = carry + xi + yi;
        z.push(zi % base);
        carry = Math.floor(zi / base);
        i++;
    }
    return z;
}

// const getUint64 = function(view, byteOffset = 0, littleEndian = false) {
//     // split 64-bit number into two 32-bit parts
//     const left =  view.getUint32(byteOffset, littleEndian);
//     const right = view.getUint32(byteOffset+4, littleEndian);

//     // combine the two 32-bit values
//     const combined = littleEndian? left + 2**32*right : 2**32*left + right;

//     if (!Number.isSafeInteger(combined)){
//       console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
//     }

//     return combined;
//   }

//   https://stackoverflow.com/a/45631312/2377677
function int64_to_str(a: number[], signed: boolean = false): string {
    const negative = signed && a[0] >= 128;
    const H = 0x100000000;
    const D = 1000000000;
    let h = a[3] + a[2] * 0x100 + a[1] * 0x10000 + a[0] * 0x1000000;
    let l = a[7] + a[6] * 0x100 + a[5] * 0x10000 + a[4] * 0x1000000;
    if (negative) {
        h = H - 1 - h;
        l = H - l;
    }
    const hd = Math.floor((h * H) / D + l / D);
    const ld = ((((h % D) * (H % D)) % D) + l) % D;
    const ldStr = ld + '';
    return (
        (negative ? '-' : '') +
        (hd !== 0 ? hd + '0'.repeat(9 - ldStr.length) : '') +
        ldStr
    );
}

function parseFlake63(flake: string, format = 'obj') {
    const data = stringToInt64Array(flake);

    if (format === 'arr') {
        return data;
    }

    const processId = (data[5] >> 1) & 0xf;
    const worker = ((data[5] & 0x1) << 4) | ((data[6] & 0xf0) >> 4);
    const counter = ((data[6] & 0xf) << 8) | data[7];
    const id = (processId << 5) | worker;

    const firstSixBytes =
        lshift(data[0], 40) +
        lshift(data[1], 32) +
        lshift(data[2], 24) +
        lshift(data[3], 16) +
        lshift(data[4], 8) +
        data[5];
    // take out the lower 5 bits
    const timestamp = rshift(firstSixBytes, 5); // right shift 5

    return {
        id,
        processId,
        worker,
        counter,
        timestamp,
        date: new Date(timestamp)
    };
}

interface BuildFlakeParams {
    id?: number;
    processId?: number;
    worker?: number;
    counter: number;
    timestamp: number;
    reserved?: boolean;
}

function buildFlake63({
    id,
    processId = 0,
    worker = 0,
    counter,
    timestamp,
    reserved = false
}: BuildFlakeParams) {
    worker = worker & 0x1f;
    processId = processId & 0x0f;
    id = id === undefined ? (processId << 5) | worker : id & 0x3ff;
    const reservedBit = reserved ? 1 : 0;

    let result = new Array(8);

    // first 7 bits - so we have space for reserved
    let accum = rshift(timestamp, 42 - 7);
    result[0] = (reservedBit << 7) | (accum & 0x7f);

    accum = rshift( timestamp, 42 - 7 - 8);
    result[1] = accum & 0xff;

    accum = rshift(timestamp, 42 - 7 - 8 - 8);
    result[2] = accum & 0xff;

    accum = rshift(timestamp, 42 - 7 - 8 - 8 - 8);
    result[3] = accum & 0xff;

    accum = rshift(timestamp, 42 - 7 - 8 - 8 - 8 - 8);
    result[4] = accum & 0xff;

    // // 6th byte is a combinate of timestamp and id
    accum = ((timestamp & 0xff) << 5) | (processId << 1) | (worker & 0x1);
    result[5] = accum & 0xff;

    result[6] = ((worker << 4) & 0xff) | ((counter >> 8) & 0xff);

    result[7] = counter & 0xff;

    return int64_to_str(result);
}

/*
 
0 010 0111 1011 1000 0101 1100 1001 0110 0000 0000 001 1 111 0 0001 0000 0000 0010
                                                                    |---- ---- ----|  12 bit counter
                                                             |- ----|                  5 bit worker
                                                       |- ---|                         4 bit processId
  |--- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---|                              42 bit timestamp
|-|                                                                                    1 bit reserved

first 6 bytes - 48

01234560123456012345670123456701234567012
000000x11111112222222233333333x4444444555
101101x10001011110010110000001x1000110111
10110101000101111001011000000101000110111


49778226448111 - first 6 bytes
1011010100010111100101100000010100011011101111
1011010100010111100101100000010100011011101111
// get bottom 5 bits
1011010100010111100101100000010100011011100000
1111111111111111111111111111111111111111100000
11100101100000010100011011100000
 */

// function _arrayBufferToBase64( buffer ) {
//     let binary = '';
//     let bytes = new Uint8Array( buffer );
//     let len = bytes.byteLength;
//     for (let i = 0; i < len; i++) {
//         binary += String.fromCharCode( bytes[ i ] );
//     }
//     return btoa( binary );
// }

/**
 * Convenience for safely left shifting
 * numbers, because << doesnt work on > 32bit
 *
 * @param num
 * @param bits
 */
function lshift(num, bits) {
    return num * Math.pow(2, bits);
}

function rshift(num, bits) {
    return Math.floor( num / Math.pow(2, bits) );
}

// const strBin = str => parseInt(str, 2);

// const numBin = num => {
//     let sign = num < 0 ? '-' : '';
//     let result = Math.abs(num).toString(2);
//     while (result.length < 32) {
//         result = '0' + result;
//     }
//     return sign + result;
// };

// function ArrayBufferToString(buffer) {
//     return BinaryToString(
//         String.fromCharCode.apply(
//             null,
//             Array.prototype.slice.apply(new Uint8Array(buffer))
//         )
//     );
// }

// function StringToArrayBuffer(string) {
//     return StringToUint8Array(string).buffer;
// }

// function BinaryToString(binary) {
//     let error;

//     try {
//         return decodeURIComponent(escape(binary));
//     } catch (_error) {
//         error = _error;
//         if (error instanceof URIError) {
//             return binary;
//         } else {
//             throw error;
//         }
//     }
// }

function StringToBinary(string) {
    let chars, code, i, isUCS2, len, _i;

    len = string.length;
    chars = [];
    isUCS2 = false;
    for (
        i = _i = 0;
        0 <= len ? _i < len : _i > len;
        i = 0 <= len ? ++_i : --_i
    ) {
        code = String.prototype.charCodeAt.call(string, i);
        if (code > 255) {
            isUCS2 = true;
            chars = null;
            break;
        } else {
            chars.push(code);
        }
    }
    if (isUCS2 === true) {
        return unescape(encodeURIComponent(string));
    } else {
        return String.fromCharCode.apply(
            null,
            Array.prototype.slice.apply(chars)
        );
    }
}

// function StringToUint8Array(string) {
//     let binary, binLen, buffer, chars, i, _i;
//     binary = StringToBinary(string);
//     binLen = binary.length;
//     buffer = new ArrayBuffer(binLen);
//     chars = new Uint8Array(buffer);
//     for (
//         i = _i = 0;
//         0 <= binLen ? _i < binLen : _i > binLen;
//         i = 0 <= binLen ? ++_i : --_i
//     ) {
//         chars[i] = String.prototype.charCodeAt.call(binary, i);
//     }
//     return chars;
// }

