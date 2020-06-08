import { QueryStack, SType, StackError, AsyncInstResult } from "../types";
import { unpackStackValue, unpackStackValueR } from "../util";
import { isObject } from "../../util/is";
import { isStackValue, pop } from "../stack";

export async function onPluck<QS extends QueryStack>(stack: QS): AsyncInstResult<QS> {
    let left, right;
    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let key = unpackStackValueR(right, SType.Any);
    let list = unpackStackValue(left, [SType.List, SType.Map]);

    // Log.debug('[onPluck]', key);

    // if( whitelist.length === 1 && Array.isArray(whitelist[0]) ){
    //     whitelist = whitelist[0];
    // }
    // return Object.keys(obj).filter(k => whitelist.indexOf(k) !== -1)
    //     .reduce( (accum, key) => Object.assign(accum, { [key]: obj[key] }), {} );
    if (isObject(list)) {
        list = [[SType.Map, list]];
    }
    // Log.debug('[onPluck]', 'list', left, list);

    let out;
    if (Array.isArray(key)) {
        out = list.map(it => {
            let obj = unpackStackValue(it);
            if (!isObject(obj)) {
                throw new StackError(`expected map, got ${it[0]}`);
            }

            return [SType.Map, Object.keys(obj).filter(k => key.indexOf(k) !== -1)
                .reduce((acc, key) => Object.assign(acc, { [key]: obj[key] }), {})];
        })
    }
    else {
        // Log.debug('[onPluck]', array);
        out = list.map(it => {
            let obj = unpackStackValue(it);
            if (!isObject(obj)) {
                throw new StackError(`expected map, got ${it[0]}`);
            }
            let val = obj[key];
            return isStackValue(val) ? val : [SType.Value, val];
        });
    }

    return [stack, [SType.List, out]];
}
