
/**
 * Copy own-properties from `props` onto `obj`.
 * @param {*} obj 
 * @param {*} props 
 */
export default function extend(obj, props) {
    for (let i in props) {
        obj[i] = props[i];
    }
    return obj;
}
