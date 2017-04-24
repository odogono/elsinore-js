


let idCounter = 0;

/**
 * Generate a unique integer id (unique within the entire client session).
 * from underscorejs
 * 
 * @param {*} prefix 
 */
export default function uniqueId(prefix) {
    let id = ++idCounter + '';
    return prefix ? prefix + id : id;
}
