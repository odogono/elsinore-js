/**
 * Returns an array containing the unique members of the passed array
 * @param {*} array 
 */
export function arrayUnique(array) {
    // http://stackoverflow.com/a/17903018/2377677
    return array.reduce((p, c) => {
        if (p.indexOf(c) < 0) {
            p.push(c);
        }
        return p;
    }, []);
}