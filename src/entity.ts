import { BitField } from 'odgn-bitfield';
import { Component, getComponentDefId, setEntityId as setComponentEntityId } from "./component";
import { isObject } from './util/is';

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
    [Type]: EntityId;

    // maps component defId to Component
    components: Map<number, Component>;

    // tracks component defIds contained on this entity
    bitField: BitField;
}


export function create( id:number = 0 ):Entity {
    return {
        [Type]: id,
        components: new Map<number,Component>(),
        bitField: new BitField()
    }
}

export function createEntityList( entityIds:number[] = [], bf?:BitField ): EntityList {
    return {entityIds, bf};
}

export function isEntityList(value:any):boolean {
    return isObject(value) && 'entityIds' in value;
}

export function createBitfield( ebf?:BitField|'all' ):BitField {
    return new BitField(ebf);
}

/**
 * 
 * @param entity 
 * @param component 
 */
export function addComponent( entity:Entity, com:Component ):Entity {
    const defId = getComponentDefId(com);
    
    if( defId === 0 ){
        return entity;
    }

    const entityId = getEntityId(entity);
    
    com = setComponentEntityId( com, entityId );

    let components = new Map<number, Component>( entity.components );
    components.set( defId, com );

    let bitField = new BitField( entity.bitField );
    bitField.set( defId );

    return {
        [Type]: entityId,
        components,
        bitField
    };
}

/**
 * A direct means of adding an already owned component to the entity
 * @param entity 
 * @param component 
 */
export function addComponentUnsafe( entity:Entity, defId: number, component:Component ):Entity {
    entity.components.set( defId, component );
    entity.bitField.set( defId );
    return entity;
}

/**
 * 
 * @param entity 
 */
export function getEntityId( entity:Entity ): number {
    return entity ? entity[Type] : 0;
}

export function setEntityId( entity:Entity, id:number ): Entity {
    return entity;
}

export function getComponent( entity:Entity, defId:number ): Component {
    return entity.components.get(defId);
}

export function getComponents(entity:Entity, bf?:BitField): Component[] {
    if( bf !== undefined ){
        return bf.toValues().map( did => entity.components.get(did) ).filter(Boolean);
    }
    return Array.from( entity.components.values() );
}

export function isEntity( item:any ): boolean {
    return isObject(item) && Type in item;
}

export function size( entity:Entity ): number {
    return entity.components.size;
}
