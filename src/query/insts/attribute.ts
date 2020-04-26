import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    push, StackValue, peek, InstResult, findWithIndexV, findV, } from "../stack";
import {
    Type as ComponentRegistryT, resolveComponentDefIds, resolveComponentDefAttribute
} from '../../component_registry';

import { VL, valueOf } from "./value";
import { getDefId } from "../../component_def";
import { Type as ComponentT, Component, getComponentDefId } from "../../component";
import { BitField } from "odgn-bitfield";
import { Entity, Type as EntityT, EntityList, getComponents as getEntityComponents } from "../../entity";
import { EntitySet, Type as EntitySetT, getComponents as getESComponents } from "../../entity_set";

const Log = createLog('Inst][Attribute');

// export const Type = '==';
export const Attribute = 'AT';
export const ComDefId = 'COM';

export const meta:InstDefMeta = {
    op: [Attribute, ComDefId]
};

// export function execute( stack:QueryStack, [op,arg]:StackValue  ):InstResult {
//     let value = compile(stack, op, arg );
//     return [stack, value ];
// }

export function compile( stack:QueryStack, [op,arg]:StackValue ): StackValue {
    let registry = findV( stack, ComponentRegistryT );
    const [bf,attrName] = resolveComponentDefAttribute( registry, arg );
    return [op, [bf,attrName]];
}

// export function executeOld( stack:QueryStack, op, args  ):InstResult {
//     let [ ridx, registry ] = findWithIndexV( stack, ComponentRegistryT );
    
//     // convert into a bitfield of def ids
//     const [bf,attrName] = resolveComponentDefAttribute( registry, args );
//     // resolve the did into ['AT' defId, attrName ]

//     let value:StackValue;
//     let ents:EntityList;
//     let container:(EntitySet|Entity);
//     let type;
//     let coms:Component[] = [];

//     // get the subject to match against
//     [ents, [type,container]] = matchEntities( stack, bf );
//     // [stack,[op,value]] = pop(stack);

//     // Log.debug('ok ents', ents.entityIds );

//     if( type === EntitySetT ){
//         coms = getESComponents( container as EntitySet, ents );
//     }
//     else if( type === EntityT ){
//         coms = getEntityComponents( container as Entity, bf );
//     }
//     else if( type === ComponentT ){
//         coms = [container as unknown as Component];
//     }

//     let attrs = coms.map( com => com[attrName] ).filter(Boolean);

//     if( attrs.length === 0 ){
//         value = [VL, undefined];
//     } else if( attrs.length === 1 ){
//         value = [ VL, attrs[0] ];
//     } else {
//         value = [VL,attrs];
//     }

//     return [stack, value ];
// }


function matchComponents( stack:QueryStack, bf:BitField, attrName:string) {

}