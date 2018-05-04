/**
 * @param {object} obj
 * @param space
 */
export function stringify(obj, space) {
    let cache = [];
    return JSON.stringify(
        obj,
        function(key, value) {
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
