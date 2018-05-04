/**
 * Safe parsing of json data
 */
export function parseJSON(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (err) {
        return defaultValue;
    }
}

export default parseJSON;