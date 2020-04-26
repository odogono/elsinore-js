import { createLog } from "../util/log";
import { isObject, isString } from "../util/is";
import { ComponentRegistry } from "../component_registry";
import { Type as ComponentT, getComponentDefId } from "../component";
import { Type as EntitySetT, matchEntities as esMatchEntities, EntitySet, getEntities } from '../entity_set';
import { BitField } from "odgn-bitfield";
import { MatchOptions } from '../constants';
import { EntityList, 
    createEntityList, 
    Type as EntityT, 
    Entity, 
    getEntityId, 
    EntityListType,
    EntityMap } from "../entity";
import { VL } from "./insts/value";


const Log = createLog('QueryStack');

export interface InstDefMeta {
    op: string | string[];
}


/**
 * http://wiki.laptop.org/go/Forth_Lesson_1
 */

export interface InstModuleDef {
    meta: InstDefMeta;
    compile?: (stack:QueryStack, val:StackValue) => StackValue;
    execute?: (stack:QueryStack, val:StackValue) => InstResult;
    executeOp?: (stack:QueryStack, op:StackOp, ...args:StackValue ) => InstResult;
    executeAdd?: (stack:QueryStack, left:StackValue, right:StackValue) => InstResult;
    executeSubtract?: (stack:QueryStack, left:StackValue, right:StackValue) => InstResult;
    executeFetch?: (stack:QueryStack, container:StackValue, value:StackValue) => InstResult;
    toStringValue?: (stack:QueryStack, value:StackValue) => InstResult;
    toListValue?: (stack:QueryStack, value:StackValue) => InstResult;
}

export type InstDef = InstModuleDef | StackValue;

export type InstResult = [
    QueryStack, StackValue?, boolean?
];

export type StackOp = string;
export type StackValue = [ StackOp ] | [ StackOp, any ] ;
export type StackValueCompiled = [ StackValue, InstModuleDef ];

const AnyValue = 'VL';
export const Type = '@qs';

export interface QueryStackDefs {
    [def: string]: StackValue;
}

export interface QueryStack {
    type: typeof Type,
    execute: boolean;
    items: StackValue[];
    defs: QueryStackDefs;
    instructions: Map<string, InstDef>;
}

export function create():QueryStack {
    return {
        type: Type,
        execute: true,
        items: [],
        defs: {},
        instructions: new Map<string, InstDef>()
    };
}

export function isInstModuleDef(value:any):boolean {
    return isObject(value) && value.meta !== undefined;
}

export function isStackValue(value:any):boolean {
    return Array.isArray(value) && value.length == 2;
}

export function compile( stack:QueryStack, value:any ):StackValueCompiled {
    let op:string = VL;
    if( isObject(value) ){
        // Log.debug('[push]', 'value object', value, Object.prototype.toString.call(value) )
        value = [VL,value];
    }
    else if(Array.isArray(value) ){
        [op] = value;
    } else {
        if( isString(value) && getInstruction(stack,value) !== undefined ){
            op = value;
            value = [op, undefined];
        } else {
            value = [VL, value];
        }
    }

    // Log.debug('[compile]', value );

    let instModule:InstModuleDef;
    let instDef = getInstruction( stack, op );

    if( isInstModuleDef(instDef) ){
        instModule = instDef as InstModuleDef;
    } else if( instDef !== undefined ) {
        // Log.debug('wuh?', instDef);
        [op] = value = (instDef as StackValue);
        instModule = getInstruction(stack,op) as InstModuleDef;
    }

    if( isInstModuleDef === undefined ){
        Log.debug(`unknown op ${op} ${JSON.stringify(value)}` );
        return [value, undefined];
    }

    if( instModule?.compile ){
        // Log.debug('[compile]', value[0])
        return [ instModule.compile( stack, value ), instModule];
    }

    // Log.debug('oh', op, value)

    return [value, instModule];
}

/**
 * Pushes a stack value onto the stack
 */
export function push( stack:QueryStack, value:any|StackValue ):[QueryStack,StackValue] {
    let instModule:InstModuleDef;
    let compiled = compile(stack, value);
    // Log.debug('[push]','compile', value, compiled );
    [ value, instModule ] = compiled;
    
    let doPush = true;
    
    if( instModule?.execute ){
        // Log.debug('[push][execute]', value );
        let result = instModule.execute(stack, value);
        if( Array.isArray(result) === false ){
            Log.debug('[push][execute]', 'undefined result from', value, result );
        }
        [stack,value,doPush] = result;
        // Log.debug('[push][execute]', 'post', op, value === undefined );
        // Log.debug('[push][execute]', 'post', stack.items.map( ([op,]) => op ) );
    }
    // Log.debug('[push][execute]', value );
    
    if( value !== undefined && doPush !== false ){
        stack = { ...stack, items: [...stack.items, value ] };
    }
    
    return [stack, value];
}

export function pushRaw( stack:QueryStack, value:StackValue ): QueryStack {
    return {...stack, items: [...stack.items,value] };
}


