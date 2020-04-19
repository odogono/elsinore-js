import { ComponentId, Component,
    create as createComponentInstance,
    setEntityId as setComponentEntityId,
    getComponentId,
    isComponentId,
    fromComponentId,
    getComponentDefId,
    getComponentEntityId,
    isComponent,
    toComponentId
} from "../component";
import { ComponentDef, 
    ComponentDefObj, 
    create as createComponentDef, 
    toObject as defToObject,
    hash as hashDef, 
    isComponentDef,
    Type as ComponentDefT} from '../component_def';
import { getByUri, getByHash, getByDefId } from "../component_registry";
import { EntitySet, CreateEntitySetParams, markEntityAdd, markComponentUpdate, markEntityUpdate, AddType, AddOptions, clearChanges, markEntityRemove, markComponentRemove } from "../entity_set";
import { 
    Type as EntityT,
    isEntity,
    create as createEntityInstance,
    getComponents as getEntityComponents,
    createBitfield,
    Entity,
    getEntityId,
    setEntityId,
    EntityId,
    addComponentUnsafe,
} from "../entity";
import { ChangeSet,
    create as createChangeSet,
    add as addCS, 
    update as updateCS, 
    find as findCS,
    remove as removeCS, ChangeSetOp, getChanges 
} from "../entity_set/change_set";
import { BitField } from "odgn-bitfield";
import { createUUID } from "../util/uuid";
import { SqlRef, sqlOpen, sqlIsOpen, sqlInsertDef, sqlRetrieveDefByUri, sqlRetrieveDefByHash, sqlRetrieveDefs, getLastEntityId, sqlUpdateEntity, sqlRetrieveEntity, sqlRetrieveComponent, sqlUpdateComponent, sqlCount, sqlDeleteComponent, sqlDeleteEntity, sqlRetrieveEntityComponents, sqlComponentExists } from "./sqlite";
import { createLog } from "../util/log";
import { isString, isInteger } from "../util/is";
export { getByHash, getByUri } from '../component_registry';

const Log = createLog('EntitySetSQL');

/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export interface EntitySetSQL extends EntitySet {
    isComponentRegistry: boolean;

    // keep a reference to the open es db
    db?: SqlRef;

    isMemory: boolean;

    debug: boolean;

    // records entity changes from the last op
    entChanges: ChangeSet<number>;
    
    // records component changes from the last op
    comChanges: ChangeSet<ComponentId>;

    // cached component defs
    componentDefs: ComponentDefSQL[];
    byUri: Map<string, number>;
    byHash: Map<number, number>;
}

export interface ComponentDefSQL extends ComponentDef {
    tblName?: string;
    hash?: number;
}

export interface CreateEntitySetSQLParams extends CreateEntitySetParams {
    // name: string;
    isMemory?: boolean;
    clearDb?: boolean;
    debug?: boolean;
}

export function create(options?:CreateEntitySetSQLParams):EntitySetSQL {
    const uuid = options.uuid || createUUID();
    const isMemory = options.isMemory ?? true;
    const debug = options.debug ?? false;
    
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    return {
        isComponentRegistry: true,
        isEntitySet:true,
        db: undefined,
        isMemory,
        debug,
        uuid, entChanges, comChanges,
        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),
    }
}


/**
 * Registers a new ComponentDef in the entityset
 * @param es 
 * @param value 
 */
export function register( es: EntitySetSQL, value:ComponentDef|ComponentDefObj|any ): [EntitySetSQL, ComponentDef] {

    es = openEntitySet(es);

    
    let def = createComponentDef( 0, value );

    // insert the def into the def tbl
    def = sqlInsertDef( es.db, def );

    // // get the latest id
    // Log.debug('[register]', es );
    // const tx = es.db.transaction(STORE_COMPONENT_DEFS, 'readwrite');
    // const store = tx.objectStore(STORE_COMPONENT_DEFS);

    // let did = await idbLastKey( store );
    // did = did === undefined ? 1 : did + 1;
    
    // const def = undefined;

    
    // let record = defToObject( def );
    // Log.debug('def', def, record );
    // Log.debug('def', defToStmt(def) );
    // let hash = hashDef( def );

    // await idbPut( store, {...record, '_hash':hash} );
    // const did = def[ComponentDefT];
    // const hash = hashDef(def);
    const did = def[ComponentDefT];
    const {hash,tblName} = (def as ComponentDefSQL);

    es.componentDefs[did-1] = def;
    es.byUri.set( def.uri, did );
    es.byHash.set( hash, did );

    return [es, def];
}

export function getComponentDefs( es:EntitySetSQL ): ComponentDef[] {
    es = openEntitySet(es);
    return sqlRetrieveDefs(es.db);
}


export function size(es:EntitySetSQL): number {
    es = openEntitySet(es);
    return sqlCount(es.db);
    // const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);
    // return idbCount(store);
}

