

/**
 * Similar to without, but returns the values from array that are not present in the other array. 
 * @param {*} array 
 * @param {*} others 
 */
export function arrayDifference<T>(array:Array<T> = [], other:Array<T>) : Array<T> {
    return array.filter(x => other.indexOf(x) < 0);
}