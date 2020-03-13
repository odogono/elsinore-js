import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    push, StackValue, peek, InstResult, findWithIndexV, matchEntities, } from "../stack";
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

export const meta:InstDefMeta = {
    op: 'AT'
};

export function execute( stack:QueryStack, op, args  ):InstResult {
    let [ ridx, registry ] = findWithIndexV( stack, ComponentRegistryT );
    
    // convert into a bitfield of def ids
    const [bf,attrName] = resolveComponentDefAttribute( registry, args );
    // resolve the did into ['AT' defId, attrName ]

    let value:StackValue;
    let ents:EntityList;
    let container:(EntitySet|Entity);
    let type;
    let coms:Component[] = [];

    // get the subject to match against
    [ents, [type,container]] = matchEntities( stack, bf );
    // [stack,[op,value]] = pop(stack);

    // Log.debug('ok ents', ents.entityIds );

    if( type === EntitySetT ){
        coms = getESComponents( container as EntitySet, ents );
    }
    else if( type === EntityT ){
        coms = getEntityComponents( container as Entity, bf );
    }
    else if( type === ComponentT ){
        coms = [container as unknown as Component];
    }

    // Log.debug('ok coms', attrName, coms );

    // if( op === ComponentT ){
    //     let com = value as unknown as Component;

    //     if( bf.get( getComponentDefId(com) ) ){
    //         coms.push( com );
    //     }
    // } else {
    //     Log.debug('unhandled op', op);
    // }

    let attrs = coms.map( com => com[attrName] ).filter(Boolean);

    if( attrs.length === 0 ){
        value = [VL, undefined];
    } else if( attrs.length === 1 ){
        value = [ VL, attrs[0] ];
    } else {
        value = [VL,attrs];
    }

    return [stack, value ];
}


function matchComponents( stack:QueryStack, bf:BitField, attrName:string) {

}