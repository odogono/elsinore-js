import { createLog } from "../util/log";
import { isObject } from "../util/is";
import { ComponentRegistry } from "../component_registry";
import { Type as EntitySetType } from '../entity_set';
import { BitField } from "odgn-bitfield";
import { MatchOptions } from '../constants';
import { EntityList, createEntityList, Type as EntityT, Entity, getEntityId, EntityListType } from "../entity";


const Log = createLog('QueryStack');

export interface InstDefMeta {
    op: string | string[];
}

export interface InstDef {
    meta: InstDefMeta;
    compile: Function;
    execute: Function;
}

export type StackValue = [ Symbol, any ];

const AnyValue = Symbol.for('VL');

export interface QueryStack {
    items: StackValue[];
    instructions: Map<string, InstDef>;
}

export function create(){
    return {
        items: [],
        instructions: new Map<string, InstDef>()
    };
}

/**
 * Pushes a stack value onto the stack
 */
export function push( stack:QueryStack, value:StackValue ):QueryStack {
    return {
        ...stack,
        items: [...stack.items, value]
    };
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
export function pushV( stack:QueryStack, value:any, valueType = AnyValue ):QueryStack {
    let itemValue:StackValue = [ valueType, value ];
    if( isObject(value) && value.type ){
        itemValue = [value.type, value];
    }
    return push( stack, itemValue );
}

export function pop(stack:QueryStack): [QueryStack,StackValue] {
    const length = stack.items.length;
    if( length === 0 ){
        return undefined;
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
export function popValuesOfTypeV( stack:QueryStack, type:Symbol ): [QueryStack, any[]] {
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

export function peek(stack:QueryStack):StackValue {
    return stack.items[ stack.items.length -1 ];
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
export function findWithIndex( stack:QueryStack, type:Symbol ): [ number, StackValue ] {
    for( let ii = stack.items.length-1; ii >= 0; ii-- ){
        const item = stack.items[ii];
        if( type === item[0] ){
            // Log.debug('[findWithIndex]', 'found', item, ii );
            return [ii, item];
        }
    }
    return [-1, undefined];
}

export function findWithIndexV( stack:QueryStack, type:Symbol ): [number, any] {
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
export function findV( stack:QueryStack, type:Symbol ): any {
    const [_, value] = findWithIndex( stack, type );
    return value ? value[1] : undefined;
}

export function execute( stack:QueryStack, stmts:Array<Array<any>> ): QueryStack {
    return stmts.reduce( (stack, stmt) => {
        const [op, ...args] = stmt;
        // check whether the op is valid
        // Log.debug('[execute]', 'Looking for', op, 
        // Array.from(stack.instructions.keys()).map(k => k.description );

        const inst = getInstruction(stack, op );
        // Log.debug('[execute]', op, stmt )

        if( inst === undefined ){
            Log.debug('[execute]', 'instruction not found', op );
            return stack;
        }
        
        const result = inst.execute( stack, op, ...args );

        return result ?? stack;
    }, stack );
}


export function addInstruction( stack:QueryStack, inst:InstDef|InstDef[] ){
    if( Array.isArray(inst) ){
        return inst.reduce( (st,ins) => addInstruction(st,ins), stack );
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

export function getInstruction( stack:QueryStack, op:string ): InstDef {
    return stack.instructions.get( op );
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

    const def = (uri:string, ...args) => stmts.push( [ '@d', uri, ...args] );
    const component = (uri:string, props:object) => stmts.push( ['@c', uri, props]);
    const entity = () => stmts.push( [ '@e'] );
    const value = (registry:ComponentRegistry) => stmts.push( [ 'VL', registry ] );
    const inst = (...args) => stmts.push(args);

    buildFn( {inst, component, def, entity, value} );

    return stmts;
}

export function buildAndExecute( stack:QueryStack, buildFn:BuildQueryFn ): QueryStack {
    const stmts = build( stack, buildFn );
    stack = execute( stack, stmts );
    return stack;
}



/**
 * Returns an EntityList containing entities that match the given bitfield
 * of dids along with the entitySet they belong to
 * 
 * @param stack 
 * @param bf 
 */
export function matchEntities( stack:QueryStack, bf:BitField, options:MatchOptions = {} ): EntityList {
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
        if( type === EntityT && getEntityId(val) !== 0 && BitField.or(bf, val.bitField) ){
            eids.push( getEntityId(val) );
        }
    }

    return createEntityList(eids, bf);
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

        // Log.debug('[popEntity] resolving', val.entityIds )
        val = resolveEntityList(stack, val);
        // (val as EntityList).entityIds
    }
    else if( type === EntitySetType ){

    }

    return [stack, val];
}


function resolveEntityList( stack:QueryStack, list:EntityList ): Entity[] {
    let result = [];

    for( let ii = stack.items.length-1; ii >= 0; ii-- ){
        const [type,val] = stack.items[ii];

        if( type === EntityT ){
            const eid = getEntityId(val);
            // list.entityIds.find( leid => leid === eid )
            if( list.entityIds.indexOf(eid) !== -1 ){
                result.push( val );
            }
        }
    }

    return result;
}