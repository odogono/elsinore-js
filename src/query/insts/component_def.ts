import { createLog } from "../../util/log";
import { findWithIndex, QueryStack, 
    peek as peekQueryStack,
    replace as replaceQueryStack } from "../stack";
import { ComponentRegistry, register, Type as ComponentRegistryT } from "../../component_registry";
import { isObject } from "../../util/is";
import { stringify } from "../../util/json";

const Log = createLog('Inst][ComponentDef');

export const meta = {
    op: '@d'
};

export function compile() {
}

export function execute( stack:QueryStack, uri, properties ) {

    // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );

    // find the ComponentRegistry in the stack
    let [index, [type,registry]] = findWithIndex( stack, ComponentRegistryT );

    if( index === -1 ){
        throw new Error('ComponentRegistry missing on stack');
    }

    if( isObject(properties) ){
        if( properties.properties ){
            properties.uri = uri;
        } else {
            properties = {uri, properties };
        }
    }

    let [uregistry, def] = register( registry, properties );
    
    stack = replaceQueryStack( stack, index, [type,uregistry] );
    
    // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
    // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

    return stack;
}