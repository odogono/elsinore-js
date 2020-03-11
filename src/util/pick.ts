
/**
 * Returns a copy of the object only containing the whitelisted properties.
 * 
 * @param {*} obj 
 * @param {*} whitelist 
 */
export function pick(obj, ...whitelist) {
    return Object.keys(obj)
        .filter(key => whitelist.indexOf(key) >= 0)
        .reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {});
}
