import {parseJSON} from './parse_json';
import { stringify } from 'querystring';

/**
 * 
 */
export function deepClone(obj) {
    const str = stringify(obj);
    return parseJSON(str);
}