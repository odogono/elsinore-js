import {
    Component, isComponent,
    ComponentId,
    getComponentId,
    getComponentDefId,
    getComponentEntityId,
    setEntityId as setComponentEntityId,
    toComponentId,
    isComponentId,
    fromComponentId,
    createComponentList,
    ComponentList,
    isComponentList
} from "../component";
import { BitField } from "odgn-bitfield";
import { createUUID } from "../util/uuid";
import {
    ComponentRegistry,
    resolveComponentDefIds as registryResolve,
    register
} from "../component_registry";
import {
    Entity,
    isEntity,
    getComponents as getEntityComponents,
    Type as EntityT,
    create as createEntityInstance,
    createBitfield,
    addComponentUnsafe,
    getEntityId,
    EntityList,
    createEntityList,
    isEntityList,
    EntityId
} from "../entity";
import { Type as ComponentDefT, ComponentDef } from '../component_def';
import {
    ChangeSet,
    create as createChangeSet,
    add as addCS, 
    update as updateCS, 
    remove as removeCS, 
    find as findCS,
    ChangeSetOp, getChanges
} from "./change_set";
import { generateId } from './simple_id';
import { createLog } from "../util/log";
import { isInteger, isObject, isString } from "../util/is";
import { MatchOptions } from '../constants';
import { matchEntities } from "./query";

export const Type = '@es';



const Log = createLog('EntitySet');

export interface EntitySet extends ComponentRegistry {
    isAsync: boolean;

    isEntitySet: boolean;

    uuid: string;

    entChanges: ChangeSet<number>;

    comChanges: ChangeSet<ComponentId>;

    // ugh, this is turning into a class, but query demands
    // a neutral way of accessing entitysets
    esAdd: (es,data) => any;
    esRegister: (es,def) => any;
    esGetComponentDefs: (es) => ComponentDef[];
    esGetComponent: (es,cid:(ComponentId|Component)) => any;
    esEntities: (es) => Promise<EntityList>;
    esGetEntity: (es,eid:EntityId) => Promise<Entity>;
}

export interface EntitySetMem extends EntitySet {
    isEntitySetMem: boolean;

    // a map of {entity_id, def_id} to Component.t
    components: Map<ComponentId, Component>;

    // a map of entityId to Bitfield
    entities: Map<number, BitField>;
}


export interface CreateEntitySetParams {
    uuid?: string;
    registry?: ComponentRegistry;
}

export function create(options: CreateEntitySetParams = {}): EntitySetMem {
    const uuid = options.uuid || createUUID();
    const components = new Map<ComponentId, Component>();
    const entities = new Map<number, BitField>();
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    return {
        isEntitySet: true,
        isAsync: false,
        isComponentRegistry: true,
        isEntitySetMem: true,
        uuid, components, entities, entChanges, comChanges,
        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),

        esAdd: add,
        esRegister: register,
        esGetComponentDefs: (es:EntitySetMem) => es.componentDefs,
        esGetComponent: getComponent,
        esEntities: (es:EntitySetMem) => Promise.resolve( createEntityList( Array.from(es.entities.keys())) ),
        esGetEntity: (es:EntitySetMem, eid:EntityId) => Promise.resolve( getEntity(es,eid) )
    }
}

export function isEntitySet(value: any): boolean {
    return isObject(value) && value.isEntitySet === true;
}


export interface AddOptions {
    retain?: boolean;
}

export type AddArrayType = (Entity | Component)[];// Entity[] | Component[];
export type AddType = Entity | Component | AddArrayType;
export type RemoveType = ComponentId | Entity | Component;


type ESAddFn<ES extends EntitySet> = (es:ES, item:AddType, options:AddOptions) => ES;

/**
 * 
 * @param es 
 * @param item 
 * @param options 
 */
