import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    Type as QueryStackT,
    create as createStack,
    push, StackValue, peek, InstResult, InstDef, shift, pushRaw, assertStackSize, assertStackValueType, addDef, isInstModuleDef, InstModuleDef, } from "../stack";
import { VL, valueOf } from "./value";
import { isFunction } from "../../util/is";

const Log = createLog('Inst][Stack');

export const OpenList = '[';
export const CloseList = ']';
export const Swap = 'SW';
// export const Push = 'PH';
export const Stack = '@qs';
export const List = '@sl';
export const Put = 'PT';
export const Clear = 'CLS';
export const Define = 'def';

export const meta:InstDefMeta = {
    op: [ OpenList, CloseList, List, Swap, Stack, Put, Clear, Define ]
};

const OpMap = {
    [OpenList]: executeOpenList,
    [CloseList]: executeCloseList,
    [Swap]: executeSwap,
    [Clear]: executeClear,
    [Stack]: (stack:QueryStack) => [stack],
    [Put]: executePut,
    [List]: executeList,
    [Define]: executeDefine,
};

export function execute( stack:QueryStack, op, args  ):InstResult {
    // if( !isFunction( OpMap[op] ) ){
    //     Log.debug('[execute]', 'fn not found', op, OpMap[op] );
    // }
    return OpMap[op](stack, op, args);
}


export function executeOpenList( stack:QueryStack, op, args ):InstResult {
    // Log.debug('[executeOpenList]', op, args );

    if( args ){
        return [stack, [op,args]];
    }

    let subStack:QueryStack = createStack();
    subStack.execute = false;
    
    // disable all instructions apart from End
    type ia = [string,InstDef][];
    const insts:ia = Array.from( stack.instructions ).map( ([op,inst]) => 
        op === CloseList ? [op, inst] : [op, disableInstDef(inst) ] );
    subStack.instructions = new Map<string, InstDef>( insts );

    [subStack] = push( subStack, [QueryStackT,stack] );

    return [subStack];
}

function disableInstDef( inst:InstDef ): InstDef {
    if( isInstModuleDef(inst) ){
        return {meta: (inst as InstModuleDef).meta};
    }
    return undefined;
}


export function executeCloseList( subStack:QueryStack, op, args  ):InstResult {
    // Log.debug( '[executeCloseList]', subStack.items );

    // get the old stack back
    let stack:QueryStack;
    [subStack, [,stack]] = shift( subStack );

    // Log.debug( '[executeCloseList]', subStack.items );

    // push a Function containing all the instructions onto the stack
    stack = pushRaw( stack, [List, subStack.items] );

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
 * Pushes the value of a StackValue onto the stack
 * @param stack 
 */
// export function executePush( stack:QueryStack  ):InstResult {
//     // Log.debug(op, args);
//     let value:StackValue;
//     let args:StackValue[];
//     let op, arg;
    
//     [stack, [op,arg] ] = pop(stack);

//     args = Array.isArray(arg) ? arg : [arg];

//     // push each of the args onto the stack
//     [stack,value] = args.reduce( ( [stack,value],inst) => push(stack, inst), [stack,value] );

//     return [stack, value, false];
// }

export function executeClear( stack:QueryStack ):InstResult {
    return [ {...stack, items:[]} ];
}

export function executePut( stack:QueryStack ):InstResult {
    let map:StackValue;
    let key:StackValue;
    let value:StackValue;

    assertStackSize( stack, 3, `${Put} requires 3 args: <key> <value> <map>`);
    // assertStackValueType( stack, 2, VL, typeof {} );
    // assertStackValueType( stack, 1, VL );
    // assertStackValueType( stack, 0, VL );

    [stack, key] = pop(stack);
    [stack, value] = pop(stack);
    [stack, map] = pop(stack);

    map[1] = {...map[1], [key[1]]:value[1]};

    // Log.debug('[executePut]', map);

    return [stack, map];
}

export function executeList( stack:QueryStack, op:string, list:StackValue[] ):InstResult {
    let value:StackValue;
    let args:StackValue[];
    let arg;
    
    // Log.debug('[executeList]', list );

    if( list === undefined ){
        [stack, [op,arg] ] = pop(stack);
        args = Array.isArray(arg) ? arg : [arg];
    } else {
        args = list;
    }


    // push each of the args onto the stack
    [stack,value] = args.reduce( ( [stack,value],inst) => push(stack, inst), [stack,value] );

    return [stack, value, false];
}


export function executeDefine( stack:QueryStack ): InstResult {
    assertStackSize( stack, 2, `${Define} requires 2 args: <key> <value>`);

    let name:string;
    let value:StackValue;

    [stack,[,name]] = pop(stack);
    [stack,value] = pop(stack);

    stack = addDef( stack, name, value);

    return [stack];
}