import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    push as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta
} from "../stack";
import { 
    createComponent, 
    Type as ComponentRegistryT 
} from "../../component_registry";
import { Token as ComponentT } from '../../component';
import { isObject } from "../../util/is";
import { stringify } from "../../util/json";

const Log = createLog('Inst][CreateComponent');

export const meta:InstDefMeta = {
    op: '@c'
};

export function compile() {
}

export function execute(stack: QueryStack, op:string, uri, attributes ) {
    // find the ComponentRegistry in the stack
    let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    if (index === -1) {
        throw new Error('ComponentRegistry missing on stack');
    }
    
    const component = createComponent(registry, uri, attributes );
    
    // Log.debug('[execute]', 'created', attributes, component );

    stack = pushQueryStack( stack, [ ComponentT, component] );
    // stack = replaceQueryStack(stack, index, [type, registry]);

    // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
    // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

    return stack;
}