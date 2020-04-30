import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    push as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta,
    StackValue,
    pop,
    InstResult
} from "../stack";
import { 
    createComponent, 
    Type as ComponentRegistryT 
} from "../../component_registry";
import { Type as ComponentT, isComponent, Component } from '../../component';
import { isObject } from "../../util/is";


const Log = createLog('Inst][Component');

export const COM = '@c';
export const COMs = '!c';

export const meta:InstDefMeta = {
    op: [COM,COMs]
};


/**
 * '@c' {} - create component
 * '@c' BitField - select component
 * '@c' 
 * @param stack 
 * @param param1 
 */
export function execute(stack: QueryStack, [op,arg]:StackValue ):InstResult {

    if( op === COM ){
        // if( !isComponent(arg) ){
        //     arg = createComponent(arg);
        // }
        return [stack, [op,arg]];
    }

    let value:StackValue;
    let index:number;

    let uri:string;
    let attributes:object;
    let com:Component;

    [uri,attributes,com] = parse(arg);

    if( com !== undefined ){
        return [stack, [op,com]];
    }

    
    // Log.debug('create', uri, attributes, arg);
    // Log.debug('stack', stack.items);
    if( uri === undefined ){
        // pop uri
        [stack, value] = pop(stack);
        [uri,attributes] = parse( value[1] );
    }
    if( attributes === undefined ){
        // pop attributes
        [stack, value] = pop(stack);
        attributes = value[1];
    }
    
    // throw 'stop';

    // find the ComponentRegistry in the stack
    [index, value] = findWithIndex(stack, ComponentRegistryT);

    if (index === -1) {
        Log.debug('no reg', stack.items);
        // return [stack, [COM, { [COM]:uri, ...attributes} ]]
        throw new Error('ComponentRegistry missing on stack');
    }

    // Log.debug('wait', uri, attributes, arg);

    let [,registry] = value;
    
    com = createComponent(registry, uri, attributes );

    return [stack, [ ComponentT, com]];
}

function parse( value:any ): [string?, object?,Component?] {
    if( Array.isArray(value) && value[0] === 'VL' ){
        value = value[1];
    }
    if( isObject(value) ){
        if( isComponent(value) ){
            return [undefined, undefined,value]; //[stack, [op,arg]];
        }
        let { [COM]:uri, ...attributes} = value;
        // Log.debug('dammit', uri, attributes );
        return [uri, attributes];
    }
    return [value];
}