import { createLog } from "../../util/log";
import { findWithIndex, QueryStack, 
    peek as peekQueryStack,
    replace as replaceQueryStack, 
    InstDefMeta,
    pop,
    StackValue} from "../stack";
import { ComponentRegistry, register, Type as ComponentRegistryT } from "../../component_registry";
import { isObject, isString } from "../../util/is";
import { stringify } from "../../util/json";

const Log = createLog('Inst][ComponentDef');

export const meta:InstDefMeta = {
    op: '@d'
};

export function execute( stack:QueryStack, op:string ) {
    let properties;
    let uri;
    let value:StackValue;
    let index:number;
    let registry:ComponentRegistry;
    let type:string;

    // pop uri
    [stack, value] = pop(stack);
    uri = value[1];

    // pop properties
    [stack, value] = pop(stack);
    properties = value[1];
    

    // Log.debug('[execute]', uri, properties ); //JSON.stringify( stack, null, '\t' ) );

    // find the ComponentRegistry in the stack
    [index, value] = findWithIndex( stack, ComponentRegistryT );

    if( index === -1 ){
        throw new Error('ComponentRegistry missing on stack');
    }

    [type,registry] = value;

    if( Array.isArray(properties) ){
        properties = {uri, properties};
    }
    else if( isObject(properties) ){
        if( properties.properties ){
            properties.uri = uri;
        } else {
            properties = {uri, properties };
        }
    } else if( isString(properties) ){
        properties = {uri, properties};
    }
    else if( properties === undefined ){
        properties = {uri, properties:[]};
    }

    // Log.debug('[execute]', uri, properties);
    let [uregistry, def] = register( registry, properties );
    
    stack = replaceQueryStack( stack, index, [type,uregistry] );
    
    // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
    // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

    return [stack];
}