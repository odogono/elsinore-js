import { BitField } from 'odgn-bitfield';
import { Component } from "./component";




export class Entity {
    readonly id: number;

    // maps component defId to Component
    readonly components: Map<number, Component>;

    // tracks component defIds contained on this entity
    readonly bitfield: BitField;

    constructor( id: number = 0 ){
        this.id = id;
        this.components = new Map<number,Component>();
        this.bitfield = new BitField();
    }
}