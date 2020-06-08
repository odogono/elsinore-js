import { ChangeSet } from "./change_set";
import { ComponentId, Component } from "../component";
import { BitField } from "../util/bitfield";
import { ComponentDef } from "../component_def";
import { EntityList, Entity, EntityId } from "../entity";
import { StackValue } from "../query/types";


export interface EntitySet {
    type: string;
    isAsync: boolean;

    isEntitySet: boolean;

    uuid: string;

    entChanges: ChangeSet<number>;
    comChanges: ChangeSet<ComponentId>;

    comUpdates: Map<ComponentId,any>;
    entUpdates: Map<number,BitField>;

    componentDefs: ComponentDef[];
    byUri: Map<string, number>;
    byHash: Map<number, number>;

    // ugh, this is turning into a class, but query demands
    // a neutral way of accessing entitysets
    esAdd: (es,data,options) => any;
    esRegister: (es,def) => any;
    esGetComponentDefs: (es) => ComponentDef[];
    esGetComponent: (es,cid:(ComponentId|Component)) => any;
    esEntities: (es:EntitySet, bf?:BitField) => Promise<EntityList>;
    esGetEntity: (es,eid:EntityId, populate?:boolean) => Promise<Entity>;
    esSelect: (es, query:StackValue[], options) => Promise<StackValue[]>;
    esClone: (es) => Promise<EntitySet>;
    esSize: (es:this) => Promise<number>;
}

export interface EntitySetMem extends EntitySet {
    isEntitySetMem: boolean;

    // a map of {entity_id, def_id} to Component.t
    components: Map<ComponentId, Component>;

    entities: Map<EntityId, BitField>;
}
