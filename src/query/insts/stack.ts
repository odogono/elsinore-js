import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    Type as QueryStackT,
    create as createStack,
    push, StackValue, peek, 
    InstResult, InstDef, shift, pushRaw, assertStackSize, 
    
    
    isInstModuleDef, 
    InstModuleDef, 
    
    popOfTypeV, 
    StackOp, popOfType, findWithIndex, AsyncInstResult, pushValues, SType, } from "../stack";
import {
    Type as EntityT,
    getComponents as getEntityComponents
} from '../../entity';
import {
    Type as EntitySetT, 
    getComponentsByDefId, 
    createEntity,
    add as addToEntitySet,
    create as createEntitySet,
} from '../../entity_set';
import { VL, valueOf } from "./value";
import { isFunction, isString, isObject } from "../../util/is";
import { BitField } from "odgn-bitfield";
import { Type as ComponentT, getComponentDefId } from "../../component";
import { Attribute } from "./attribute";

const Log = createLog('Inst][Stack');

export const OpenList = '(';
export const CloseList = ')';
export const Stack = '@qs';
export const StackList = '@sl';
export const Put = 'PT';
export const Get = 'GT';
export const Cls = 'CLS';
export const Define = 'def';
export const GetInst = 'gdef';
export const Fetch = '@';
export const Store = '!';

// Reverses top two stack items
export const Swap = 'SW';

// duplicates the top stack item
export const Dup = 'DUP';

// copies 2nd item to top
export const Over = 'OV';

// rotates 3rd item to top
export const Rot = 'RT';

// discards top item
export const Drop = 'DRP';

export const ToString = '@ToS';
export const ToList = '@ToL';
export const Require = '!require';


export const meta:InstDefMeta = {
    op: [ OpenList, CloseList, 
        StackList, 
        Swap, Stack, Put, Get, 
        Fetch,
        Cls, Define, GetInst, ToString, ToList, Require ]
};

const OpMap = {
    // [OpenList]: executeOpenList,
    // [CloseList]: executeCloseList,
    // [Swap]: executeSwap,
    // [Cls]: executeClear,
    // [Stack]: (stack:QueryStack) => [stack],
    // [Put]: executePut,
    // [Get]: executeGet,
    // [Fetch]: executeFetch,
    // [StackList]: executeList,
    // [Define]: executeDefine,
    // [GetInst]: executeGetDefine,
    // [ToString]: executeToString,
    // [ToList]: executeToList,
    // [Require]: executeRequire
};

export function execute( stack:QueryStack, [op,arg]:StackValue  ):InstResult {
    // if( !isFunction( OpMap[op] ) ){
    //     Log.debug('[execute]', 'fn not found', op, OpMap[op] );
    // }
    return OpMap[op](stack, [op,arg]);
}


// export async function executeOpenList( stack:QueryStack, [op,arg]:StackValue ):AsyncInstResult {
//     // Log.debug('[executeOpenList]', op, args );

//     if( arg ){
//         return [stack, [op,arg]];
//     }

//     let subStack:QueryStack = createStack();
//     subStack.execute = false;
    
//     // disable all instructions apart from End
//     type ia = [string,InstDef][];
//     const insts:ia = Array.from( stack.instructions ).map( ([op,inst]) => 
//         op === CloseList ? [op, inst] : [op, disableInstDef(inst) ] );
//     subStack.instructions = new Map<string, InstDef>( insts );

//     [subStack] = await push( subStack, [QueryStackT,stack] );

//     return [subStack];
// }

function disableInstDef( inst:InstDef ): InstDef {
    if( isInstModuleDef(inst) ){
        return {meta: (inst as InstModuleDef).meta};
    }
    return undefined;
}


export function executeCloseList( subStack:QueryStack, [op,arg]:StackValue  ):InstResult {
    // Log.debug( '[executeCloseList]', subStack.items );

    // get the old stack back
    let stack:QueryStack;
    [subStack, [,stack]] = shift( subStack );

    // Log.debug( '[executeCloseList]', subStack.items );

    // push a Function containing all the instructions onto the stack
    stack = pushRaw( stack, [StackList, subStack.items] );

    return [stack];
}

export function executeSwap( stack:QueryStack ):InstResult {
    let a:StackValue, b:StackValue;
    // swap the last two elements on the stack
    [stack, a] = pop(stack);
    [stack, b] = pop(stack);
    stack = pushRaw(stack, a);
    stack = pushRaw(stack, b);

    return [stack];
}

// export function executeToString( stack:QueryStack  ):InstResult {
//     let op:StackOp;
//     let arg:any;
//     [stack, [op,arg]] = pop(stack);

//     const moduleDef = getInstruction( stack, op, true) as InstModuleDef;
//     if( moduleDef?.toStringValue ){
//         return moduleDef.toStringValue( stack, [op,arg] );
//     }
//     return [stack,[VL, JSON.stringify(arg) ] ];
// }

