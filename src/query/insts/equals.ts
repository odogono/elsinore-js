import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    push, StackValue, peek, InstResult, } from "../stack";
import { VL, valueOf } from "./value";

const Log = createLog('Inst][Equals');

export const Type = '==';

export const Add = '+';
export const Sub = '-';
export const Mul = '*';
export const Equals = '==';


const OpMap = {
    [Add]: executeAdd,
    [Sub]: executeSub,
    [Mul]: executeMul,
    [Equals]: executeEquals,
};

export const meta:InstDefMeta = {
    op: Object.keys(OpMap)
};

// export const meta:InstDefMeta = {
//     op: ['==', '+', '*']
// };

export function execute( stack:QueryStack, op, args  ):InstResult {
    // if( !isFunction( OpMap[op] ) ){
    //     Log.debug('[execute]', 'fn not found', op, OpMap[op] );
    // }
    return OpMap[op](stack, op, args);
}

export function executeEquals( stack:QueryStack, op:string ):InstResult {
    let lval,rval;

    // Log.debug('[execute]', op, stack.items );

    lval = peek(stack);
    rval = peek(stack, 1);
    
    
    if( lval[0] !== VL || rval[0] !== VL ){
        // Log.debug('[execute]', op, lval, '!=', rval );
        return [stack, [op] ];
    }

    // Log.debug('[execute]',0, stack.items);

    // [stack] = popQueryStack(stack);
    [stack, lval] = pop(stack);
    // Log.debug('[execute]', 'lval', lval, '->', stack.items );
    // throw Error('stop');
    [stack, rval] = pop(stack);
    
    lval = valueOf(lval);
    rval = valueOf(rval);
    
    // stack = pushQueryStack( stack, [VL,lval === rval] );
    // Log.debug('[execute]',2, [VL,lval === rval], lval,rval, '-', stack.items );

    return [stack, [VL, lval === rval]];
}

function executeAdd( stack:QueryStack  ): InstResult {
    let lval,rval;
    [stack,lval] = pop(stack);
    [stack,rval] = pop(stack);

    lval = valueOf(lval);
    rval = valueOf(rval);

    return [stack, [VL, lval + rval] ];
}

function executeSub( stack:QueryStack  ): InstResult {
    let lval,rval;
    [stack,lval] = pop(stack);
    [stack,rval] = pop(stack);

    lval = valueOf(lval);
    rval = valueOf(rval);

    return [stack, [VL, lval - rval] ];
}

function executeMul( stack:QueryStack  ): InstResult {
    let lval,rval;
    [stack,lval] = pop(stack);
    [stack,rval] = pop(stack);

    lval = valueOf(lval);
    rval = valueOf(rval);

    return [stack, [VL, lval * rval] ];
}