export function add(es: EntitySetMem, item: AddType, options: AddOptions = {}): EntitySetMem {
    es = options.retain ? es : clearChanges(es);

    if (Array.isArray(item)) {
        // sort the incoming items into entities and components
        let [ents, coms] = (item as any[]).reduce(([ents, coms], item) => {
            if (isComponent(item)) {
                coms.push(item);
            } else if (isEntity(item)) {
                ents.push(item);
            }
            return [ents, coms];
        }, [[], []]);

        // Log.debug('[add]', ents)

        // add components on entities
        es = ents.reduce((es, e) => addComponents(es, getEntityComponents(e)), es);

        // add components
        es = addComponents(es, coms);
        es = applyRemoveChanges(es)
    }
    else if (isComponent(item)) {
        es = addComponents(es, [item as Component]);
    }
    else if (isEntity(item)) {
        let e = item as Entity
        es = markRemoveComponents(es, e[EntityT]);
        es = addComponents(es, getEntityComponents(e));
    }

    es = applyRemoveChanges(es)

    return es;
}

export function removeComponent(es: EntitySetMem, item: RemoveType, options: AddOptions = {}): EntitySetMem {
    es = options.retain ? es : clearChanges(es) as EntitySetMem;
    let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
    if (cid === undefined) {
        return es;
    }
    es = markComponentRemove(es, cid) as EntitySetMem;

    // Log.debug('[removeComponent]', es );
    return applyRemoveChanges(es);
}

export function removeEntity(es: EntitySetMem, item: (number | Entity), options: AddOptions = {}): EntitySetMem {
    es = options.retain ? es : clearChanges(es) as EntitySetMem;
    let eid = isInteger(item) ? item as number : isEntity(item) ? getEntityId(item as Entity) : 0;
    if (eid === 0) {
        return es;
    }
    es = markEntityComponentsRemove(es, eid);
    return applyRemoveChanges(es);
}

export function size(es: EntitySetMem): number {
    return es.entities.size;
}




/**
 * 
 * @param es 
 * @param eid 
 */
export function getEntity(es: EntitySetMem, eid: number): Entity {
    let ebf = es.entities.get(eid);
    if (ebf === undefined) {
        return undefined;
    }

    // Log.debug('[getEntity]', es.components );

    return ebf.toValues().reduce((e, did) => {
        const com = es.components.get(toComponentId(eid, did));
        // Log.debug('[getEntity]', [eid,did], com );
        return addComponentUnsafe(e, did, com);
    }, createEntityInstance(eid));
}


/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export function getComponent(es: EntitySetMem, id: ComponentId | Component): Component {
    if (isComponentId(id)) {
        return es.components.get(id as ComponentId);
    }
    const cid = getComponentId(id as Component);
    return es.components.get(cid);
}


// export function getComponents( es:EntitySet ): Component[] {
//     return Array.from( es.components.values() )
// }

// function addArray( es:EntitySet, items:AddArrayType, options:AddOptions = {}): EntitySet {
//     return es;
// }




export function getComponentsByDefId(es: EntitySetMem, bf: BitField, options: MatchOptions = {}): Component[] {
    let el = matchEntities(es, bf, { ...options, returnEntities: false }) as EntityList;
    const dids = bf.toValues();

    return el.entityIds.reduce((memo, eid) =>
        memo.concat(
            dids.map(did => es.components.get(toComponentId(eid, did))).filter(Boolean))
        , []);
}

/**
 * 
 * @param es 
 * @param list 
 */
export function getComponents(es: EntitySet, list: EntityList | ComponentList): Component[] {

    if (isEntityList(list)) {
        const el = list as EntityList;
        const dids = el.bf ? el.bf.toValues() : [];

        return el.entityIds.reduce((list, eid) => {
            return dids.reduce((list, did) => {
                list.push((es as EntitySetMem).components.get(toComponentId(eid, did)));
                return list;
            }, list);

        }, []);
    } else if (isComponentList(list)) {
        const cl = list as ComponentList;
        return cl.cids.map(cid => (es as EntitySetMem).components.get(cid));
    }

    return [];
}

/**
 * Resolves entity ids in a list to Entity instances
 * 
 * @param es 
 * @param list 
 */
export function getEntities(es: EntitySet, list: EntityList): Entity[] {
    let ents = [];
    return list.entityIds.reduce((ents, eid) => {
        return [...ents, getEntity(es as EntitySetMem, eid)];
    }, ents);
}

