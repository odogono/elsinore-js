import { createLog } from "../util/log";
import { isObject, isString } from "../util/is";
import { ComponentRegistry } from "../component_registry";
import { Type as ComponentT, getComponentDefId } from "../component";
import { Type as EntitySetT, matchEntities as esMatchEntities, EntitySet } from '../entity_set';
import { BitField } from "odgn-bitfield";
import { MatchOptions } from '../constants';
import { EntityList, createEntityList, Type as EntityT, Entity, getEntityId, EntityListType } from "../entity";
import { VL } from "./insts/value";


const Log = createLog('QueryStack');

export interface InstDefMeta {
    op: string | string[];
}


export interface InstModuleDef {
    meta: InstDefMeta;
    compile?: Function;
    execute?: Function;
}

export type InstDef = InstModuleDef | StackValue;

export type InstResult = [
    QueryStack, StackValue?, boolean?
];

export type StackOp = string;
export type StackValue = [ StackOp ] | [ StackOp, any ] ;

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

/**
 * Pushes a stack value onto the stack
 */
export function push( stack:QueryStack, value:any|StackValue ):[QueryStack,StackValue] {
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
            value = [op]
        } else {
            value = [VL, value];
        }
    }

    let instModule:InstModuleDef;
    let instDef = getInstruction( stack, op );

    if( isInstModuleDef(instDef) ){
        instModule = instDef as InstModuleDef;
    } else {
        [op] = value = (instDef as StackValue);
        instModule = getInstruction(stack,op) as InstModuleDef;
    }

    if( isInstModuleDef === undefined ){
        Log.debug(`unknown op ${op} ${JSON.stringify(value)}` );
        return [stack, value];
    }

    let doPush = true;
    
    if( instModule?.execute ){
        // Log.debug('[push][execute]', value );
        let result = instModule.execute(stack, ...value);
        if( Array.isArray(result) === false ){
            Log.debug('[push][execute]', 'undefined result from', op, result );
        }
        [stack,value,doPush] = result;
        // Log.debug('[push][execute]', 'post', op, value === undefined );
        // Log.debug('[push][execute]', 'post', stack.items.map( ([op,]) => op ) );
    }
    
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
        // Log.debug('[pushValues]', 'pre', value);
        [stack,value] = push( stack, value );
        // Log.debug('[pushValues]', 'post', value);
    }
    return [stack, value];
}

// export function pushValues( stack:QueryStack, values:StackValue[] ):QueryStack {
//     for(let ii=0;ii<values.length;ii++ ){
//         let [op,args] = values[ii];

//         const instDef = getInstruction( stack, op );
    
//         if( instDef === undefined ){
//             throw new Error(`unknown op ${op}: ${args}` );
//         }
        
//         let compiled:StackValue;

//         if( instDef.compile ){
//             // Log.debug('[pushValues][compile]', op, args );
//             [stack,compiled] = instDef.compile(stack, op, args);
//         } else {
//             compiled = [op,args];
//         }
        
//         stack = {...stack, items:[...stack.items, compiled] };

//         // stack = instDef.execute( stack, ...compiled );
//     }
//     return stack;
// }

// export function popExecute( stack:QueryStack ): QueryStack {
//     let inst:StackValue;

//     [stack, inst] = pop(stack);
    
//     const module = getInstruction(stack, inst[0] );

//     if( module === undefined ){
//         throw new Error(`instruction not found ${inst[0]}`);
//     }

//     stack = module.execute(stack, ...inst);

