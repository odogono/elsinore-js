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



/**
 * Converts the value to a JSON string
 */
export function stringify(obj:any, space?:(number|string)) : string {
    let cache:Array<any> = [];
    return JSON.stringify(
        obj,
        (key, value:any) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Circular reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        },
        space
    );
}