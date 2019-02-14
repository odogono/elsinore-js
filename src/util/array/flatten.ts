/**
 * 
 */
export function arrayFlatten(ary:Array<any>, shallow:boolean = false) : Array<any> {
    if (shallow) {
        return [].concat.apply([], ary);
    }

    let ret = [];
    
    for (let ii = 0; ii < ary.length; ii++) {
        if (Array.isArray(ary[ii])) {
            ret = ret.concat( arrayFlatten( ary[ii] ) );
        } else {
            ret.push(ary[ii]);
        }
    }
    return ret;
}