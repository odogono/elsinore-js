/**
 * Copy own-properties from `props` onto `obj`.
 * 
 * http://2ality.com/2012/01/js-inheritance-by-example.html
 * 
 * @param {*} obj 
 * @param {*} props 
 */
export function extend(target, source) {
    Object.getOwnPropertyNames(source).forEach(function(propName) {
        Object.defineProperty(target, propName, Object.getOwnPropertyDescriptor(source, propName));
    });
    return target;
}

export default extend;