// export function reduce( es:EntitySet, list:EntityList, reduceFn, memo ) {
//     list.entityIds.reduce( (memo,eid) => {
//         es.entities.get(eid)
//     }, memo );
// }


export function clearChanges<ES extends EntitySet>(entitySet: ES): ES {
    return {
        ...entitySet,
        comChanges: createChangeSet(),
        entChanges: createChangeSet()
    };
}

function markRemoveComponents(es: EntitySetMem, id: number): EntitySetMem {
    if (id === 0) {
        return es;
    }

    const ebf = es.entities.get(id);
    if (ebf === undefined) {
        return es;
    }

    const dids = ebf.toValues();

    for (let ii = 0; ii < dids.length; ii++) {
        es = markComponentRemove(es, toComponentId(id, dids[ii])) as EntitySetMem;
    }

    return es;
}

function addEntities(es: EntitySetMem, ents: Entity[]): EntitySetMem {

    return es;
}

/**
 * 
 * @param es 
 * @param components 
 */
function addComponents(es: EntitySetMem, components: Component[]): EntitySetMem {
    // set a new (same) entity id on all orphaned components
    [es, components] = assignEntityIds(es, components)

    // Log.debug('[addComponents]', components);

    // mark incoming components as either additions or updates
    es = components.reduce((es, com) => markComponentAdd(es, com), es);

    // gather the components that have been added or updated and apply
    const changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)

    es = changedCids.reduce((es, cid) => applyUpdatedComponents(es, cid), es);

    return es;
}


function applyUpdatedComponents(es: EntitySetMem, cid: ComponentId): EntitySetMem {
    const [eid, did] = fromComponentId(cid);
    let ebf: BitField;

    [es, ebf] = getOrAddEntityBitfield(es, eid);

    const isNew = findCS( es.entChanges, eid ) === ChangeSetOp.Add;

    // Log.debug('[applyUpdatedComponents]', eid, isNew, ebf.get(did) === false );

    // does the component already belong to this entity?
    if (ebf.get(did) === false) {
        ebf = createBitfield(ebf);
        ebf.set(did);
        const entities = new Map<number, BitField>(es.entities);
        entities.set(eid, ebf);
        es = { ...es, entities };
        return isNew ? es : markEntityUpdate(es as EntitySet, eid) as EntitySetMem;
    }

    return isNew ? es : markEntityUpdate(es, eid) as EntitySetMem;
}

/**
 * 
 * @param es 
 */
function applyRemoveChanges(es: EntitySetMem): EntitySetMem {
    // applies any removal changes that have previously been marked
    const removedComs = getChanges(es.comChanges, ChangeSetOp.Remove);

    es = removedComs.reduce((es, cid) => applyRemoveComponent(es, cid), es);

    // Log.debug('[applyRemoveChanges]', es.entChanges );

    const removedEnts = getChanges(es.entChanges, ChangeSetOp.Remove);

    es = removedEnts.reduce((es, eid) => applyRemoveEntity(es, eid), es);

    return es;
}


function applyRemoveComponent(es: EntitySetMem, cid: ComponentId): EntitySetMem {
    let [eid, did] = fromComponentId(cid);

    // remove the component id from the entity
    let entities = new Map<number, BitField>(es.entities);
    let ebf = createBitfield(entities.get(eid));
    ebf.set(did, false);
    entities.set(eid, ebf);

    // remove component
    let components = new Map<ComponentId, Component>(es.components);
    components.delete(cid);

    es = {
        ...es,
        entities,
        components
    }

    // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

    if (ebf.count() === 0) {
        return markEntityRemove(es, eid) as EntitySetMem;
    }

    return es;
}

function applyRemoveEntity(es: EntitySetMem, eid: number): EntitySetMem {

    let entities = new Map<number, BitField>(es.entities);
    entities.delete(eid);

    return { ...es, entities };
}

/**
 * 
 * @param es 
 * @param com 
 */
