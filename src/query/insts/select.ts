import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    findWithIndexV,
    peek as peekQueryStack,
    pushV as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta,
    matchEntities
} from "../stack";
import {
    Code as ComponentRegistryCode,
    Type as ComponentRegistryT, getComponentDefs, resolveComponentDefIds 
} from "../../component_registry";
import { Token as ComponentDefT } from '../../component_def';

import { VL, valueOf } from "./value";
import { BitField } from "odgn-bitfield";
import { EntityListType } from "../../entity";


const Log = createLog('Inst][Select');

export const EQ = Symbol.for('AL');

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

export function compile() {
}


/**
 * Select can only work on entities and components that have ids - orphaned entities
 * on the stack cannot be selected
 * 
 * Forms:
 * AL <defId> <args>
 * AL <defId>
 * AL <@d>
 */
export function execute( stack:QueryStack, op:string, dids, ...args ) {
    // Log.debug('[execute]', args );

    const fn = fns[ op ];

    if( fn === undefined ){
        throw new Error(`op not found: ${op}`);
    }

    dids = Array.isArray(dids) ? dids : [dids];

    return fn( stack, dids );
    

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
function selectEntitiesWithAll( stack:QueryStack, dids:any[] ): QueryStack {
    
    let [ ridx, registry ] = findWithIndexV( stack, ComponentRegistryT );
    
    // convert into a bitfield of def ids
    const bf = resolveComponentDefIds( registry, dids ) as BitField;
    
    let ents = matchEntities( stack, bf );
    // Log.debug('[selectEntitiesWithAll]', dids, bf );

    // add to stack
    stack = pushQueryStack( stack, ents, EntityListType );
    
    return stack;
}

function selectEntitiesWithSome( stack:QueryStack, ...args:any[] ): QueryStack {
    return stack;
}

function selectComponentsWithAll( stack:QueryStack, ...args:any[] ): QueryStack {
    return stack;
}

function selectComponentsWithSome( stack:QueryStack, ...args:any[] ): QueryStack {
    return stack;
}





function executeSelectDefs( stack:QueryStack ):QueryStack {

    // find the component registry
    let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    const defs = getComponentDefs(registry);

    return defs.reverse().reduce( (st, def) => {
        return pushQueryStack( st, def, ComponentDefT );
    }, stack );
}