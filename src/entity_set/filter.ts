import { QueryStack } from "../query/stack";
import { InstResult, SType, StackValue } from "../query/types";
import { 
    BitField,
    toValues as bfToValues
} from "../util/bitfield";
import { unpackStackValueR } from "../query/util";
import { EntitySet } from ".";



export function parseFilterQuery( es:EntitySet, cmd?, left?, right? ){
    // Log.debug('[pr]', cmd, left, ',', right);
    switch(cmd){
        case 'and':
        case 'or':
            return prAnd( es, cmd, left, right );
        case SType.Bitfield:
            return [ 'dids', bfToValues(left as BitField) ];
        case '==':
            return prEquals( es, cmd, left, right );
        case SType.ComponentAttr:
            return prCA( es, left[0], left[1] );
        case SType.Value:
            return left;
    }
    
}

function prCA( es:EntitySet,dids, attr ){
    const did = bfToValues(dids)[0];
    const def = es.getByDefId( did );
    // Log.debug('[prCA]', did, def)
    return { def:def, key:attr };
}

function prEquals( es:EntitySet, cmd, left, right ){
    
    let key;
    let val;
    if( left[0] === SType.Value ){
        val = left[1];
        // console.log('[prEquals]', 'left', val);
        key = parseFilterQuery(es,...right);
    } else if( left[0] === SType.List ){
        val = unpackStackValueR(left);
        key = parseFilterQuery(es,...right);
    } else if( right[0] === SType.Value ){
        val = right[1];
        key = parseFilterQuery(es, ...left);
    } else {
        // console.log('[prEquals]', [left,right]);
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


export function onLogicalFilter<QS extends QueryStack>(stack:QS, value:StackValue): InstResult {
    const [,op] = value;

    let right = stack.pop();
    let left = stack.pop();
    if( left[0] === SType.Filter ){
        left = left[1];
    }
    if( right[0] === SType.Filter ){
        right = right[1];
    }
    // Log.debug('[onFilter]', op, 'L', left);
    // Log.debug('[onFilter]', op, 'R', right);
    
    stack.pushRaw([SType.Filter, [op, right, left]]);

    return [];
}