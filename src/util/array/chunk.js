// 
// Returns an array broken into set lengths
// 
export function chunk(array, chunkLength) {
    let i, j;
    let result = [];
    for (i = 0, j = array.length; i < j; i += chunkLength) {
        result.push(array.slice(i, i + chunkLength));
    }

    return result;
}

export default chunk;