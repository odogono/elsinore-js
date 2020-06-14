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
        case '!=':
        case '>':
        case '>=':
        case '<':
        case '<=':
            return prCompare( es, cmd, left, right );
        case SType.ComponentAttr:
            return prCA( es, left[0], left[1] );
        case SType.Value:
        case SType.Regex:
            return left;
    }
    
}

function prCA( es:EntitySet, dids, attr ){
    // console.log('[prCA]', dids, attr );
    const did = bfToValues(dids)[0];
    const def = es.getByDefId( did );
    return { def:def, key:attr };
}

function prCompare( es:EntitySet, cmd, left, right ){
    
    let key;
    let val;
    // console.log('[prCompare]', left, right);

    switch( left[0] ){
        case SType.Value:
        case SType.Regex:
        case SType.DateTime:
            val = left[1];
            key = parseFilterQuery(es,...right);
            break;
        case SType.List:
            val = unpackStackValueR(left);
            key = parseFilterQuery(es,...right);
            break;
    }
    if( key === undefined ){
        if( right[0] === SType.Value ){
            val = right[1];
            key = parseFilterQuery(es, ...left);
        } else {
            // console.log('[prCompare]', [left,right]);
            return {eq:[ parseFilterQuery(es,...left), parseFilterQuery(es,...right)]};
        }
    }

    if( 'key' in key ){
        
        let {key:kk, ...rest} = key;
        return [ cmd, rest, [kk,val] ];
    }

    // Log.debug('[prCompare]', [left,right]);
    
    return { ...key, val };
}
function prAnd( es:EntitySet, cmd, left, right ){
    let l = parseFilterQuery( es, ...left );
    let r = right !== undefined ? parseFilterQuery( es, ...right ) : undefined;
    // console.log('[prAnd]', cmd, l, r );
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
    // console.log('[onFilter]', op, 'L', left);
    // console.log('[onFilter]', op, 'R', right);
    
    stack.pushRaw([SType.Filter, [op, right, left]]);

    return undefined;
}