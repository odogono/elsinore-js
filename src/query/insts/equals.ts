import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    push, StackValue, peek, InstResult, StackOp, InstDef, InstModuleDef, } from "../stack";
import { VL, valueOf } from "./value";
import { isObject } from "../../util/is";

const Log = createLog('Inst][Equals');

export const Type = '==';

export const Add = '+';
export const Sub = '-';
export const Mul = '*';
export const Equals = '==';


const OpMap = {
    // [Add]: executeAdd,
    // [Sub]: executeSub,
    // [Mul]: executeMul,
    // [Equals]: executeEquals,
};

export const meta:InstDefMeta = {
    op: Object.keys(OpMap)
};

// export const meta:InstDefMeta = {
//     op: ['==', '+', '*']
// };

export function execute( stack:QueryStack, value:StackValue  ):InstResult {
    // if( !isFunction( OpMap[op] ) ){
    //     Log.debug('[execute]', 'fn not found', op, OpMap[op] );
    // }
    const [op] = value;
    return OpMap[op](stack, value);
}

export function executeEquals( stack:QueryStack, [op,arg]:StackValue ):InstResult {
    let lval,rval;

    // Log.debug('[execute]', op, stack.items );

    lval = peek(stack);
    rval = peek(stack, 1);
    
    
    if( lval[0] !== VL || rval[0] !== VL ){
        // if the types do not match, then do not evaluate
        // todo - this is rather harsh, so revisit
        // Log.debug('[execute]', op, lval, '!=', rval );
        return [stack, [VL, false] ];
    }

    // Log.debug('[execute]',0, stack.items);

    [stack, lval] = pop(stack);
    // Log.debug('[execute]', 'lval', lval, '->', stack.items );
    // throw Error('stop');
    [stack, rval] = pop(stack);
    
    lval = valueOf(lval);
    rval = valueOf(rval);

    if( Array.isArray(lval) ){
        return [stack, [VL, lval.indexOf(rval) != -1]];
    }
    
    // stack = pushQueryStack( stack, [VL,lval === rval] );
    // Log.debug('[execute]',2, [VL,lval === rval], lval,rval, '-', stack.items );

    return [stack, [VL, lval === rval]];
}

// function executeAdd( stack:QueryStack  ): InstResult {
//     let lval,rval;
//     let op:StackOp;
//     let arg:any;

//     [stack,[op,arg]] = pop(stack);
//     [stack,rval] = pop(stack);

//     if( op !== VL ){
//         // attempt to find a function
//         const instDef:InstModuleDef = getInstruction( stack, op, true ) as InstModuleDef;
//         if( instDef?.executeAdd ){
//             // Log.debug('[executeAdd]', [op,arg], rval);
//             return instDef.executeAdd( stack, [op,arg], rval );
//         }

//         throw new Error(`invalid add arg: ${op}`);
//     }

//     if( isObject(lval[1]) ){
//         // add to object - pop key and value
//         let obj = lval[1];
//         // [stack,lval] = pop(stack);
//         // [stack,rval] = pop(stack);
//         return [stack, [VL, {...obj, [lval[1]]:rval[1] }]];
//     }

//     [stack,rval] = pop(stack);

//     return [stack, [VL, lval[1] + rval[1]] ];
// }

// function executeSub( stack:QueryStack  ): InstResult {
//     let lval,rval;
//     let op:StackOp;
//     let arg:any;

//     [stack,[op,arg]] = pop(stack);
//     [stack,rval] = pop(stack);

//     if( op !== VL ){
//         // attempt to find a function
//         const instDef:InstModuleDef = getInstruction( stack, op, true ) as InstModuleDef;
//         if( instDef?.executeSubtract ){
//             return instDef.executeSubtract( stack, [op,arg], rval );
//         }

//         throw new Error(`invalid subtract arg: ${op}`);
//     }

//     if( isObject(lval[1]) ){
//         // remove from object - pop key
//         [stack,rval] = pop(stack);
//         const { [rval[1]]: val, ...obj } = lval[1];

//         return [stack, [VL, obj]];
//     }

//     [stack,rval] = pop(stack);

//     lval = valueOf(lval);
//     rval = valueOf(rval);

//     return [stack, [VL, lval - rval] ];
// }

function executeMul( stack:QueryStack  ): InstResult {
    let lval,rval;
    [stack,lval] = pop(stack);
    [stack,rval] = pop(stack);

    lval = valueOf(lval);
    rval = valueOf(rval);

    return [stack, [VL, lval * rval] ];
}