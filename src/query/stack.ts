import { createLog } from "../util/log";
import { isObject } from "../util/is";


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

export function peek(stack:QueryStack):StackValue {
    return stack.items[ stack.items.length -1 ];
}

export function peekV(stack:QueryStack):any {
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


// export class QueryStackO {

//     items = [];
//     instructions = new Map<string, InstDef>();

//     constructor(){
//     }

    


//     execute( stmts:Array<Array<any>> ): QueryStack {
//         return stmts.reduce( (stack, stmt) => {
//             const [op, ...args] = stmt;
//             const inst = this.getInstruction(op);
//             if( !inst ){
//                 return stack;
//             }

//             return inst.execute( stack, ...args );
//         }, this );
//     }


    
// }

