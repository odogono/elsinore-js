import { CreateEntitySetParams } from "../entity_set";
import { createUUID } from "../util/uuid";
import { ChangeSet,
    create as createChangeSet,
    add as addCS, update as updateCS, remove as removeCS, ChangeSetOp, getChanges 
} from "../entity_set/change_set";
import { ComponentId } from "../component";


/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export interface EntitySetIndexedDb {
    isEntitySet: boolean;
    
    uuid: string;
    
    // a map of {entity_id, def_id} to Component.t
    // components: Map<ComponentId, Component>;
    
    // a map of entityId to Bitfield
    // entities: Map<number, BitField>;

    entChanges: ChangeSet<number>;
    
    comChanges: ChangeSet<ComponentId>;
}


export function create({registry}:CreateEntitySetParams):EntitySetIndexedDb {
    const uuid = createUUID();
    
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    return {
        isEntitySet:true,
        uuid, entChanges, comChanges
    }
}