import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    findWithIndexV,
    peek as peekQueryStack,
    push,
    replace as replaceQueryStack,
    InstDefMeta,
    matchEntities,
    InstResult,
    popValuesOfTypeV,
    StackValue,
    pop
} from "../stack";
import {
    Type as ComponentRegistryCode,
    Type as ComponentRegistryT, getComponentDefs, resolveComponentDefIds 
} from "../../component_registry";
import { Type as ComponentDefT } from '../../component_def';

import { VL, valueOf } from "./value";
import { BitField } from "odgn-bitfield";
import { EntityListType } from "../../entity";


const Log = createLog('Inst][Select');

export const EQ = 'AL';

export enum Select {
    AllEntities = 'SEA',
    AllComponents = 'SCA',
    SomeEntities = 'SEO',
    SomeComponents = 'SCO',
    NoneEntities = 'SEN',
    NoneComponents = 'SCN',
};

export const meta:InstDefMeta = {
    op: Object.values(Select)
};

const fns = {
    [Select.AllEntities]: selectEntitiesWithAll,
    [Select.AllComponents]: selectComponentsWithAll,
    [Select.SomeEntities]: selectEntitiesWithSome,
    [Select.SomeComponents]: selectComponentsWithSome
};


/**
 * Select can only work on entities and components that have ids - orphaned entities
 * on the stack cannot be selected
 * 
 * Forms:
 * AL <defId> <args>
 * AL <defId>
 * AL <@d>
 */
export function execute( stack:QueryStack, op:string ):InstResult {
    let value:StackValue;
    const fn = fns[ op ];
    
    if( fn === undefined ){
        throw new Error(`op not found: ${op}`);
    }
    
    // Log.debug('[execute]', stack.items );

    [stack,value] = pop(stack);
    let did = value[1];

    // Log.debug('[execute]', 'did', value);

    // popValueOfType( stack, VL );

    did = Array.isArray(did) ? did : [did];

    return fn( stack, did );
    
    // return [stack];

    // if( args[0] === ComponentRegistryCode ){
    //     return executeSelectDefs( stack );       
    // }

    // // const leftV = valueOf(left);
    // // const rightV = valueOf(right);

    // // stack = pushQueryStack( stack, leftV === rightV, VL );

    // return stack;
}


/**
 * 
 * @param stack 
 * @param args component defIds
 */
function selectEntitiesWithAll( stack:QueryStack, dids:any[] ): InstResult {
    let value:StackValue;

    let [ ridx, registry ] = findWithIndexV( stack, ComponentRegistryT );
    
    // convert into a bitfield of def ids
    const bf = resolveComponentDefIds( registry, dids ) as BitField;
    
    let ents = matchEntities( stack, bf );
    
    // Log.debug('[selectEntitiesWithAll]', dids, bf );

    // add to stack
    [stack,value] = push( stack, [EntityListType,ents] );
    
    return [stack, value, false];
}

function selectEntitiesWithSome( stack:QueryStack, ...args:any[] ): InstResult {
    return [stack];
}

function selectComponentsWithAll( stack:QueryStack, ...args:any[] ): InstResult {
    return [stack];
}

function selectComponentsWithSome( stack:QueryStack, ...args:any[] ): InstResult {
    return [stack];
}





function executeSelectDefs( stack:QueryStack ):InstResult {

    // find the component registry
    let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    const defs = getComponentDefs(registry);

    return [defs.reverse().reduce( (st, def) => {
        [stack] = push( st, [ComponentDefT,def] );
        return stack;
    }, stack )];
}