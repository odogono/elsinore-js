import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    push as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta,
    StackValue,
    pop
} from "../stack";
import { 
    createComponent, 
    Type as ComponentRegistryT 
} from "../../component_registry";
import { Type as ComponentT } from '../../component';
import { isObject } from "../../util/is";
import { stringify } from "../../util/json";

const Log = createLog('Inst][CreateComponent');

export const meta:InstDefMeta = {
    op: '@c'
};


export function execute(stack: QueryStack, op:string ) {
    let value:StackValue;

    let uri:string;
    let attributes:object;

    // pop uri
    [stack, value] = pop(stack);
    uri = value[1];

    // pop properties
    [stack, value] = pop(stack);
    attributes = value[1];

    // find the ComponentRegistry in the stack
    let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    if (index === -1) {
        throw new Error('ComponentRegistry missing on stack');
    }
    
    const component = createComponent(registry, uri, attributes );
    
    // Log.debug('[execute]', 'created', attributes, component );

    value = [ ComponentT, component];
    // stack = pushQueryStack( stack, [ ComponentT, component] );
    // stack = replaceQueryStack(stack, index, [type, registry]);

    // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
    // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

    return [stack, value];
}