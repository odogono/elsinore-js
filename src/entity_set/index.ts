import { Component, isComponent, 
    ComponentId,
    getComponentId,
    getComponentDefId, 
    getComponentEntityId,
    setEntityId as setComponentEntityId,
    toComponentId,
    isComponentId,
    fromComponentId
 } from "../component";
import { BitField } from "odgn-bitfield";
import { createUUID } from "../util/uuid";
import { ComponentRegistry } from "../component_registry";
import { Entity, 
    isEntity, 
    getComponents as getEntityComponents, 
    Type as EntityT, 
    create as createEntityInstance,
    createBitfield, 
    addComponentUnsafe,
    getEntityId,
    EntityList,
    createEntityList} from "../entity";
import { ChangeSet,
    create as createChangeSet,
    add as addCS, update as updateCS, remove as removeCS, ChangeSetOp, getChanges 
} from "./change_set";
import { generateId } from './simple_id';
import { createLog } from "../util/log";
import { isInteger, isObject } from "../util/is";
import { MatchOptions } from '../constants';

export const Type = '@es';



const Log = createLog('EntitySet');

export interface EntitySet {
    type: typeof Type;
    
    uuid: string;
    
    // a map of {entity_id, def_id} to Component.t
    components: Map<ComponentId, Component>;
    
    // a map of entityId to Bitfield
    entities: Map<number, BitField>;

    entChanges: ChangeSet<number>;
    
    comChanges: ChangeSet<ComponentId>;
}


export interface CreateEntitySetParams{
    registry?: ComponentRegistry;
}

export function create({registry}:CreateEntitySetParams):EntitySet {
    const uuid = createUUID();
    const components = new Map<ComponentId, Component>();
    const entities = new Map<number, BitField>();
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    return {
        type: Type,
        uuid, components, entities, entChanges, comChanges
    }
}

export function isEntitySet( value:any ):boolean {
    return isObject(value) && value.type === Type;
}


export interface AddOptions {
    retain?: boolean;
}

export type AddArrayType = Entity[] | Component[];
export type AddType = Entity | Component | AddArrayType;
export type RemoveType = ComponentId | Entity | Component;

/**
 * 
 * @param es 
 * @param item 
 * @param options 
 */
export function add( es:EntitySet, item:AddType, options:AddOptions = {}):EntitySet {
    es = options.retain ? es : clearChanges(es);

    if( Array.isArray(item) ){
        // sort the incoming items into entities and components
        let [ents,coms] = (item as any[]).reduce( ([ents,coms], item ) => {
            if( isComponent(item) ){
                coms.push(item);
            }else if( isEntity(item) ){
                ents.push(item);
            }
            return [ents,coms];
        }, [[],[]] );

        // Log.debug('[add]', ents)
    
        es = ents.reduce( (es,e) => addComponents(es, getEntityComponents(e)), es );

        es = addComponents(es, coms);
        es = applyRemoveChanges(es)
    }
    else if( isComponent(item) ){
        es = addComponents( es, [item as Component] );
    }
    else if( isEntity(item) ){
        let e = item as Entity
        es = markRemoveComponents(es, e[EntityT] );
        es = addComponents( es, getEntityComponents(e) );
    }

    es = applyRemoveChanges(es)
    
    return es;
}

export function removeComponent( es:EntitySet, item:RemoveType, options:AddOptions = {}): EntitySet {
    es = options.retain ? es : clearChanges(es);
    let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
    if( cid === undefined ){
        return es;
    }
    es = markComponentRemove( es, cid );

    // Log.debug('[removeComponent]', es );
    return applyRemoveChanges(es);
}

export function removeEntity( es:EntitySet, item:(number|Entity), options:AddOptions = {} ):EntitySet {
    es = options.retain ? es : clearChanges(es);
    let eid = isInteger(item) ? item as number : isEntity(item) ? getEntityId(item as Entity) : 0;
    if( eid === 0 ){
        return es;
    }
    es = markEntityComponentsRemove( es, eid );
    return applyRemoveChanges(es);
}

export function size(entitySet:EntitySet): number {
    return entitySet.entities.size;
}




/**
 * 
 * @param es 
 * @param eid 
 */
