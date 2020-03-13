import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    Type as QueryStackT,
    create as createStack,
    push, StackValue, peek, InstResult, InstDef, addInstruction, shift, pushRaw, } from "../stack";
import { VL, valueOf } from "./value";

const Log = createLog('Inst][Stack');

export const Func = 'FN';
export const End = ';';
export const Swap = 'SW';
export const Call = 'CL';
export const Stack = '@qs';

export const meta:InstDefMeta = {
    op: [ Func, End, Swap, Call, Stack ]
};

const OpMap = {
    [Func]: executeFunction,
    [End]: executeEnd,
    [Swap]: executeSwap,
    [Call]: executeCall,
    [Stack]: (stack:QueryStack) => [stack]
};

export function execute( stack:QueryStack, op, args  ):InstResult {
    // Log.debug(op, args, OpMap[op] );
    return OpMap[op](stack, op, args);
    // return [stack, [op,args]];
}

export function executeFunction( stack:QueryStack, op, args ):InstResult {
    // Log.debug('[executeFunction]', op, args );

    if( args ){
        return [stack, [op,args]];
    }

    let subStack:QueryStack = createStack();
    subStack.execute = false;
    // addInstruction( subStack, { meta:{op:End}, execute:executeEnd } );
    // let instructions = new Map<string, InstDef>( stack.instructions );
    type ia = [string,InstDef][];
    let insts:ia = Array.from( stack.instructions ).map( ([op,inst]) => {
        return op === End ? [op, inst] : [op, {meta:inst.meta}];
    });
    // Log.debug('[executeFunction]', 'mapped insts', insts );
    subStack.instructions = new Map<string, InstDef>( insts );

    [subStack] = push( subStack, stack, QueryStackT );

    // Log.debug('[executeFunction]', 'sub', subStack);

    return [subStack];
}


export function executeEnd( subStack:QueryStack, op, args  ):InstResult {
    // Log.debug( '[executeEnd]', subStack.items );

    // get the old stack back
    let stack:QueryStack;
    [subStack, [,stack]] = shift( subStack );

    // Log.debug( '[executeEnd]', subStack.items );

    // push a Function containing all the instructions onto the stack
    [stack] = push( stack, [Func, subStack.items] );


    return [stack];
}
export function executeSwap( stack:QueryStack, op, args  ):InstResult {
    let a:StackValue, b:StackValue;
    // swap the last two elements on the stack
    [stack, a] = pop(stack);
    [stack, b] = pop(stack);
    stack = pushRaw(stack, a);
    stack = pushRaw(stack, b);

    return [stack];
}

/**
 * 
 * @param stack 
 */
export function executeCall( stack:QueryStack  ):InstResult {
    // Log.debug(op, args);
    let value:StackValue;
    let args:StackValue[];
    [stack, [, args]] = pop(stack);

    // push each of the args onto the stack
    [stack,value] = args.reduce( ( [stack,value],inst) => push(stack, inst), [stack,value] );

    return [stack, value, false];
}