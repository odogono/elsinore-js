/**
 * 
 * @param {*} obj1 
 * @param {*} obj2 
 */
export default function mergeRecursive(obj1, obj2) {
    for (let p in obj2) {
        if (obj2.hasOwnProperty(p)) {
            if (obj1 === undefined) {
                obj1 = {};
            }
            obj1[p] = typeof obj2[p] === 'object' ? mergeRecursive(obj1[p], obj2[p]) : obj2[p];
        }
    }
    return obj1;
}