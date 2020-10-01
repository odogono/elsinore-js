/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as 
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
export function hash /*Fnv32a*/(str: any, asString: boolean = true, seed: number = 0x811c9dc5): string | number {
    /*jshint bitwise:false */
    let ii, len, hval = seed;

    // hval = (seed === undefined) ? 0x811c9dc5 : seed;

    if (str) {
        for ((ii = 0), (len = str.length); ii < len; ii++) {
            hval ^= str.charCodeAt(ii);
            hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
        }
    }

    hval = hval >>> 0;

    if (asString) {
        // Convert to 8 digit hex string
        return hashToString(hval);
    }
    return hval;
}

export function hashToString(val:number){
    return ('0000000' + val.toString(16)).substr(-8);
}