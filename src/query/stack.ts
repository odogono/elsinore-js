import { createLog } from "../util/log";
import { isObject } from "../util/is";


const Log = createLog('QueryStack');

interface InstDef {
    compile: Function;
    execute: Function;
}

type Value = [ Symbol, any ];

const AnyValue = Symbol.for('any');

export interface QueryStack {
    items: Value[];
    instructions: Map<string, InstDef>;
}

export function create(){
    return {
        items: [],
        instructions: new Map<string, InstDef>()
    };
}

export function push( stack:QueryStack, value:Value ):QueryStack {
    return {
        ...stack,
        items: [...stack.items, value]
    };
}

export function pushV( stack:QueryStack, value:any ):QueryStack {
    let itemValue:Value = [ AnyValue, value ];
    if( isObject(value) && value.type ){
        itemValue = [value.type, value];
    }

    // console.log('[pushV]', [...stack.items, itemValue] );
    return {
        ...stack,
        items: [...stack.items, itemValue ]
    }
}

export function pop(stack:QueryStack): [QueryStack,Value] {
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

export function peek(stack:QueryStack):Value {
    return stack.items[ stack.items.length -1 ];
}

export function peekV(stack:QueryStack):any {
    const value = stack.items[ stack.items.length -1 ];
    if( value !== undefined ){
        return value[1];
    }
}

/**
 * Replaces an item in the stack at the given index
 * 
 * @param stack 
 * @param index 
 * @param newItem 
 */
export function replace( stack:QueryStack, index:number, newItem:Value ): QueryStack {
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
export function findWithIndex( stack:QueryStack, type:Symbol ): [ number, Value ] {
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
        const inst = getInstruction(stack, op);
        if( inst === undefined ){
            return stack;
        }
        
        // Log.debug('[execute]', op, inst )
        return inst.execute( stack, ...args );
    }, stack );
}

export function addInstruction( stack:QueryStack, {meta, compile, execute} ){
    const {op} = meta;

    const instructions = new Map( stack.instructions );
    instructions.set( op, {compile,execute} ); 
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

