import { parseJSON } from './parse_json';
import { stringify } from 'querystring';

/**
 *
 */
export function deepCloneJSON(obj) {
    const str = stringify(obj);
    return parseJSON(str);
}


/**
 * Recursive deep clone
 * 
 * From: https://jsperf.com/deep-copy-vs-json-stringify-json-parse/25
 * 
 */
export function deepClone(obj:object|any[]): object|any[] {
    let clone;
    let ii;

    if (typeof obj !== 'object' || !obj) { return obj; }

    if ('[object Array]' === Object.prototype.toString.apply(obj)) {
        clone = [];
        const len = (obj as any[]).length;
        for (ii = 0; ii < len; ii++){ 
            clone[ii] = deepClone(obj[ii]);
        }
        return clone;
    }

    clone = {};
    for (ii in obj){ 
        if (obj.hasOwnProperty(ii)) { clone[ii] = deepClone(obj[ii]); }
    }
    return clone;
}
