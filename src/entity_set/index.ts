import { Component } from "../component";
import { BitField } from "odgn-bitfield";
import { createUUID } from "../util/uuid";


export type ComponentId = [number, number];

export class EntitySet {
    // readonly id: number;
    
    readonly uuid: string;
    
    // a map of {entity_id, def_id} to Component.t
    readonly components: Map<ComponentId, Component>;
    
    // a map of entityId to Bitfield
    readonly entities: Map<number, BitField>;

    constructor(){
        this.uuid = createUUID();
        this.components = new Map<ComponentId, Component>();
        this.entities = new Map<number, BitField>();
    }


    size(){
        return 0;
    }
}