/**
 * Safe parsing of json data
 */
export default function parseJSON(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (err) {
        return defaultValue;
    }
}