/**
 * 
 * @param {*} ary 
 * @param {*} ret 
 */
export default function arrayFlatten(ary, shallow = false) {
    if (shallow) {
        return [].concat.apply([], ary);
    }
    let ret = [];
    //ret = ret === undefined ? [] : ret;
    for (let ii = 0; ii < ary.length; ii++) {
        if (Array.isArray(ary[ii])) {
            arrayFlatten(ary[ii], ret);
        } else {
            ret.push(ary[ii]);
        }
    }
    return ret;
}