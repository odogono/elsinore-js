import {isObject} from './is';

/**
 * Returns a clone of the object without the blacklisted keys
 * 
 * @param {*} obj 
 * @param {*} blacklist 
 */
export default function omit(obj, ...blacklist) {
    if ( !isObject(obj)) {
        return;
    }
    if (blacklist.length === 0) {
        return clone(obj);
    }
    let result = {};
    for (let key in obj) {
        if (blacklist.includes(key)) {
            continue;
        }
        result[key] = obj[key];
    }
    return result;
}