import {
    Component,
    getComponentDefId,
    setEntityId as setComponentEntityId
} from "./component";
import { isObject, isInteger } from './util/is';
import { 
    BitField,
    create as createBitField,
    set as bfSet,
    toValues as bfToValues
} from "./util/bitfield";

export const Type = '@e';

export const EntityListType = '@el';

export type EntityId = number;

// type EntityMap = Map<number, BitField>;
export type EntityMap = Map<EntityId, BitField>;

export interface EntityList {
    entityIds: EntityId[];
    // a map of entityId to comDef ids
    // NO - only entityIds, anything else runs the risk of becoming stale
    // entities: EntityMap;
    // used to record the bitfield that compiled this list
    // this enables the list to be used as an index
    bf?: BitField;
}

export interface Entity {
    [key: string]: any;
    
    [Type]: EntityId;

    // maps component defId to Component
    components: Map<number, Component>;

    // tracks component defIds contained on this entity
    bitField: BitField;
}

export function Entity(id: number = 0, bitField: BitField = createBitField()) {
    this.id = id;
    this.bitField = bitField;
    this.components = new Map<number, Component>();
}


export function create(id: number = 0, bitField: BitField = createBitField()): Entity {
    return {
        [Type]: id,
        components: new Map<number, Component>(),
        bitField
    }
}

export function createEntityList(entityIds: number[] = [], bf?: BitField): EntityList {
    return { entityIds, bf };
}

export function isEntityList(value: any): boolean {
    return isObject(value) && 'entityIds' in value;
}

// /**
//  * 
//  * @param entity 
//  * @param component 
//  */
// export function addComponent(e: Entity, com: Component): Entity {
//     const did = getComponentDefId(com);

//     if (did === 0) {
//         return e;
//     }

//     const entityId = getEntityId(e);

//     com = setComponentEntityId(com, entityId);

//     let components = new Map<number, Component>(e.components);
//     // components.set(did, com);

//     let bitField = createBitField(e.bitField);
//     // bitField = bfSet(bitField,did);

//     e = {
//         [Type]: entityId,
//         components,
//         bitField
//     };

//     return addComponentUnsafe( e, did, com );
// }

/**
 * A direct means of adding an already owned component to the entity
 * @param entity 
 * @param component 
 */
export function addComponentUnsafe( e: Entity, did: number, com: Component, name?:string): Entity {
    const eid = getEntityId(e);

    if( com === undefined ){
        e.components.delete(did);
        e.bitField = bfSet(e.bitField,did, false);
    } else {
        com = setComponentEntityId(com, eid);
        e.components.set(did, com);
        e.bitField = bfSet(e.bitField,did);
    }

    if( name !== undefined ){
        Object.defineProperty(e, name, { 
            get: () => e.components.get(did),
            set: (com:Component) => {
                if( getComponentDefId(com) === did ){
                    e.components.set(did,com);
                }
            }
        });
        
        
    }
    return e;
}

/**
 * 
 * @param entity 
 */
export function getEntityId(entity: Entity): EntityId {
    return isEntity(entity) ? entity[Type] : isInteger(entity as any) ? entity as any : 0;
}

export function setEntityId(entity: Entity, id: number): Entity {
    return { ...entity, [Type]: id };
}

export function getComponent(entity: Entity, defId: number): Component {
    return entity.components.get(defId);
}

export function getComponents(entity: Entity, bf?: BitField): Component[] {
    if (bf !== undefined) {
        return bfToValues(bf).map(did => entity.components.get(did)).filter(Boolean);
    }
    return Array.from(entity.components.values());
}

export function isEntity(item: any): boolean {
    return isObject(item) && Type in item;
}

export function size(entity: Entity): number {
    return entity.components.size;
}