//     return stack;
// }

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
export function popValuesOfTypeV( stack:QueryStack, type:StackOp ): [QueryStack, any[]] {
    const length = stack.items.length;
    if( length === 0 ){
        return [stack, []];
    }

    let results = [];
    let ii = length-1;

    for( ii;ii>=0;ii-- ){
        const value = stack.items[ ii ];
        if( value[0] !== type ){
            break;
        }
        results.push( value );
    }

    // cut the stack down to size
    stack = {
        ...stack,
        items: stack.items.slice(0, ii+1)
    };

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


export interface ExecuteOptions {
    pushResult?:boolean;
}
/**
 * Executes the top instruction on the stack if it can be executed
 * pushes the result back onto the stack
 * 
 * pops, executes, pushes 
 * 
 * @param stack 
 */
// export function execute( stack:QueryStack, options:ExecuteOptions = {pushResult:true} ): [QueryStack,StackValue] {
//     let value:StackValue;

//     value = peek(stack);
//     const op = value[0];
    
//     const module = getInstruction(stack, op );

//     if( module === undefined ){
//         throw new Error(`instruction not found ${op}`);
//     }

//     [stack] = pop(stack);

//     if( module.execute ){

//         Log.debug('[execute]', op, value, module.execute );
//         [stack,value] = module.execute(stack, ...value);
        
//         Log.debug('[execute]', op, value, '->', stack.items )

//         if( value !== undefined && options.pushResult ){
//             Log.debug('[execute]', 'pushResult', value)
//             stack = push( stack, value );
//         }
//     }

//     return [ stack, value];
// }


/**
 * Pops and executes, returns the value
 * 
 * @param stack 
 */
// export function popExecute(stack:QueryStack): [QueryStack,StackValue] {
//     return execute( stack, {pushResult:false});
// }


// export function executeAll( stack:QueryStack ): QueryStack {
//     // stack.items.reverse().reduce( (stack, inst) => {
        
//     // }, stack );

//     while( true ){
//         let inst = peek(stack);
//         if( inst === undefined ){
//             return stack;
//         }
//         const module = getInstruction(stack, inst[0] );
//         if( module && module.execute ){
//             [stack] = pop(stack);
//             stack = module.execute(stack, ...inst);
//         }
//     }
// }

// export function executeOld( stack:QueryStack, stmts:any ): QueryStack {
//     return stack;
// }



export function addInstructionDef( stack:QueryStack, inst:InstModuleDef|InstModuleDef[] ){
    if( Array.isArray(inst) ){
        return inst.reduce( (st,ins) => addInstructionDef(st,ins), stack );
    }

    const { meta, compile, execute } = inst;
    const {op} = meta;

    const instructions = new Map<string, InstDef>( stack.instructions );
    
    if( Array.isArray(op) ){
        (op as string[]).map( o => instructions.set( o, {meta,compile,execute} )  );
    } else {
        instructions.set( op, {meta,compile,execute} ); 
    }
    
    return {
        ...stack,
        instructions
    };
}

// export function getInstModule( stack:QueryStack, op:StackOp ): InstModuleDef {
//     return stack.instructions.get( op );
// }

export function getInstruction( stack:QueryStack, op:StackOp ): InstDef {
    const def = stack.defs[op];
    if( def !== undefined ){
        return def;
    }
    return stack.instructions.get( op );
    // return stack.instructions.get( op );
}


export function addDef( stack:QueryStack, name:string, value:StackValue ): QueryStack {
    const defs = {...stack.defs, [name]: value };
    return {...stack, defs};
}

export function getDef(stack:QueryStack, name:string): StackValue {
    return stack.defs[name];
}


export type buildDefFn = (uri: string, ...args: any[]) => void;
export type buildComponentFn = (uri: string, props:object) => void;
export type buildInstFn = (...args: any[]) => void;
export type buildEntityFn = () => void;
export type buildValueFn = (registry: ComponentRegistry) => void;
export interface BuildQueryParams {
    def:buildDefFn, 
    component: buildComponentFn,
    entity:buildEntityFn,
    inst:buildInstFn,
    value:buildValueFn
}
export type BuildQueryFn = (BuildQueryParams) => void;

export function build( stack:QueryStack, buildFn:BuildQueryFn ):any[] {

    let stmts = [];

    const def = (uri:string, args) => 
        stmts = [...stmts, [VL, args], [VL, uri], [ '@d' ] ];
    const component = (uri:string, props:object) => 
        stmts = [...stmts, [VL,props], [VL,uri], ['@c']];
    const entity = () => stmts.push( [ '@e'] );
    const value = (registry:ComponentRegistry) => stmts.push( [ getValueType(registry), registry ] );
    const inst = (...args) => stmts.push(args);

    buildFn( {inst, component, def, entity, value} );

    

    return stmts;
}

function getValueType( value:any ): string {
    if( isObject(value) && isString(value.type) ){
        return value.type;
    }
    return VL;
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

export function buildAndExecute( stack:QueryStack, buildFn:BuildQueryFn ): QueryStack {
    const stmts = build( stack, buildFn );

    // Log.debug('[buildFn]', stmts);

    [stack] = pushValues( stack, stmts );

    // stack = stmts.reduce( (stack,inst) => push(stack,inst), stack );

    // [stack] = execute( stack );

    return stack;
}



/**
 * Returns an EntityList containing entities that match the given bitfield
 * of dids along with the entitySet they belong to
 * 
 * @param stack 
 * @param bf 
 */
export function matchEntities( stack:QueryStack, bf:BitField, options:MatchOptions = {} ): [EntityList, StackValue] {
    const limit = options.limit !== undefined ? options.limit : Number.MAX_SAFE_INTEGER;

    let eids:number[] = [];

    // work down the stack
    for( let ii = stack.items.length-1; ii >= 0; ii-- ){
        if( eids.length >= limit ){
            break;
        }
        const [type,val] = stack.items[ii];
        // if( type === EntityT && getEntityId(val) !== 0 ){
        //     Log.debug('[matchEntities]', getEntityId(val), bf.toValues(), val.bitField.toValues() )
        // }
        if( type === EntitySetT ){
            return [ esMatchEntities( val, bf ), [type,val] ];
        }
        else if( type === EntityT ){
            if( getEntityId(val) !== 0 && BitField.or(bf, val.bitField) ){
                
                eids.push( getEntityId(val) );

                // return [createEntityList( [getEntityId(val)], bf), [type,val]];
            }
            // break;
        }
        else if( type === ComponentT ){
            const did = getComponentDefId(val);
            if( bf.get(did) === true ){
                return [ undefined,[type,val] ];
            }
        }
    }

    return [createEntityList(eids, bf),undefined];
}


/**
 * Pops an Entity from the stack.
 * If the top value is an EntityList or EntitySet, an array of entities is returneds
 */
export function popEntity( stack:QueryStack ): [QueryStack, Entity | Entity[]] {
    let type
    let val = undefined;
    const top = peek( stack );

    if( top === undefined ){
        return [stack, undefined];
    }

    [type] = top;
    
    if( type === EntityListType ){
        [stack, [type, val]] = pop(stack);

        // Log.debug('[dammit]',  type, val);
        // Log.debug('[popEntity] resolving', val.entityIds )
        val = resolveEntityList(stack, val);
        // (val as EntityList).entityIds
    }
    else if( type === EntitySetT ){

    }

    return [stack, val];
}


function resolveEntityList( stack:QueryStack, list:EntityList ): Entity[] {
    let result = [];

    // Log.debug('[dammit]', stack.items );

    for( let ii = stack.items.length-1; ii >= 0; ii-- ){
        const [type,val] = stack.items[ii];

        if( type === EntityT ){
            const eid = getEntityId(val);
            if( !list.entityIds ){
            }
            // list.entityIds.find( leid => leid === eid )
            if( list.entityIds.indexOf(eid) !== -1 ){
                result.push( val );
            }
        }
    }

    return result;
}