// export function getByUri( es:EntitySetSQL, uri:string ) {
//     es = openEntitySet(es);
//     let def = sqlRetrieveDefByUri(es.db, uri);
//     return def;
// }

// export function getByHash( es:EntitySetSQL, id:number ) {
//     es = openEntitySet(es);
//     let def = sqlRetrieveDefByHash(es.db, id);
//     return def;
// }

export function add(es: EntitySetSQL, item: AddType, options: AddOptions = {}): EntitySetSQL {
    es = openEntitySet(es);
    es = options.retain ? es : clearChanges(es as EntitySet) as EntitySetSQL;

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

        es = ents.reduce((pes, e) => 
            addComponents(es, getEntityComponents(e) ), 
        es);

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


export function createComponent( registry:EntitySetSQL, defId:(string|number|ComponentDef), attributes = {} ): Component {
    let def:ComponentDef = undefined;

    // Log.debug('[createComponent]', defId, attributes, registry );
    if( isString(defId) ){
        def = getByUri(registry,  defId as string );
    } else if( isInteger(defId) ){
        def = getByHash(registry, defId as number) || registry.componentDefs[(defId as number)-1];
    } else if( isComponentDef(defId) ){
        def = defId as any as ComponentDef;
    }

    if( def === undefined ){
        // Log.debug('[createComponent]', registry.byUri.get( defId as string ), registry.componentDefs );
        throw new Error(`component def not found: ${defId}`);
    }

    let params = {
        ...attributes,
        '@d': def[ComponentDefT]
    };

    // Log.debug('[createComponent]', 'def', def[DefT] );

    // create a component instance
    const component = createComponentInstance(params);

    return component;
}


export function markComponentAdd(es: EntitySetSQL, com: Component): EntitySetSQL {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId(com);
    const [eid,did] = fromComponentId(cid);
    const existing = sqlComponentExists(es.db, eid, did);// getComponent(es, cid);

    // Log.debug('[markComponentAdd]', cid, existing );

    const def = getByDefId(es, did) as ComponentDefSQL;
    
    // Log.debug('[markComponentAdd]', com );

    sqlUpdateComponent( es.db, com, def );

    if (existing) {
        return markComponentUpdate(es as EntitySet, cid) as EntitySetSQL;
    }

    return { ...es, comChanges: addCS(es.comChanges, cid) };
}

function markRemoveComponents(es: EntitySetSQL, eid: number): EntitySetSQL {
    if (eid === 0) {
        return es;
    }

    const {db} = es;

    let e = _getEntity(es, eid);
    if( e === undefined ){
        return es;
    }

    // const ebf = es.entities.get(id);
    if (e.bitField.count() === 0) {
        return es;
    }

    const dids = e.bitField.toValues();

    for (let ii = 0; ii < dids.length; ii++) {
        es = markComponentRemove(es, toComponentId(eid, dids[ii])) as EntitySetSQL;
    }

    return es;
}

export function addComponents(es: EntitySetSQL, components: Component[]): EntitySetSQL {
    // set a new (same) entity id on all orphaned components
    [es, components] = assignEntityIds(es, components)

    // Log.debug('[addComponents]', components);

    // mark incoming components as either additions or updates
    es = components.reduce( (es, com) => {
        return markComponentAdd(es, com);
    }, es);

    // gather the components that have been added or updated and apply
    const changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)

    return changedCids.reduce((es, cid) => applyUpdatedComponents(es, cid), es);
}


function applyRemoveChanges(es: EntitySetSQL): EntitySetSQL {
    // applies any removal changes that have previously been marked
    const removedComs = getChanges(es.comChanges, ChangeSetOp.Remove);

    es = removedComs.reduce((es, cid) => applyRemoveComponent(es, cid), es);

    // Log.debug('[applyRemoveChanges]', es.entChanges );

    const removedEnts = getChanges(es.entChanges, ChangeSetOp.Remove);

    es = removedEnts.reduce((es, eid) => applyRemoveEntity(es, eid), es);

    return es;
}

function applyRemoveComponent(es: EntitySetSQL, cid: ComponentId): EntitySetSQL {
    let [eid, did] = fromComponentId(cid);

    // let e = _getEntity(es, eid);
    // if( e === undefined ){
    //     throw new Error(`entity ${eid} not found`);
    // }

    // // remove the component id from the entity
    // e.bitField.set(did, false);

    const def = getByDefId( es, did );
    // remove component
    let e = sqlDeleteComponent( es.db, eid, def );

    // const store = es.db.transaction(STORE_COMPONENTS, 'readwrite').objectStore(STORE_COMPONENTS);
    // await idbDelete(store, [eid,did] );

    // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

    if (e.bitField.count() === 0) {
        return markEntityRemove(es, eid) as EntitySetSQL;
    } else {
        // e = setEntity(es, e);
    }

    return es;
}

/**
 * Removes an entity from the store
 * @param es 
 * @param eid 
 */
function applyRemoveEntity(es: EntitySetSQL, eid: number): EntitySetSQL {
    sqlDeleteEntity( es.db, eid );
    return es;
}


