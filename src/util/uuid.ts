// https://gist.github.com/jed/982883#gistcomment-3223002

const crypto = typeof window !== 'undefined' &&
    (window.crypto || window['msCrypto']) ||
    typeof self !== 'undefined' &&
    self.crypto;


const getRandomValues = crypto ?
    () => crypto.getRandomValues(new Uint8Array(16))
    : () => require('crypto').randomBytes(16);


/**
 * Creates a new UUIDv4
 */
export function createUUID() {
    const hex = [...Array(256).keys()]
        .map(index => (index).toString(16).padStart(2, '0'));

    const r = getRandomValues();
    // const r = crypto.getRandomValues(new Uint8Array(16));

    r[6] = (r[6] & 0x0f) | 0x40;
    r[8] = (r[8] & 0x3f) | 0x80;

    return [...r.entries()]
        .map(([index, int]) => [4, 6, 8, 10].includes(index) ? `-${hex[int]}` : hex[int])
        .join('');
}

// export const createUUID = () => b();
// function b(a){
//     return a           // if the placeholder was passed, return
//       ? (              // a random number from 0 to 15
//         a ^            // unless b is 8,
//         getRandomValues()  // in which case
//         % 16           // a random number from
//         >> a/4         // 8 to 11
//         ).toString(16) // in hexadecimal
//       : (              // or otherwise a concatenated string:
//         [1e7] +        // 10000000 +
//         -1e3 +         // -1000 +
//         -4e3 +         // -4000 +
//         -8e3 +         // -80000000 +
//         -1e11          // -100000000000,
//         ).replace(     // replacing
//           /[018]/g,    // zeroes, ones, and eights with
//           b            // random hex digits
//         )
//   }