export function pushValues( stack:QueryStack, values:StackValue[]|any[] ): [QueryStack,StackValue] {
    let value:StackValue;
    for(let ii=0;ii<values.length;ii++ ){
        value = values[ii];
        [stack,value] = push( stack, value );
    }
    return [stack, value];
}


/**
 * Prepends a value to the stack
 * 
 * @param stack 
 * @param value 
 */
export function unshift( stack:QueryStack, value:StackValue ): QueryStack {
    return {
        ...stack,
        items: [ value, ...stack.items ]
    }
}

/**
 * Removes and returns a value from
 * @param stack 
 */
export function shift( stack:QueryStack ): [QueryStack, StackValue] {
    let items = [...stack.items];
    let value = items.shift();
    return [{...stack, items},value];
}

export function unshiftV( stack:QueryStack, value:any, valueType = AnyValue ):QueryStack {
    let itemValue:StackValue = [ valueType, value ];
    if( isObject(value) && value.type ){
        itemValue = [value.type, value];
    }
    return unshift( stack, itemValue );
}

/**
 * Pushes an arbirtrary value onto the stack
 */
// export function pushV( stack:QueryStack, value:any, valueType = AnyValue ):QueryStack {
//     let itemValue:StackValue = [ valueType, value ];
//     if( isObject(value) && value.type ){
//         itemValue = [value.type, value];
//     }
//     return push( stack, itemValue );
// }

export function pop(stack:QueryStack): [QueryStack,StackValue] {
    const length = stack.items.length;
    if( length === 0 ){
        throw new Error('stack empty');
        // return undefined;
    }
    const value = stack.items[ length - 1 ];
    stack = {
        ...stack,
        items: stack.items.slice(0, -1)
    }
    return [stack, value];
}



/**
 * Pops values from the stack while the type matches
 * 
 * @param stack 
 * @param type 
 */
export function popOfType( stack:QueryStack, ...types:StackOp[] ): [QueryStack, StackValue[]] {
    const length = stack.items.length;
    if( length === 0 ){
        return [stack, []];
    }

    let results = [];
    let ii = length-1;

    for( ii;ii>=0;ii-- ){
        const value = stack.items[ ii ];
        if( types.indexOf( value[0] ) === -1 ){
            break;
        }
        results.push( value );
    }

    // cut the stack down to size
    stack = {
        ...stack,
        items: stack.items.slice(0, ii+1)
    };

    return [stack, results];
}

export function popOfTypeV( stack:QueryStack, ...types:StackOp[] ): [QueryStack, any[]] {

    let results = [];
    [stack,results] = popOfType(stack, ...types );
    return [stack, results.map( r => r[1] )]; 
}

export function peek(stack:QueryStack, offset:number = 0):StackValue {
    return stack.items[ stack.items.length -1 - offset ];
}

export function peekV(stack:QueryStack ):any {
    const value = stack.items[ stack.items.length -1 ];
    if( value !== undefined ){
        return value[1];
    }
    return undefined;
}



/**
 * Replaces an item in the stack at the given index
 * 
 * @param stack 
 * @param index 
 * @param newItem 
 */
export function replace( stack:QueryStack, index:number, newItem:StackValue ): QueryStack {
    const items = stack.items.map( (item, ii) => {
        if( ii !== index ){
            return item;
        }
        return newItem;
    });
    return { ...stack, items };
}

/**
 * 
 */
export function findWithIndex( stack:QueryStack, type:StackOp ): [ number, StackValue ] {
    for( let ii = stack.items.length-1; ii >= 0; ii-- ){
        const item = stack.items[ii];
        if( type === item[0] ){
            // Log.debug('[findWithIndex]', 'found', item, ii );
            return [ii, item];
        }
    }
    return [-1, undefined];
}

export function findWithIndexV( stack:QueryStack, type:StackOp ): [number, any] {
    let [index, [_, value]] = findWithIndex(stack, type);
    if (index === -1) {
        throw new Error(`type ${type} missing on stack`);
    }
    return [index, value];
}

/**
 * Returns the first value of type from the stack
 * 
 * @param stack 
 * @param type 
 */
export function findV( stack:QueryStack, type:StackOp ): any {
    const [_, value] = findWithIndex( stack, type );
    return value ? value[1] : undefined;
}
export function find( stack:QueryStack, type:StackOp ): StackValue {
    const [_, value] = findWithIndex( stack, type );
    return value;
}


export interface ExecuteOptions {
    pushResult?:boolean;
}



export function addInstructionDef( stack:QueryStack, inst:InstModuleDef|InstModuleDef[] ){
    if( Array.isArray(inst) ){
        return inst.reduce( (st,ins) => addInstructionDef(st,ins), stack );
    }

    const { meta, compile, execute } = inst;
    const {op} = meta;

    const instructions = new Map<string, InstDef>( stack.instructions );
    
    if( Array.isArray(op) ){
        (op as string[]).map( o => {
            if( instructions.get(o) !== undefined ){
                Log.debug('[addInstructionDef]', 'warning overwriting inst', o, instructions.get(o));
            }
            instructions.set( o, inst )  
        });
    } else {
        if( instructions.get(op) !== undefined ){
            Log.debug('[addInstructionDef]', 'warning overwriting inst', op, instructions.get(op));
        }
        instructions.set( op, inst ); 
    }
    
    return {
        ...stack,
        instructions
    };
}

