/**
 * 
 */
export default function deepClone(obj) {
    const str = stringify(obj);
    return parseJSON(str);
}