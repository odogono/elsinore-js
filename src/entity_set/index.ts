import {
    Component, 
    isComponent,
    isComponentLike,
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
    isComponentList,
    OrphanComponent
} from "../component";
import { BitField } from "odgn-bitfield";
import { createUUID } from "../util/uuid";
import {
    resolveComponentDefIds as registryResolve,
    register,
    resolveComponent
} from "./registry";
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
    EntityId,
    setEntityId
} from "../entity";
import { Type as ComponentDefT, ComponentDef } from '../component_def';
import {
    ChangeSet,
    create as createChangeSet,
    add as addCS, 
    update as updateCS, 
    remove as removeCS, 
    find as findCS,
    merge as mergeCS,
    ChangeSetOp, getChanges
} from "./change_set";
import { generateId } from './simple_id';
import { createLog } from "../util/log";
import { isInteger, isObject, isString } from "../util/is";
import { MatchOptions } from '../constants';
import { select } from "./query";
import { StackValue } from "../query/stack";
import { buildFlake53 } from "../util/id";

export const Type = '@es';



const Log = createLog('ESMem');


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


export interface CreateEntitySetParams {
    uuid?: string;
}

export function create(options: CreateEntitySetParams = {}): EntitySetMem {
    const uuid = options.uuid || createUUID();
    const components = new Map<ComponentId, Component>();
    const entities = new Map<EntityId, BitField>();
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();
    const comUpdates = new Map<ComponentId,any>();
    const entUpdates = new Map<number,BitField>();

    return {
        type: 'mem',
        isEntitySet: true,
        isAsync: false,
        isEntitySetMem: true,
        uuid, components, entities, 
        entChanges, comChanges,
        entUpdates, comUpdates,
        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),

        esAdd: add,
        esRegister: register,
        esGetComponentDefs: (es:EntitySetMem) => es.componentDefs,
        esGetComponent: getComponent,
        esEntities: (es:EntitySetMem, bf?:BitField) => Promise.resolve( matchEntities(es, bf) ),
        esGetEntity: (es:EntitySetMem, eid:EntityId, populate:boolean) => Promise.resolve( getEntity(es,eid, populate) ),
        esSelect: select,
        esClone: clone,
        esSize: (es:EntitySetMem) => Promise.resolve(size(es)),
    }
}


async function clone(es:EntitySetMem){
    const {components,entities,byUri,byHash,entChanges,comChanges} = es;
    return {
        ...es,
        uuid: createUUID(),
        components: new Map<ComponentId,Component>(components),
        entities: new Map<EntityId,BitField>(entities),
        byUri: new Map<string,number>(byUri),
        byHash: new Map<number,number>(byHash),
        entChanges: createChangeSet(entChanges),
        comChanges: createChangeSet(comChanges),
    }
}

export function isEntitySet(value: any): boolean {
    return isObject(value) && value.isEntitySet === true;
}


export interface AddOptions {
    debug?:boolean;
    retain?: boolean;
}

export type AddArrayType = (Entity | Component)[];// Entity[] | Component[];
export type AddType = Entity | Component | OrphanComponent | AddArrayType;
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
            if (isComponentLike(item)) {
                coms.push(item);
            } else if (isEntity(item)) {
                ents.push(item);
            }
            return [ents, coms];
        }, [[], []]);

        // Log.debug('[add]', coms);

        // add components on entities
        for( const e of ents ){
            es = addComponents(es, getEntityComponents(e) );
        }

        // add components
        es = addComponents(es, coms);
    }
    else if (isComponentLike(item)) {
        es = addComponents(es, [item as Component]);
    }
    else if (isEntity(item)) {
        let e = item as Entity
        es = markRemoveComponents(es, e[EntityT]);
        es = addComponents(es, getEntityComponents(e));
    }

    es = applyRemoveChanges(es);

    if( es.entUpdates.size > 0 ){
        // Log.debug('[add]', 'applying entity updates', es.entUpdates );

        const entities = new Map<number, BitField>(es.entities);

        for( const [eid,bf] of es.entUpdates ){
            entities.set( eid, bf );
        }
        es = { ...es, entities };
        es.entUpdates.clear();
    }

    if( es.comUpdates.size > 0 ){
        // Log.debug('[add]', 'applying com updates', es.comUpdates );

        const components = new Map<ComponentId, Component>(es.components);
        
        for( const [cid,com] of es.comUpdates ){
            components.set(cid, com);
        }

        es = {...es, components};

        es.comUpdates.clear();
    }

    return es;
}

