/**
*   If the passed array has only a single value, return
*   that value, otherwise return the array
*/
export default function valueArray(array) {
    if (array == null) {
        return void 0;
    }
    if (array.length === 1) {
        return array[0];
    }
    return array;
}