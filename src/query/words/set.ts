import { QueryStack } from "..";
import { isEqual } from "../../util/is";
import { InstResult, StackError, StackValue, SType } from "../types";
import { unpackStackValue } from "../util";



export function onDiff(stack: QueryStack, [,op]:StackValue): InstResult {
    const isDiff = op === 'diff' || op === 'diff!';
    const isInter = op === 'intersect' || op === 'intersect!';
    const isDes = op.endsWith('!');

    let left = isDes ? stack.pop() : stack.peek();
    let right = isDes ? stack.pop() : stack.peek(1);

    let ta = left[0];
    let tb = right[0];
    let a = unpackStackValue(left, [SType.List, SType.Map, SType.Component, SType.Entity]);
    let b = unpackStackValue(right, [SType.List, SType.Map, SType.Component, SType.Entity]);

    if( tb !== tb ){
        throw new StackError(`incompatible types ${tb} ${tb}`);
    }
    
    let out;

    if( ta === SType.List ){
        if( isDiff || isInter ){
            out = a.filter(x => {
                let idx = b.findIndex( e => isEqual(e,x));
                return isDiff ? idx === -1 : idx !== -1;
            });
            // return isDiff ? !eq : eq;
        } 
    }
    else {
        out = [];
    }


    return [SType.List, out];
}