export function removeComponent(es: EntitySetMem, item: RemoveType, options: AddOptions = {}): EntitySetMem {
    es = options.retain ? es : clearChanges(es) as EntitySetMem;
    let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
    if (cid === undefined) {
        return es;
    }
    es = markComponentRemove(es, cid);

    // Log.debug('[removeComponent]', cid );
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
export function getEntity(es: EntitySetMem, eid: number, populate:boolean = true): Entity {
    let ebf = es.entities.get(eid);
    if (ebf === undefined) {
        return undefined;
    }
    let e = createEntityInstance(eid,ebf);
    if( !populate ){
        return e;
    }

    // Log.debug('[getEntity]', eid, ebf.toValues() );

    for( const did of ebf.toValues() ){
        const com = es.components.get(toComponentId(eid, did));
        // Log.debug('[getEntity]', eid, did, com );
        e = addComponentUnsafe(e, did, com);
    }

    return e;
    // return ebf.toValues().reduce((e, did) => {
    //     const com = es.components.get(toComponentId(eid, did));
    //     return addComponentUnsafe(e, did, com);
    // }, e);
}


/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export function getComponent(es: EntitySetMem, id: ComponentId | Component): Component {
    // Log.debug('[getComponent]', id);
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

function markRemoveComponents(es: EntitySetMem, eid: number): EntitySetMem {
    if (eid === 0) {
        return es;
    }

    const ebf = es.entities.get(eid);
    if (ebf === undefined) {
        return es;
    }

    // Log.debug('[markRemoveComponents]', eid, ebf.toValues() );

    for( const did of ebf.toValues() ){
        es = markComponentRemove(es, toComponentId(eid, did) );
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

    // to keep track of changes only in this function, we must temporarily replace
    let changes = es.comChanges;
    es.comChanges = createChangeSet<ComponentId>();
    // clearChanges()

    // mark incoming components as either additions or updates
    for( const com of components ){
        es = markComponentAdd(es,com);
    }
    // es = components.reduce((es, com) => markComponentAdd(es, com), es);

    // gather the components that have been added or updated and apply
    let changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)
    
    es.comChanges = mergeCS( changes, es.comChanges );

    // return changedCids.reduce((es, cid) => applyUpdatedComponents(es, cid), es);
    for( const cid of changedCids ){
        es = applyUpdatedComponents(es,cid);
    }
    return es;
}


function applyUpdatedComponents(es: EntitySetMem, cid: ComponentId): EntitySetMem {
    const [eid, did] = fromComponentId(cid);
    let ebf: BitField;

    [es, ebf] = getOrAddEntityBitfield(es, eid);

    const isNew = findCS( es.entChanges, eid ) === ChangeSetOp.Add;

    // Log.debug('[applyUpdatedComponents]', eid, did, isNew, ebf.get(did) === false );

    // does the component already belong to this entity?
    if (ebf.get(did) === false) {
        let e = createEntityInstance(eid);
        e.bitField = ebf;
        e.bitField.set(did);
        // Log.debug('[applyUpdatedComponents]', eid, cid, did, ebf.toValues() );

        // ebf = createBitfield(ebf);
        // ebf.set(did);

        e = setEntity(es, e);

        // const entities = new Map<number, BitField>(es.entities);
        // entities.set(eid, ebf);
        // es = { ...es, entities };
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

    for( const cid of removedComs ){
        es = applyRemoveComponent(es,cid);
    }
    // es = removedComs.reduce((es, cid) => applyRemoveComponent(es, cid), es);

    // Log.debug('[applyRemoveChanges]', removedComs );

    const removedEnts = getChanges(es.entChanges, ChangeSetOp.Remove);

    es = removedEnts.reduce((es, eid) => applyRemoveEntity(es, eid), es);

    return es;
}


function applyRemoveComponent(es: EntitySetMem, cid: ComponentId): EntitySetMem {
    let [eid, did] = fromComponentId(cid);

    // remove the component id from the entity
    let ebf = es.entUpdates.get(eid);
    // Log.debug('[applyRemoveComponent]', eid, did, ebf !== undefined ? ebf.toValues() : [] );

    if( ebf === undefined ){
        ebf = createBitfield( es.entities.get(eid) );
    }
    // if( ebf !== undefined ){
        ebf.set(did, false);
    // }

    // let entities = new Map<number, BitField>(es.entities);
    // let ebf = createBitfield(entities.get(eid));
    // ebf.set(did, false);
    // entities.set(eid, ebf);

    // remove component
    let components = new Map<ComponentId, Component>(es.components);
    components.delete(cid);

    es = {
        ...es,
        // entities,
        components
    }

    // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

    if (ebf.count() === 0) {
        return markEntityRemove(es, eid) as EntitySetMem;
    } else {
        es.entUpdates.set(eid, ebf);
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
    let existing;
    
    // try for already updated
    existing = es.comUpdates.get(cid);

    if( existing === undefined ){
        // hit the store
        existing = getComponent(es, cid);
    }

    // Log.debug('[markComponentAdd]', cid, existing );
    es.comUpdates.set( cid, com );

    if (existing !== undefined) {
        return markComponentUpdate(es as EntitySet, cid) as EntitySetMem;
    }

    
    return { ...es, comChanges: addCS(es.comChanges, cid) };
}

export function markComponentUpdate(es: EntitySet, cid: ComponentId): EntitySet {
    const comChanges = updateCS(es.comChanges, cid)
    // Log.debug('[markComponentUpdate]', cid, comChanges);
    return { ...es, comChanges };
}

export function markComponentRemove<ES extends EntitySet>(es: ES, cid: ComponentId): ES {
    // Log.debug('[markComponentRemove]', cid);
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

export function markEntityComponentsRemove(es: EntitySetMem, eid: number): EntitySetMem {
    const e = getEntity(es, eid, false);
    if (e === undefined) {
        return es;
    }

    // Log.debug('[markEntityComponentsRemove]', eid, e.bitField.toValues() );
    for( const did of e.bitField.toValues() ){
        es = markComponentRemove(es, toComponentId(eid,did));
    }
    return es;
    // return e.bitField.toValues().reduce((es, did) =>
    //     markComponentRemove(es, toComponentId(eid, did)), es as EntitySet) as EntitySetMem;
}


/**
 * Gets or Inserts an entity based on its id
 * 
 * @param es 
 * @param eid 
 */
function getOrAddEntityBitfield(es: EntitySetMem, eid: number): [EntitySetMem, BitField] {
    let record;

    record = es.entUpdates.get(eid);

    if( record === undefined ){
        record = es.entities.get(eid);

        if (record === undefined) {
            // {mark_entity(es, :add, eid), Entity.ebf()}
            return [markEntityAdd(es, eid) as EntitySetMem, createBitfield()];
        }
    }

    // Log.debug('[getOrAddEntityBitfield]', record.toValues() );

    let ebf = createBitfield(record);

    return [es, ebf];
}

/**
 * Assigns entity ids to an array of components
 * 
 * @param es 
 * @param components 
 */
export function assignEntityIds<ES extends EntitySet>(es: ES, components: Component[]): [ES, Component[]] {
    let coms = [];
    let eids = new Set();
    let eid = 0;
    let comEid = 0;
    for( let com of components ){
        // ensure the component did is resolved
        com = resolveComponent(es, com);

        let did = getComponentDefId(com);

        comEid = getComponentEntityId(com);
        
        // component already has an id - add it to the list of components
        if ( comEid !== 0 ) {
            coms.push(com);
            continue;
        }

        
        // not yet assigned an entity, or we have already seen this com type
        if ( eid === 0 || eids.has(did) ) {
            // create a new entity - this also applies if we encounter a component
            // of a type we have seen before
            [es,eid] = createEntityAlt(es);// await createEntity(es);
            comEid = eid;
            
            // Log.debug('[assignEntityIds]', 'new e', eid);

            eids = new Set();
            // mark the def as having been seen, store the new entity, add the component
            eids.add(did);
        } else {
            comEid = eid;
        }

        // Log.debug('[assignEntityIds]', 'com eid', {comEid, eid}, eids);

        com = setComponentEntityId(com, comEid);
        // Log.debug('[aei]', 'eid was', eid, com);
        coms.push(com);
    }

    return [es, coms];
}

export function createEntity<ES extends EntitySet>(es: ES): [ES, number] {
    
    let e = createEntityInstance();

    e = setEntity( es, e );

    const eid = getEntityId(e);

    es = markEntityAdd(es, eid ) as ES;

    return [es, eid];
}

// export function createEntity(es: EntitySetMem): [EntitySetMem, number] {
//     const eid = generateId();

//     const entities = new Map<number, BitField>(es.entities);
//     entities.set(eid, createBitfield());

//     es = { ...es, entities };

//     es = markEntityAdd(es, eid) as EntitySetMem;

//     return [es, eid];
// }

export function setEntity<ES extends EntitySet>(es:ES, e:Entity): Entity {
    let eid = getEntityId(e);
    let bf = e.bitField || createBitfield();

    if( eid === 0 ){
        eid = createEntityId();
    }
    // let bf = e.bitField !== undefined ? e.bitField.toValues() : [];

    // Log.debug('[setEntity]', eid, bf.toValues() );
    es.entUpdates.set(eid, bf);
    
    return setEntityId(e,eid);
}

const ESEpoch = 1577836800000; // 2020-01-01T00:00:00.000Z
let idSequence = 0;

function createEntityId(){
    return buildFlake53({timestamp:Date.now(), workerId:0, epoch:ESEpoch, sequence:idSequence++} );
}

export function createEntityAlt<ES extends EntitySet>(es: ES): [ES, EntityId] {
    let eid = createEntityId();
    es = markEntityAdd(es, eid) as ES;
    return [es,eid];
}



/**
 * Returns a list of entity ids which match against the bitfield
 * 
 * TODO - GET RID
 * @param es 
 * @param mbf 
 * @param options 
 */
export function matchEntities(es: EntitySetMem, mbf: BitField, options: MatchOptions = {}): EntityList {
    let matches = [];
    // let entities = new Map<number,BitField>();
    let { returnEntities, limit } = options;
    limit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;

    const isAll = BitField.isAllSet(mbf);// mbf.toString() === 'all';
    for (let [eid, ebf] of es.entities) {
        // console.log('[matchEntities]', 'limit', eid, mbf.toString(), ebf.toString(), BitField.or( mbf, ebf ));
        if (isAll || BitField.or(mbf, ebf)) {
            if (returnEntities) {
                matches.push(getEntity(es, eid));
            } else {
                matches.push(eid);
                // entities.set(eid, ebf);
            }

            if (matches.length >= limit) {
                break;
            }
        }
    }

    // Log.debug('[matchEntities]', 'dammit', entities );
    return createEntityList(matches, mbf);
}