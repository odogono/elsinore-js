

/**
 * Clears the given array and returns empty
 * 
 * @param {*} arr 
 */
export function clearArray(arr) {
    if (!arr) {
        return [];
    }
    while (arr.length > 0) {
        arr.pop();
    }
    return arr;
}

export default clearArray;