export function getEntity( es:EntitySet, eid:number ): Entity {
    let ebf = es.entities.get(eid);
    if( ebf === undefined ){
        return undefined;
    }

    // Log.debug('[getEntity]', es.components );

    return ebf.toValues().reduce( (e,did) => {
        const com = es.components.get( toComponentId(eid,did) );
        // Log.debug('[getEntity]', [eid,did], com );
        return addComponentUnsafe(e, did, com);
    }, createEntityInstance(eid) );
}


/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export function getComponent( es:EntitySet, id:ComponentId|Component ): Component {
    if( isComponentId(id) ){
        return es.components.get( id as ComponentId );
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



/**
 * Returns a list of entity ids which match against the bitfield
 * 
 * @param es 
 * @param mbf 
 * @param options 
 */
export function matchEntities( es:EntitySet, mbf:BitField, options:MatchOptions = {} ): EntityList {
    let matches = [];
    const limit = options.limit !== undefined ? options.limit : Number.MAX_SAFE_INTEGER;

    const isAll = BitField.isAllSet(mbf);// mbf.toString() === 'all';
    for( let [eid, ebf] of es.entities ){
        // console.log('[matchEntities]', 'limit', eid, mbf.toString(), ebf.toString(), BitField.or( mbf, ebf ));
        if( isAll || BitField.or( mbf, ebf ) ){
            matches.push( eid );

            if( matches.length >= limit ){
                break;
            }
        }
    }
    return createEntityList( matches, mbf );
}


/**
 * 
 * @param es 
 * @param list 
 */
export function getComponents( es:EntitySet, list:EntityList ): Component[] {

    const dids = list.bf ? list.bf.toValues() : [];
    
    return list.entityIds.reduce( (list,eid) => {

        return dids.reduce( (list,did) => {
            list.push( es.components.get( toComponentId(eid,did) ) );
            return list;
        }, list);

    }, []);
}


function clearChanges( entitySet:EntitySet ): EntitySet {
    return {
        ...entitySet,
        comChanges: createChangeSet(),
        entChanges: createChangeSet()
    };
}

function markRemoveComponents( es:EntitySet, id:number ): EntitySet {
    if( id === 0 ){
        return es;
    }

    const ebf = es.entities.get(id);
    if( ebf === undefined ){
        return es;
    }

    const dids = ebf.toValues();

    for( let ii=0;ii<dids.length;ii++ ){
        es = markComponentRemove(es, toComponentId(id, dids[ii]) );
    }

    return es;
}

function addEntities( es:EntitySet, ents:Entity[] ): EntitySet {

    return es;
}

/**
 * 
 * @param es 
 * @param components 
 */
function addComponents( es:EntitySet, components:Component[] ): EntitySet {
    // set a new (same) entity id on all orphaned components
    [es, components] = assignEntityIds(es, components)

    // Log.debug('[addComponents]', components);

    // mark incoming components as either additions or updates
    es = components.reduce( (es, com) => markComponentAdd(es, com), es );
    
    // gather the components that have been added or updated and apply
    const changedCids = getChanges( es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update )

    es = changedCids.reduce( (es,cid) => applyUpdatedComponents(es,cid), es );

    return es;
}


function applyUpdatedComponents(es:EntitySet, cid:ComponentId ): EntitySet {
    const [eid,did] = fromComponentId(cid);
    let ebf:BitField;

    [es,ebf] = getOrAddEntityBitfield( es, eid);

    // does the component already belong to this entity?
    if( ebf.get(did) === false ){
        ebf = createBitfield( ebf );
        ebf.set( did );
        const entities = new Map<number,BitField>(es.entities);
        entities.set( eid, ebf );
        return markEntityUpdate( {...es, entities}, eid );
    }

    return markEntityUpdate( es, eid );
}

/**
 * 
 * @param es 
 */
function applyRemoveChanges(es:EntitySet): EntitySet {
    // applies any removal changes that have previously been marked
    const removedComs = getChanges( es.comChanges, ChangeSetOp.Remove );

    es = removedComs.reduce( (es,cid) => applyRemoveComponent(es,cid), es );

    // Log.debug('[applyRemoveChanges]', es.entChanges );

    const removedEnts = getChanges( es.entChanges, ChangeSetOp.Remove );

    es = removedEnts.reduce( (es,eid) => applyRemoveEntity(es,eid), es );

    return es;
}


function applyRemoveComponent(es:EntitySet, cid:ComponentId):EntitySet {
    let [eid,did] = fromComponentId(cid);

    // remove the component id from the entity
    let entities = new Map<number,BitField>(es.entities);
    let ebf = createBitfield( entities.get(eid) );
    ebf.set( did, false );
    entities.set( eid, ebf );

    // remove component
    let components = new Map<ComponentId,Component>(es.components);
    components.delete(cid);

    es = {
        ...es,
        entities,
        components
    }

    // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

    if( ebf.count() === 0 ){
        return markEntityRemove( es, eid );
    }
    
    return es;
}

function applyRemoveEntity(es:EntitySet, eid:number):EntitySet {

    let entities = new Map<number, BitField>(es.entities);
    entities.delete( eid );

    return {...es, entities};
}

/**
 * 
 * @param es 
 * @param com 
 */
function markComponentAdd( es:EntitySet, com:Component ):EntitySet {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId( com );
    const existing = getComponent(es, cid);

    // Log.debug('[markComponentAdd]', cid, existing );

    if( existing !== undefined ){
        return markComponentUpdate( es, cid );
    }

    const components = new Map<ComponentId,Component>(es.components);
    components.set(cid, com);

    return { ...es, components, comChanges: addCS( es.comChanges, cid ) };
}

function markComponentUpdate( es:EntitySet, cid:ComponentId ):EntitySet {
    return { ...es, comChanges: updateCS( es.comChanges, cid ) };
}

function markComponentRemove( es:EntitySet, cid:ComponentId ):EntitySet {
    return { ...es, comChanges: removeCS( es.comChanges, cid ) };
}

function markEntityAdd( es:EntitySet, eid:number ):EntitySet {
    return { ...es, entChanges: addCS( es.entChanges, eid) };
}
function markEntityUpdate( es:EntitySet, eid:number ):EntitySet {
    return { ...es, entChanges: updateCS( es.entChanges, eid) };
}
function markEntityRemove( es:EntitySet, eid:number ):EntitySet {
    return { ...es, entChanges: removeCS( es.entChanges, eid) };
}

function markEntityComponentsRemove( es: EntitySet, eid:number ): EntitySet {
    const ebf = es.entities.get( eid );
    if( ebf === undefined ){
        return es;
    }
    
    return ebf.toValues().reduce( (es,did) => 
        markComponentRemove(es, toComponentId(eid,did)), es );
}


/**
 * 
 * @param es 
 * @param eid 
 */
function getOrAddEntityBitfield( es:EntitySet, eid:number ): [EntitySet, BitField] {
    let ebf = es.entities.get( eid );
    if( ebf === undefined ){
        // {mark_entity(es, :add, eid), Entity.ebf()}
        return [ markEntityAdd( es, eid ), createBitfield() ];
    }

    return [es, ebf];
}

/**
 * Assigns entity ids to an array of components
 * 
 * @param es 
 * @param components 
 */
function assignEntityIds( es:EntitySet, components:Component[] ): [EntitySet, Component[]] {
    let set;
    let eid;

    [es, set, eid, components] = components.reduce( ([es, set, eid, components], com) => {

        let did = getComponentDefId(com);
        // Log.debug('[assignEntityIds]', 'com', did );

        // component already has an id - add it to the list of components
        if( getComponentEntityId(com) !== 0 ){
            return [es, set, eid, [...components, com] ];
        }

        // not yet assigned an entity, or we have already seen this com type
        if( eid === 0 || set.has(did) ){
            // create a new entity - this also applies if we encounter a component
            // of a type we have seen before
            [es, eid] = createEntity(es);
            
            // Log.debug('[assignEntityIds]', 'new entity', did, set.has(did), eid );

            com = setComponentEntityId( com, eid );

            // # mark the def as having been seen, store the new entity, add the component
            // {es, MapSet.put(set, def_id), entity_id, [com | components]}
            return [ es, set.add(did), eid, [...components,com] ];
        } else {
            // Log.debug('[assignEntityIds]', 'already have', did, eid);
            // we have a new entity_id already
            com = setComponentEntityId( com, eid );
            return [ es, set, eid, [...components, com] ];
        }

        // return [es, set, eid, components];
    }, [es, new Set(), 0, []] );

    // Log.debug('[assignEntityIds]', 'coms', es );

    return [es, components];
}

export function createEntity( es:EntitySet ): [ EntitySet, number ] {
    const eid = generateId();

    const entities = new Map<number,BitField>( es.entities );
    entities.set(eid, createBitfield() );

    es = { ...es, entities };

    es = markEntityAdd( es, eid);

    return [ es, eid ];
}