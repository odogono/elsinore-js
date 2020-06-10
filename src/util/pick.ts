
/**
 * Returns a copy of the object only containing the allowed properties.
 * 
 * @param {*} obj 
 * @param {*} allowlist 
 */
export function pick(obj, ...allowlist) {
    return Object.keys(obj)
        .filter(key => allowlist.indexOf(key) >= 0)
        .reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {});
}