function applyUpdatedComponents(es: EntitySetSQL, cid: ComponentId): EntitySetSQL {
    const [eid, did] = fromComponentId(cid);
    let ebf: BitField;

    [es, ebf] = getOrAddEntityBitfield(es, eid);

    const isNew = findCS( es.entChanges, eid ) === ChangeSetOp.Add;

    // Log.debug('[applyUpdatedComponents]', eid, isNew, es.entChanges );

    // does the component already belong to this entity?
    if (ebf.get(did) === false) {
        let e = createEntityInstance(eid);
        e.bitField = ebf;
        e.bitField.set(did);
        
        e = setEntity(es, e);

        return isNew ? es : markEntityUpdate(es as EntitySetSQL, eid) as EntitySetSQL;
    }

    return isNew ? es : markEntityUpdate(es, eid) as EntitySetSQL;
}

/**
 * 
 * @param es 
 * @param eid 
 */
function getOrAddEntityBitfield(es: EntitySetSQL, eid: number): [EntitySetSQL, BitField] {
    // const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);

    let e = sqlRetrieveEntity(es.db, eid);
    // let record = await idbGet(store, eid);
    if( e === undefined ){
        return [markEntityAdd(es,eid) as EntitySetSQL, createBitfield()];
    }

    // let ebf = createBitfield( record.bf );

    return [es, e.bitField];
}


/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export function getComponent(es: EntitySetSQL, id: ComponentId | Component): Component {
    let cid:ComponentId = isComponentId(id) ? id as ComponentId : getComponentId(id as Component);
    
    es = openEntitySet(es);

    let [eid,did] = fromComponentId(cid);
    const def = getByDefId(es, did);
    let com = sqlRetrieveComponent( es.db, eid, def );

    // const store = es.db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    // const idx = store.index('by_cid');

    
    // let result = await idbGetRange(store, IDBKeyRange.bound([eid,did], [eid,did]) );
    // Log.debug('[getComponent]', eid, did, result);

    // if( result.length === 0 ){
    //     return undefined;
    // }

    // let {'_e':ceid, '_d':cdid, ...rest} = result[0].value;
    // let com = {'@e':ceid, '@d':cdid, ...rest};

    return com;
}


/**
 * Assigns entity ids to an array of components
 * 
 * @param es 
 * @param components 
 */
function assignEntityIds(es: EntitySetSQL, components: Component[]): [EntitySetSQL, Component[]] {
    let set;
    let eid;
    type Memo = [ EntitySetSQL,Set<number>,number,Component[] ];
    const initial:Memo = [es, new Set(), 0, []];

    [es, set, eid, components] = components.reduce( (last, com) => {

        let [es, set, eid, components] = last;

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
    }, initial) as Memo;

    // Log.debug('[assignEntityIds]', 'coms', components );

    return [es, components];
}


function setEntity(es:EntitySetSQL, e:Entity): Entity {    
    return sqlUpdateEntity(es.db, e);
}

function _getEntity(es:EntitySetSQL, eid:EntityId): Entity {
    return sqlRetrieveEntity(es.db, eid);
}

export function createEntity(es: EntitySetSQL): [EntitySetSQL, number] {
    es = openEntitySet(es);

    let e = createEntityInstance();

    e = setEntity( es, e );
    const eid = getEntityId(e);
    // Log.debug('[createEntity]', es);

    es = markEntityAdd(es, eid ) as EntitySetSQL;

    return [es, eid];
}

/**
 * Returns an entity instance with components
 * 
 * @param es 
 * @param eid 
 */
export function getEntity(es:EntitySetSQL, eid:EntityId): Entity {
    es = openEntitySet(es);
    let e = _getEntity(es, eid);
    if( e === undefined ){
        return undefined;
    }

    let dids = e.bitField.toValues()
    let defs = dids.map( did => getByDefId(es,did) );

    let coms = sqlRetrieveEntityComponents( es.db, eid, defs );

    // const store = es.db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);

    // let result = await idbGetRange(store, IDBKeyRange.bound([eid,0], [eid,Number.MAX_SAFE_INTEGER] ) );

    e = coms.reduce( (e,com) => {
        const did = getComponentDefId(com);
        return addComponentUnsafe(e,did,com);
    }, e);

    return e;
}



interface OpenEntitySetOptions {
    readDefs?: boolean;
    isMemory?: boolean;
    clearDb?: boolean;
}

function openEntitySet( es:EntitySetSQL, options:OpenEntitySetOptions = {} ): EntitySetSQL{
    if( sqlIsOpen(es.db) ){
        return es;
    }
    const readDefs = options.readDefs ?? true;
    const {isMemory} = es;
    const verbose = es.debug ? console.log : undefined;
    
    es.db = sqlOpen(es.uuid, {...options, isMemory, verbose});

    // read component defs into local cache
    
    return es;
}

function closeEntitySet( es:EntitySetSQL ){

}



