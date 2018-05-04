import {parseJSON} from './parse_json';

/**
 * 
 */
export function deepClone(obj) {
    const str = stringify(obj);
    return parseJSON(str);
}