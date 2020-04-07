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
    resolveComponentDefIds as registryResolve
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
import { Type as ComponentDefT } from '../component_def';
import {
    ChangeSet,
    create as createChangeSet,
    add as addCS, update as updateCS, remove as removeCS, ChangeSetOp, getChanges
} from "./change_set";
import { generateId } from './simple_id';
import { createLog } from "../util/log";
import { isInteger, isObject, isString } from "../util/is";
import { MatchOptions } from '../constants';

export const Type = '@es';



const Log = createLog('EntitySet');

export interface EntitySet {
    isEntitySet: boolean;

    uuid: string;



    entChanges: ChangeSet<number>;

    comChanges: ChangeSet<ComponentId>;
}

export interface EntitySetMem extends EntitySet {
    isEntitySetMem: boolean;

    // a map of {entity_id, def_id} to Component.t
    components: Map<ComponentId, Component>;

    // a map of entityId to Bitfield
    entities: Map<number, BitField>;
}


export interface CreateEntitySetParams {
    registry?: ComponentRegistry;
}

export function create({ }: CreateEntitySetParams = {}): EntitySetMem {
    const uuid = createUUID();
    const components = new Map<ComponentId, Component>();
    const entities = new Map<number, BitField>();
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    return {
        isEntitySet: true,
        isEntitySetMem: true,
        uuid, components, entities, entChanges, comChanges
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

        es = ents.reduce((es, e) => addComponents(es, getEntityComponents(e)), es);

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
    es = options.retain ? es : clearChanges(es);
    let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
    if (cid === undefined) {
        return es;
    }
    es = markComponentRemove(es, cid);

    // Log.debug('[removeComponent]', es );
    return applyRemoveChanges(es);
}

export function removeEntity(es: EntitySetMem, item: (number | Entity), options: AddOptions = {}): EntitySetMem {
    es = options.retain ? es : clearChanges(es);
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


function clearChanges(entitySet: EntitySetMem): EntitySetMem {
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
        es = markComponentRemove(es, toComponentId(id, dids[ii]));
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

    // does the component already belong to this entity?
    if (ebf.get(did) === false) {
        ebf = createBitfield(ebf);
        ebf.set(did);
        const entities = new Map<number, BitField>(es.entities);
        entities.set(eid, ebf);
        return markEntityUpdate({ ...es, entities }, eid);
    }

    return markEntityUpdate(es, eid);
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
        return markEntityRemove(es, eid);
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
function markComponentAdd(es: EntitySetMem, com: Component): EntitySetMem {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId(com);
    const existing = getComponent(es, cid);

    // Log.debug('[markComponentAdd]', cid, existing );

    if (existing !== undefined) {
        return markComponentUpdate(es, cid);
    }

    const components = new Map<ComponentId, Component>(es.components);
    components.set(cid, com);

    return { ...es, components, comChanges: addCS(es.comChanges, cid) };
}

function markComponentUpdate(es: EntitySetMem, cid: ComponentId): EntitySetMem {
    return { ...es, comChanges: updateCS(es.comChanges, cid) };
}

function markComponentRemove(es: EntitySetMem, cid: ComponentId): EntitySetMem {
    return { ...es, comChanges: removeCS(es.comChanges, cid) };
}

function markEntityAdd(es: EntitySetMem, eid: number): EntitySetMem {
    return { ...es, entChanges: addCS(es.entChanges, eid) };
}
function markEntityUpdate(es: EntitySetMem, eid: number): EntitySetMem {
    return { ...es, entChanges: updateCS(es.entChanges, eid) };
}
function markEntityRemove(es: EntitySetMem, eid: number): EntitySetMem {
    return { ...es, entChanges: removeCS(es.entChanges, eid) };
}

function markEntityComponentsRemove(es: EntitySetMem, eid: number): EntitySetMem {
    const ebf = es.entities.get(eid);
    if (ebf === undefined) {
        return es;
    }

    return ebf.toValues().reduce((es, did) =>
        markComponentRemove(es, toComponentId(eid, did)), es);
}


/**
 * 
 * @param es 
 * @param eid 
 */
function getOrAddEntityBitfield(es: EntitySetMem, eid: number): [EntitySetMem, BitField] {
    let ebf = es.entities.get(eid);
    if (ebf === undefined) {
        // {mark_entity(es, :add, eid), Entity.ebf()}
        return [markEntityAdd(es, eid), createBitfield()];
    }

    return [es, ebf];
}

/**
 * Assigns entity ids to an array of components
 * 
 * @param es 
 * @param components 
 */
function assignEntityIds(es: EntitySetMem, components: Component[]): [EntitySetMem, Component[]] {
    let set;
    let eid;

    [es, set, eid, components] = components.reduce(([es, set, eid, components], com) => {

        let did = getComponentDefId(com);
        // Log.debug('[assignEntityIds]', 'com', did );

        // component already has an id - add it to the list of components
        if (getComponentEntityId(com) !== 0) {
            return [es, set, eid, [...components, com]];
        }

        // not yet assigned an entity, or we have already seen this com type
        if (eid === 0 || set.has(did)) {
            // create a new entity - this also applies if we encounter a component
            // of a type we have seen before
            [es, eid] = createEntity(es);

            // Log.debug('[assignEntityIds]', 'new entity', did, set.has(did), eid );

            com = setComponentEntityId(com, eid);

            // # mark the def as having been seen, store the new entity, add the component
            // {es, MapSet.put(set, def_id), entity_id, [com | components]}
            return [es, set.add(did), eid, [...components, com]];
        } else {
            // Log.debug('[assignEntityIds]', 'already have', did, eid);
            // we have a new entity_id already
            com = setComponentEntityId(com, eid);
            return [es, set, eid, [...components, com]];
        }

        // return [es, set, eid, components];
    }, [es, new Set(), 0, []]);

    // Log.debug('[assignEntityIds]', 'coms', es );

    return [es, components];
}

export function createEntity(es: EntitySetMem): [EntitySetMem, number] {
    const eid = generateId();

    const entities = new Map<number, BitField>(es.entities);
    entities.set(eid, createBitfield());

    es = { ...es, entities };

    es = markEntityAdd(es, eid);

    return [es, eid];
}



export interface ESQuery {
    '@e'?: number | string | string[]; // entity id
    '@d'?: string; // def id
    '@a'?: string; // attribute
    limit?: number;
}

const CVal = 'CV';

type QVal = ['VL', any];

// Entity Id
type QEI = ['@e', EntityId];

type QEA = ['EC', EntityId, BitField];

// Component Id
type QCI = ['@c', ComponentId];

// Def Id
type QDI = ['@d', number];
type QDA = ['DA', number, string];

// Def Bitfield
type QDB = ['@bf', BitField];

// Component Attribute
type QCAT = ['CA', ComponentId, string];

// Component Attribute Value
type QCATV = ['CV', ComponentId, any];


// ['==', VL, VL ]
// ['&&', VL, VL ]
// ['||', VL, VL ]

export type QueryResult = EntityList | ComponentList;


/**
 * Takes queries in the form
 *  [BF, <bitField>] - selects matching components
 *  [AT, <bitField>, <attrName>] - selects attributes
 * <BF> <BF> OR - matches entities which match either
 * @param es 
 */
export function query(es: EntitySet, registry: ComponentRegistry, query: ESQuery): QueryResult {
    let result;

    if (Array.isArray(query) && query[0] === '==') {
        Log.debug('[query][==]', query);
    }


    if (query['@e']) {
        result = queryEntity(es, registry, result, query['@e']);
    }

    if ('@d' in query) {
        result = queryComponentDef(es, registry, result, query['@d']);
    }

    if (query['@a'] !== undefined) {
        result = queryAttribute(es, result, query['@a']);
    }

    return result;
}


export function compileQueryPart(es: EntitySet, registry: ComponentRegistry, query): any {
    if (isObject(query)) {
        let result = [];
        if ('@e' in query) {
            let eid = query['@e'];
            if (isInteger(eid)) {
                result = ['@e', eid];
            } else {
                let bf = registryResolve(registry, eid) as BitField;
                result = ['EC', bf.toValues()];
            }
        }
        if ('@d' in query) {
            let did = query['@d'];
            did = Array.isArray(did) ? did : [did];
            let bf = registryResolve(registry, did) as BitField;
            
            did = bf.toValues();// bf.count() === 1 ? bf.toValues()[0] : bf.toValues();
            if (result[0] === '@e') {
                result[0] = 'EC';
            } else {
                result[0] = '@d';
            }
            result.push(did);

            // look up 
            // return [CVal, cid, c?.attributes[attr]];
        }

        if ('@a' in query) {
            if( result[0] === '@d' ){
                result[0] = 'CA';
            } else if( result[0] === 'EC' ){
                result[0] = 'CA';
            } else if( result[0] === '@e' ){
                result[0] = 'EA';
            }
            result.push( query['@a'] )
        }
        return result;
    }
}

function queryEntity(es: EntitySet, registry: ComponentRegistry, result, eq) {
    if (isInteger(eq)) {
        if ((es as EntitySetMem).entities.get(eq as number)) {
            result = createEntityList([eq as number], createBitfield());
        }
    } else if (isString(eq) || Array.isArray(eq)) {
        let dids: any = eq;
        dids = Array.isArray(dids) ? dids : [dids];
        let bf = registryResolve(registry, dids) as BitField;
        // Log.debug('[query][resolve]', dids, bf.toValues() );
        result = matchEntitiesII(es as EntitySetMem, bf);
    }
    return result;
}
function queryComponentDef(es: EntitySet, registry: ComponentRegistry, result, cq) {
    cq = (Array.isArray(cq) ? cq : [cq]) as string[];
    let bf = registryResolve(registry, cq) as BitField;
    let cids = [];

    // Log.debug('[query]', 'cids', (es as EntitySetMem).components.keys() );
    if (isEntityList(result)) {
        (result as EntityList).entityIds.reduce((cids, eid) => {
            let ebf = (es as EntitySetMem).entities.get(eid);
            let dids = bf.toValues();
            for (let ii = 0; ii < dids.length; ii++) {
                if (ebf.get(dids[ii])) {
                    cids.push(toComponentId(eid, dids[ii]));
                }
            }
            return cids;
        }, cids)
    }
    else {
        (es as EntitySetMem).components.forEach((v, cid) => {
            let c = fromComponentId(cid)[1];
            if (bf.get(c)) {
                cids.push(cid);
            }
        })
    }

    return createComponentList(cids);
    // Log.debug('[query]', 'resolved', bf );
}

function queryAttribute(es: EntitySet, result, attr: string) {
    // Log.debug('[query]', 'select attribute', attr);
    // Log.debug('[query]', 'ok', result);
    if (isComponentList(result)) {
        result = (result as ComponentList).cids.map(cid => {
            let c = (es as EntitySetMem).components.get(cid);
            return [CVal, cid, c?.attributes[attr]];
        }) as any;
    }
    else if (isEntityList(result)) {
        let { entityIds, bf } = (result as EntityList);
        let dids = bf.toValues();
        result = entityIds.reduce((vals, eid) => {
            return dids.reduce((vals, did) => {
                let cid = toComponentId(eid, did);
                let c = (es as EntitySetMem).components.get(cid);
                let ca = c?.attributes[attr];
                if (ca !== undefined) {
                    return [...vals, [CVal, cid, ca]];
                }
                return vals;
            }, vals);

            // return vals;
        }, []) as any;
    }
    return result;
}

function resolveComponentDefId(es: EntitySet, registry: ComponentRegistry, did: string) {

}

function matchEntitiesII(es: EntitySetMem, mbf: BitField): EntityList {
    let matches = [];
    // let entities = new Map<number,BitField>();
    // let {returnEntities, limit} = options;
    // limit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;

    const isAll = BitField.isAllSet(mbf);// mbf.toString() === 'all';
    for (let [eid, ebf] of es.entities) {
        if (isAll || BitField.and(mbf, ebf)) {
            matches.push(eid);
        }
    }
    return createEntityList(matches, mbf);
}

/**
 * Returns a list of entity ids which match against the bitfield
 * 
 * TODO - GET RID
 * @param es 
 * @param mbf 
 * @param options 
 */
export function matchEntities(es: EntitySetMem, mbf: BitField, options: MatchOptions = {}): EntityList | Entity[] {
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
    return returnEntities ? matches : createEntityList(matches, mbf);
}