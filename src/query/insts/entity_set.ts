import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    push as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta,
    StackValue,
    pop,
    InstResult,
    popOfTypeV,
    SType
} from "../stack";
import { 
    createComponent, 
    Type as ComponentRegistryT 
} from "../../component_registry";
import { Type as ComponentT, isComponent, Component } from '../../component';
import { Type as EntityT, isEntity, Entity } from '../../entity';
import { isObject } from "../../util/is";
import { stringify } from "../../util/json";
import { VL } from "./value";
import { Type as EntitySetT, create as createEntitySet, add as esAdd } from '../../entity_set';

const Log = createLog('Inst][EntitySet');

export const ES = '@es';
export const ESs = '!es';

export const meta:InstDefMeta = {
    op: [ES,ESs]
};


/**
 * '!es' - create es
 * @param stack 
 * @param param1 
 */
export function execute(stack: QueryStack, [op,arg]:StackValue ):InstResult {

    if( op === ES ){
        return [stack, [op,arg]];
    }

    let es = createEntitySet();
    let vals:(Entity|Component)[];

    // Log.debug('stack', stack.items );

    // look for components or entities preceeding and add them
    // consumes all previous Components on the stack
    [stack, vals] = popOfTypeV( stack, SType.Entity, SType.Component );

    // Log.debug('[execute]', 'adding', vals);
    es = esAdd( es, vals );

    return [stack, [ES, es]];
}
