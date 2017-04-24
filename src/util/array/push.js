/**
 * Pushes item onto the end of the array and returns the array
 */
export default function arrayPush(array = [], item) {
    if (Array.isArray(item)) {
        return array.concat(item);
    }
    array.push(item);
    return array;
}