// export function executeToList( stack:QueryStack  ):InstResult {
//     let op:StackOp;
//     let arg:any;
//     [stack, [op,arg]] = pop(stack);

//     const moduleDef = getInstruction( stack, op, true) as InstModuleDef;
//     if( moduleDef?.toListValue ){
//         return moduleDef.toListValue( stack, [op,arg] );
//     }
//     return [stack,[StackList, [arg] ] ];
// }

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

// export function executeFetch( stack:QueryStack ): InstResult {
//     let op:StackOp, cop:StackOp;
//     let arg:any;
//     let container:any;
//     [stack, [op,arg]] = pop(stack);
//     [stack, [cop,container]] = pop(stack);

//     const moduleDef = getInstruction( stack, cop, true) as InstModuleDef;
//     if( moduleDef?.executeFetch ){
//         return moduleDef.executeFetch( stack, [cop,container], [op,arg] );
//     }
//     return [stack,[VL, undefined ] ];
// }

export function executeGet( stack:QueryStack ): InstResult {
    let map:StackValue;
    let key:StackValue;
    let value:StackValue;
    let keyOp,keyVal;
    let mapOp,mapVal;

    [stack, [keyOp,keyVal]] = pop(stack);
    [stack, [mapOp, mapVal]] = pop(stack);
    // const mapType = map[0];

    // Log.debug('[executeGet]', 'key', keyOp );

    if( keyOp === Attribute ){
        let [bf, name] = keyVal;
        // Log.debug('[executeGet]', mapType, bf.toValues(), name);
        if( mapOp === ComponentT ){
            // check the component is of the correct type
            let did = getComponentDefId(mapVal);
            if( !bf.get(did) ){
                // Log.debug('[executeGet]', 'nope', mapVal );
                return [stack, [VL, undefined] ];
        }
            
            // Log.debug('[executeGet]', mapVal, keyVal);
            return name !== undefined ? 
                [stack, [VL, mapVal[ name ]] ] : 
                [stack, [ComponentT,mapVal] ];

        } else if( mapOp === EntityT ){
            let coms = getEntityComponents( mapVal, bf );
            
            if( name === undefined ){
                return [stack, [VL,coms] ];
            }
            return [stack, [VL, coms.map( com => com[name] ).filter(Boolean)]];
        }
        else if( mapOp === EntitySetT ){
            // Log.debug('[executeGet]', bf, name);
            let coms = getComponentsByDefId( mapVal, bf );

            if( name !== undefined ){
                return [stack, [VL, coms.map( com => com[name] ).filter(Boolean) ]];
            }
            return [stack, [EntitySetT, addToEntitySet( createEntitySet({}), coms )]];
        }
        // if( map[0] !== )
        // throw new Error(`expected value of type ${type} : got ${value[0]}`);
        // assertStackValueType( stack, 1 )
    }
    else if( keyOp === VL ){
        let [type,val] = map;
        // if( isObject(val) ){
            return [stack, [VL, val[keyVal]] ];
        // }
    }
}

/**
 * 
 * @param stack 
 * @param op 
 * @param list 
 */
export async function executeList( stack:QueryStack, op:string, list:StackOp|StackValue[] ):AsyncInstResult {
    let value:StackValue;
    let args:StackValue[];
    let arg;
    
    // Log.debug('[executeList]', list );

    if( list === undefined ){
        [stack, [op,arg] ] = pop(stack);
        args = Array.isArray(arg) ? arg : [arg];
    } else if( isString(list) ){
        // a type has been specified - gather all previous of type into a list
        [stack, args] = popOfType( stack, list as SType );
        // Log.debug('[executeList]', list, args);
        return [stack, [StackList, args] ];
    } else {
        args = list as StackValue[];
    }


    // push each of the args onto the stack
    // [stack,value] = args.reduce( ( [stack,value],inst) => push(stack, inst), [stack,value] );
    [stack] = await pushValues(stack, args);

    return [stack, value, false];
}


// export function executeGetDefine( stack:QueryStack ): InstResult {
//     let name:string;
//     let value:StackValue;

//     [stack,[,name]] = pop(stack);

//     const instDef = getDef(stack, name);

//     // Log.debug('[executeGetDefine]', instDef );

//     return [stack, instDef];
// }

// export function executeDefine( stack:QueryStack ): InstResult {
//     assertStackSize( stack, 2, `${Define} requires 2 args: <key> <value>`);

//     let name:string;
//     let value:StackValue;

//     [stack,[,name]] = pop(stack);
//     [stack,value] = pop(stack);

//     stack = addDef( stack, name, value);

//     return [stack];
// }

export function executeRequire( stack:QueryStack, [op,arg]:StackValue ): InstResult {
    let [idx] = findWithIndex( stack, arg);
    if( idx === -1 ){
        throw new Error(`could not find ${arg} on stack`);
    }
    return [stack];
}