// export function getInstModule( stack:QueryStack, op:StackOp ): InstModuleDef {
//     return stack.instructions.get( op );
// }

export function getInstruction( stack:QueryStack, op:StackOp, moduleOnly:boolean = false ): InstDef {
    if( !moduleOnly ){
        const def = stack.defs[op];
        if( def !== undefined ){
            return def;
        }
    }
    return stack.instructions.get( op );
}


export function addDef( stack:QueryStack, name:string, value:StackValue ): QueryStack {
    const defs = {...stack.defs, [name]: value };
    return {...stack, defs};
}

export function getDef(stack:QueryStack, name:string): StackValue {
    return stack.defs[name];
}



export function assertStackSize( stack:QueryStack, expected:number, msg?:string ) {
    const len = stack.items.length;
    if( len < expected ){
        if( msg === undefined ){
            msg = `expected stack size ${expected}, actual: ${len}`;
        }
        throw new Error(msg);
    }
}

export function assertStackValueType( stack:QueryStack, index:number, opType:string, argType?:any ){
    // Log.debug('[assertStackValueType]', 'argType', argType );
    const len = stack.items.length;
    const idx = len -1 -index;
    if( idx < 0 ){
        throw new Error(`value out of bounds: -${index+1} : ${len}`);
    }
    const value:StackValue = stack.items[ idx ];
    if( value[0] !== opType ){
        throw new Error(`expected value of type ${opType} at index ${idx} : got ${value[0]}`);
    }
    if( argType !== undefined && typeof value[1] !== argType ){
        throw new Error(`expected arg of type ${argType} at index ${idx} : got ${typeof value[1]}`);
    }
}

// export function assertStackValue( value:StackValue, type:StackOp ) {
//     if( value[0] !== type ){
//         throw new Error(`expected value of type ${type} : got ${value[0]}`);
//     }
// }




// /**
//  * Returns an EntityList containing entities that match the given bitfield
//  * of dids along with the entitySet they belong to
//  * 
//  * @param stack 
//  * @param bf 
//  */
// export function matchEntities( stack:QueryStack, bf:BitField, options:MatchOptions = {} ): [EntityList, StackValue] {
//     const limit = options.limit !== undefined ? options.limit : Number.MAX_SAFE_INTEGER;

//     let eids:number[] = [];
//     let entities:EntityMap = new Map<number,BitField>();

//     // work down the stack
//     for( let ii = stack.items.length-1; ii >= 0; ii-- ){
//         if( eids.length >= limit ){
//             break;
//         }
//         const [type,val] = stack.items[ii];
//         // if( type === EntityT && getEntityId(val) !== 0 ){
//         //     Log.debug('[matchEntities]', getEntityId(val), bf.toValues(), val.bitField.toValues() )
//         // }
//         if( type === EntitySetT ){
//             return [ esMatchEntities( val, bf ) as EntityList, [type,val] ];
//         }
//         else if( type === EntityT ){
//             let eid = getEntityId(val);
//             if( eid !== 0 && BitField.or(bf, val.bitField) ){
                
//                 eids.push( eid );
//                 entities.set(eid,val.bitField);

//                 // return [createEntityList( [eid], bf), [type,val]];
//             }
//             // break;
//         }
//         else if( type === ComponentT ){
//             const did = getComponentDefId(val);
//             if( bf.get(did) === true ){
//                 return [ undefined,[type,val] ];
//             }
//         }
//     }

//     return [createEntityList(eids, bf),undefined];
// }


// /**
//  * Pops an Entity from the stack.
//  * If the top value is an EntityList or EntitySet, an array of entities is returneds
//  */
// export function popEntity( stack:QueryStack ): [QueryStack, Entity | Entity[]] {
//     let type
//     let val = undefined;
//     const top = peek( stack );

//     if( top === undefined ){
//         return [stack, undefined];
//     }

//     [type] = top;
    
//     if( type === EntityListType ){
//         [stack, [type, val]] = pop(stack);

//         // Log.debug('[dammit]',  type, val);
//         // Log.debug('[popEntity] resolving', val.entityIds )
//         val = resolveEntityList(stack, val);
//         // (val as EntityList).entityIds
//     }
//     else if( type === EntitySetT ){

//     }

//     return [stack, val];
// }


// function resolveEntityList( stack:QueryStack, list:EntityList ): Entity[] {
//     let result = [];

//     for( let ii = stack.items.length-1; ii >= 0; ii-- ){
//         const [type,val] = stack.items[ii];

//         if( type === EntityT ){
//             const eid = getEntityId(val);
//             // list.entityIds.find( leid => leid === eid )
//             if( list.entityIds.indexOf(eid) !== -1 ){
//                 result.push( val );
//             }
//         }
//         else if( type === EntitySetT ){
//             return getEntities( val, list );
//         }
//     }

//     return result;
// }