/**
 * Traverses the children of `obj` along `path`. If a child is a function, it
 * is invoked with its parent as context. Returns the value of the final
 * child, or `fallback` if any child is undefined.
 * 
 * @param {*} obj 
 * @param {*} path 
 * @param {*} fallback 
 */
export default function result(obj, path, fallback) {
    if (!Array.isArray(path)) {
        path = [path];
    }
    const length = path.length;
    if (!length) {
        return typeof fallback === 'function' ? fallback.call(obj) : fallback;
    }
    for (let ii = 0; ii < length; ii++) {
        let prop = obj == null ? void 0 : obj[path[ii]];
        if (prop === void 0) {
            prop = fallback;
            ii = length; // Ensure we don't continue iterating.
        }
        obj = typeof prop === 'function' ? prop.call(obj) : prop;
    }
    return obj;
}
