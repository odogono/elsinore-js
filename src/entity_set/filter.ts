import { QueryStack, InstResult, pop, SType, StackValue, pushRaw } from "../query/stack";
import { BitField } from "odgn-bitfield";
import { EntitySet } from ".";
import { getByDefId } from "./registry";



export function parseFilterQuery( es:EntitySet, cmd?, left?, right? ){
    // Log.debug('[pr]', cmd, left, ',', right);
    switch(cmd){
        case 'and':
        case 'or':
            return prAnd( es, cmd, left, right );
        case SType.Bitfield:
            return [ 'dids', (left as BitField).toValues() ];
        case '==':
            return prEquals( es, cmd, left, right );
        case SType.ComponentAttr:
            return prCA( es, left[0], left[1] );
        case SType.Value:
            return left;
    }
    
}

function prCA( es:EntitySet,dids, attr ){
    const did = dids.toValues()[0];
    const def = getByDefId(es, did );
    // Log.debug('[prCA]', did, def)
    return { def:def, key:attr };
}

function prEquals( es:EntitySet, cmd, left, right ){
    
    let key;
    let val;
    if( left[0] === SType.Value ){
        val = left[1];
        key = parseFilterQuery(es,...right);
    } else if( right[0] === SType.Value ){
        val = right[1];
        key = parseFilterQuery(es, ...left);
    } else {
        return {eq:[ parseFilterQuery(es,...left), parseFilterQuery(es,...right)]};
    }
    if( 'key' in key ){
        let {key:kk, ...rest} = key;
        return [ cmd, rest, [kk,val] ];
    }

    // Log.debug('[prEquals]', [left,right]);
    
    return { ...key, val };
}
function prAnd( es:EntitySet, cmd, left, right ){
    let l = parseFilterQuery( es, ...left );
    let r = right !== undefined ? parseFilterQuery( es, ...right ) : undefined;
    return [ cmd, l, r ];
}


export function onLogicalFilter<QS extends QueryStack>(stack:QS, value:StackValue): InstResult<QS> {
    let left, right;
    const [,op] = value;

    // Log.debug('[onFilter]', value);
    
    [stack, right] = pop(stack);
    [stack, left] = pop(stack);
    if( left[0] === SType.Filter ){
        left = left[1];
    }
    if( right[0] === SType.Filter ){
        right = right[1];
    }
    // Log.debug('[onFilter]', op, 'L', left);
    // Log.debug('[onFilter]', op, 'R', right);
    
    stack = pushRaw(stack,[SType.Filter, [op, right, left]]);

    return [stack ];
}