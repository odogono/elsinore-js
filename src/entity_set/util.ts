import { EntitySetMem, EntitySet } from "./types";
import { 
    create as createEntityInstance,
    addComponentUnsafe,
    Entity 
} from "../entity";
import { 
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    or as bfOr,
    toValues as bfToValues
} from "../util/bitfield";
import { toComponentId, Component, getComponentDefId } from "../component";
import { getByDefId } from "./registry";
import { ComponentDefId } from "../component_def";

/**
 * 
 * @param es 
 * @param eid 
 */
export function getEntity(es: EntitySetMem, eid: number, populate:boolean = true): Entity {
    let ebf = es.entities.get(eid);
    if (ebf === undefined) {
        return undefined;
    }
    let e = createEntityInstance(eid,ebf);
    
    if( !populate ){
        return e;
    }

    for( const did of bfToValues(ebf) ){
        const com = es.components.get(toComponentId(eid, did));
        
        e = addComponentToEntity( es, e, com, did);
    }

    return e;
}




export function addComponentToEntity<ES extends EntitySet>(es: ES, e:Entity, com:Component, did?:ComponentDefId ): Entity {
    did = did === undefined ? getComponentDefId(com) : did;
    const def = getByDefId(es,did);
    return addComponentUnsafe(e, did, com, def.name);
}
