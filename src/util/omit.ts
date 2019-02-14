
/**
 * Returns a clone of the object without the blacklisted keys
 * 
 * @param {*} obj 
 * @param {*} blacklist 
 */
export function omit( obj:object, ...blacklist:string[]): object {
    return Object.keys(obj)
        .filter((key) => blacklist.indexOf(key) < 0)
        .reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {})
}