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
import { ComponentDefId } from "./component_def";

export const Type = '@e';

export const EntityListType = '@el';

export type EntityId = number;

// type EntityMap = Map<number, BitField>;
export type EntityMap = Map<EntityId, BitField>;

export class EntityList {
    eids: EntityId[];
    // a map of entityId to comDef ids
    // NO - only entityIds, anything else runs the risk of becoming stale
    // entities: EntityMap;
    // used to record the bitfield that compiled this list
    // this enables the list to be used as an index
    bf?: BitField;

    constructor( eids:EntityId[] = [], bf?: BitField){
        this.eids = eids;
        this.bf = bf;
    }
}

export function isEntityList(value: any): boolean {
    return isObject(value) && 'entityIds' in value;
}



export class Entity {
    id: EntityId = 0;
    
    // maps component defId to Component
    components: Map<ComponentDefId, Component> = new Map<ComponentDefId,Component>();

    // tracks component defIds contained on this entity
    bitField: BitField;

    isEntity:boolean = true;

    constructor(id:EntityId = 0, bitField:BitField = createBitField()){
        this.id = id;
        this.bitField = bitField;
    }

    /**
     * A direct means of adding an already owned component to the entity
     * @param entity 
     * @param component 
     */
    addComponentUnsafe( did: number, com: Component, name?:string): Entity {
        const eid = getEntityId(this);
    
        if( com === undefined ){
            this.components.delete(did);
            this.bitField = bfSet(this.bitField,did, false);
        } else {
            com = setComponentEntityId(com, eid);
            this.components.set(did, com);
            this.bitField = bfSet(this.bitField,did);
        }
    
        if( name !== undefined ){
            Object.defineProperty(this, name, { 
                get: () => this.components.get(did),
                set: (com:Component) => {
                    if( getComponentDefId(com) === did ){
                        this.components.set(did,com);
                    }
                }
            });
        }
        return this;
    }

    getComponent(defId: ComponentDefId): Component {
        return this.components.get(defId);
    }

    getComponents(bf?: BitField): Component[] {
        if (bf !== undefined) {
            return bfToValues(bf).map(did => this.components.get(did)).filter(Boolean);
        }
        return Array.from(this.components.values());
    }

    get size():number {
        return this.components.size;
    }

}


/**
 * 
 * @param entity 
 */
export function getEntityId(entity: Entity): EntityId {
    return isEntity(entity) ? entity.id : isInteger(entity as any) ? entity as any : 0;
}

export function isEntity(item: any): boolean {
    return isObject(item) && item['isEntity'] === true;
}

