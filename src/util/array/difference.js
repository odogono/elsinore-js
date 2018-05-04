

/**
 * Similar to without, but returns the values from array that are not present in the other arrays. 
 * @param {*} array 
 * @param {*} others 
 */
export function arrayDifference(array, other) {
    return array && array.filter(x => other.indexOf(x) < 0);
}

export default arrayDifference;