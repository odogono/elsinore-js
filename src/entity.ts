import { BitField } from 'odgn-bitfield';
import { Component, getComponentDefId, setEntityId as setComponentEntityId } from "./component";

export const Code = '@e';
export const Token = Symbol.for(Code);


export interface Entity {
    [Token]: number;

    // maps component defId to Component
    components: Map<number, Component>;

    // tracks component defIds contained on this entity
    bitField: BitField;
}


export function create( id:number = 0 ):Entity {
    return {
        [Token]: id,
        components: new Map<number,Component>(),
        bitField: new BitField()
    }
}

/**
 * 
 * @param entity 
 * @param component 
 */
export function addComponent( entity:Entity, component:Component ):Entity {
    const defId = getComponentDefId(component);
    // console.log('[Entity][addComponent]', defId );
    if( defId === 0 ){
        return entity;
    }

    const entityId = getEntityId(entity);
    
    setComponentEntityId( component, entityId );

    let components = new Map<number, Component>( entity.components );
    components.set( defId, component );

    let bitField = new BitField( entity.bitField );
    bitField.set( defId );

    return {
        [Token]: entityId,
        components,
        bitField
    };
}

/**
 * 
 * @param entity 
 */
export function getEntityId( entity:Entity ): number {
    return entity ? entity[Token] : 0;
}

export function setEntityId( entity:Entity, id:number ): Entity {
    return entity;
}

export function getComponent( entity:Entity, defId:number ): Component {
    return entity.components.get(defId);
}