import { createLog } from "../util/log";
import { isObject } from "../util/is";
import { ComponentRegistry } from "../component_registry";


const Log = createLog('QueryStack');

export interface InstDefMeta {
    op: string;
}

export interface InstDef {
    meta: InstDefMeta;
    compile: Function;
    execute: Function;
}

type StackValue = [ Symbol, any ];

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
 * Pushes an arbirtrary value onto the stack
 */
export function pushV( stack:QueryStack, value:any, valueType = AnyValue ):QueryStack {
    let itemValue:StackValue = [ valueType, value ];
    if( isObject(value) && value.type ){
        itemValue = [value.type, value];
    }

    // console.log('[pushV]', [...stack.items, itemValue] );
    return {
        ...stack,
        items: [...stack.items, itemValue ]
    }
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
        // Log.debug('[execute]', op, stmt, inst )

        if( inst === undefined ){
            Log.debug('[execute]', 'instruction not found', op );
            return stack;
        }
        
        const result = inst.execute( stack, ...args );

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
    
    // Log.debug('[addInstruction]', 'adding inst', op);
    instructions.set( op, {meta,compile,execute} ); 

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
    const entity = () => stmts.push( ['AD', '@e'] );
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