export function markComponentAdd(es: EntitySetMem, com: Component): EntitySetMem {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId(com);
    const existing = getComponent(es, cid);

    // Log.debug('[markComponentAdd]', cid, existing );

    if (existing !== undefined) {
        return markComponentUpdate(es as EntitySet, cid) as EntitySetMem;
    }

    const components = new Map<ComponentId, Component>(es.components);
    components.set(cid, com);

    return { ...es, components, comChanges: addCS(es.comChanges, cid) };
}

export function markComponentUpdate(es: EntitySet, cid: ComponentId): EntitySet {
    return { ...es, comChanges: updateCS(es.comChanges, cid) };
}

export function markComponentRemove(es: EntitySet, cid: ComponentId): EntitySet {
    return { ...es, comChanges: removeCS(es.comChanges, cid) };
}

export function markEntityAdd(es: EntitySet, eid: number): EntitySet {
    // Log.debug('[markEntityAdd]', eid);
    return { ...es, entChanges: addCS(es.entChanges, eid) };
}
export function markEntityUpdate(es: EntitySet, eid: number): EntitySet {
    // Log.debug('[markEntityUpdate]', eid);
    // throw new Error('do not update');
    return { ...es, entChanges: updateCS(es.entChanges, eid) };
}
export function markEntityRemove(es: EntitySet, eid: number): EntitySet {
    return { ...es, entChanges: removeCS(es.entChanges, eid) };
}

function markEntityComponentsRemove(es: EntitySetMem, eid: number): EntitySetMem {
    const ebf = es.entities.get(eid);
    if (ebf === undefined) {
        return es;
    }

    return ebf.toValues().reduce((es, did) =>
        markComponentRemove(es, toComponentId(eid, did)), es as EntitySet) as EntitySetMem;
}


/**
 * Gets or Inserts an entity based on its id
 * 
 * @param es 
 * @param eid 
 */
function getOrAddEntityBitfield(es: EntitySetMem, eid: number): [EntitySetMem, BitField] {
    let ebf = es.entities.get(eid);
    if (ebf === undefined) {
        // {mark_entity(es, :add, eid), Entity.ebf()}
        return [markEntityAdd(es, eid) as EntitySetMem, createBitfield()];
    }

    return [es, ebf];
}

/**
 * Assigns entity ids to an array of components
 * 
 * @param es 
 * @param components 
 */
function assignEntityIds(es: EntitySetMem, coms: Component[]): [EntitySetMem, Component[]] {
    let set;
    let eid;

    [es, set, eid, coms] = coms.reduce(([es, set, eid, coms], com) => {

        let did = getComponentDefId(com);
        // Log.debug('[assignEntityIds]', 'com', did );

        // component already has an id - add it to the list of components
        if (getComponentEntityId(com) !== 0) {
            return [es, set, eid, [...coms, com]];
        }

        // not yet assigned an entity, or we have already seen this com type
        if (eid === 0 || set.has(did)) {
            // create a new entity - this also applies if we encounter a component
            // of a type we have seen before
            [es, eid] = createEntity(es);

            // Log.debug('[assignEntityIds]', 'new entity', did, set.has(did), eid );

            com = setComponentEntityId(com, eid);

            // # mark the def as having been seen, store the new entity, add the component
            // {es, MapSet.put(set, def_id), entity_id, [com | coms]}
            return [es, set.add(did), eid, [...coms, com]];
        } else {
            // Log.debug('[assignEntityIds]', 'already have', did, eid);
            // we have a new entity_id already
            com = setComponentEntityId(com, eid);
            return [es, set, eid, [...coms, com]];
        }

        // return [es, set, eid, coms];
    }, [es, new Set(), 0, []]);

    // Log.debug('[assignEntityIds]', 'coms', coms );

    return [es, coms];
}

export function createEntity(es: EntitySetMem): [EntitySetMem, number] {
    const eid = generateId();

    const entities = new Map<number, BitField>(es.entities);
    entities.set(eid, createBitfield());

    es = { ...es, entities };

    es = markEntityAdd(es, eid) as EntitySetMem;

    return [es, eid];
}