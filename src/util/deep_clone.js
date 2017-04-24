import parseJSON from './parse_json';

/**
 * 
 */
export default function deepClone(obj) {
    const str = stringify(obj);
    return parseJSON(str);
}