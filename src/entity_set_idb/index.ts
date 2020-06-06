import { 
    AddOptions,
    AddType,
    clearChanges,
    CreateEntitySetParams, 
    EntitySet,
    assignEntityIds,
    markEntityAdd,
    markComponentUpdate,
    markComponentRemove,
    markEntityUpdate,
    markEntityRemove,
    RemoveType,
    setEntity,
} from "../entity_set";
import { createUUID } from "../util/uuid";
import { ChangeSet,
    create as createChangeSet,
    add as addCS, 
    update as updateCS, 
    find as findCS,
    merge as mergeCS,
    remove as removeCS, ChangeSetOp, getChanges 
} from "../entity_set/change_set";
import { ComponentId, 
    isComponent, 
    isComponentLike,
    setEntityId as setComponentEntityId,
    create as createComponentInstance,
    isComponentId,
    getComponentId,
    Component, getComponentDefId, getComponentEntityId, fromComponentId, toComponentId, isExternalComponent } from "../component";

import { ComponentDef, 
    ComponentDefObj, 
    create as createComponentDef, 
    toObject as defToObject,
    hash as hashDef, 
    isComponentDef,
    Type as ComponentDefT} from '../component_def';
import { createLog } from "../util/log";
import { 
    Type as EntityT,
    isEntity,
    create as createEntityInstance,
    getComponents as getEntityComponents,
    Entity,
    getEntityId,
    EntityId,
    addComponentUnsafe,
    EntityList,
    createEntityList,
} from "../entity";
import { 
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    and as bfAnd,
    or as bfOr,
    toValues as bfToValues
} from "../util/bitfield";
import { idbOpen, idbDeleteDB, 
    idbDelete, idbGet, 
    idbPut, idbLastKey, 
    idbGetAllKeys, 
    idbGetRange, 
    idbCount,
    STORE_COMPONENT_DEFS,
    STORE_COMPONENTS,
    STORE_ENTITIES,
    STORE_ENTITY_SETS,
    STORE_META,
    PREFIX,
    idbRetrieveComponent,
    idbPutEntities,
    idbPutComponents,
    idbRetrieveEntityComponentIds,
    idbDeleteComponents,
    idbRetrieveEntityBitField
} from "./idb";
import { isString, isInteger } from "../util/is";
import { getByUri, getByHash, resolveComponent, getByDefId } from "../entity_set/registry";
import { select } from "./query";

const Log = createLog('EntitySetIDB');



/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export interface EntitySetIDB extends EntitySet {

    // keep a reference to the open es db
    db?: IDBDatabase;

    

    // records entity changes from the last op
    entChanges: ChangeSet<number>;
    
    // records component changes from the last op
    comChanges: ChangeSet<ComponentId>;

    // cached component defs
    componentDefs: ComponentDefIDB[];
    byUri: Map<string, number>;
    byHash: Map<number, number>;
}

export interface ComponentDefIDB extends ComponentDef {
    tblName?: string;
    hash?: number;
}

export function create(options?:CreateEntitySetParams):EntitySetIDB {
    const uuid = createUUID();
    
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();
    const entUpdates = new Map<number,BitField>();
    const comUpdates = new Map<ComponentId,any>();

    return {
        type: 'idb',
        isEntitySet:true,
        isAsync: true,
        db: undefined,
        uuid, 
        
        entChanges, comChanges,
        entUpdates, comUpdates,

        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),

        

        esAdd: add,
        esRegister: register,
        esGetComponent: getComponent,
        esGetComponentDefs: (es:EntitySetIDB) => es.componentDefs,
        esEntities: async (es:EntitySetIDB) => getEntities(es),
        esGetEntity: (es:EntitySetIDB, eid:EntityId) => getEntity(es,eid),
        esSelect: select,
        esClone: clone,
        esSize: (es) => size(es),
    }
}

async function clone(es:EntitySetIDB):Promise<EntitySetIDB>{
    return {
        ...es
    };
}

/**
 * Registers a new ComponentDef in the entityset
 * @param es 
 * @param value 
 */
export async function register( es: EntitySetIDB, value:ComponentDef|ComponentDefObj|any ): Promise<[EntitySetIDB, ComponentDef]> {

    es = await openEntitySet(es);

    // get the latest id
    // Log.debug('[register]', es );
    const tx = es.db.transaction(STORE_COMPONENT_DEFS, 'readwrite');
    const store = tx.objectStore(STORE_COMPONENT_DEFS);

    let did = await idbLastKey( store );
    did = did === undefined ? 1 : did + 1;
    
    let def = createComponentDef( did, value );
    // Log.debug('[register]', did, def );
    let record = defToObject( def );
    let hash = hashDef( def );

    await idbPut( store, {...record, '_hash':hash} );

    es.componentDefs[did-1] = def;
    es.byUri.set( def.uri, did );
    es.byHash.set( hash, did );


    return [es, def];
}

export async function getComponentDefs( es:EntitySetIDB ): Promise<ComponentDef[]> {
    es = await openEntitySet(es, {readDefs:false});

    const tx = es.db.transaction(STORE_COMPONENT_DEFS, 'readonly');
    const store = tx.objectStore(STORE_COMPONENT_DEFS);

    return new Promise( (res,rej) => {    
        let all = store.openCursor();
        let result = [];
        all.onsuccess = (evt) => {
            let cursor = (evt.target as any).result;
            if( cursor ){
                let { '_hash':h, ...data } = cursor.value;
                let def = createComponentDef( data );
                const did = def[ComponentDefT];
                const hash = hashDef(def);
                es.componentDefs[ did-1 ] = def;
                es.byHash.set( hash, did );
                es.byUri.set( def.uri, did );
                result.push( def );
                cursor.continue();
            } else {
                res( result );
            }
        }
        all.onerror = (evt) => rej( evt );
    });
}

export function createComponent( registry:EntitySetIDB, defId:(string|number|ComponentDef), attributes = {} ): Component {
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


export async function add(es: EntitySetIDB, item: AddType, options: AddOptions = {}): Promise<EntitySetIDB> {
    es = await openEntitySet(es);
    es = options.retain ? es : clearChanges(es as EntitySet) as EntitySetIDB;
    const {debug} = options;
    
    // Log.debug('[add]', item);

    // console.time('[ESIDB][add]');
    if (Array.isArray(item)) {
        let initial:[Entity[],Component[]] = [[], []];
        // sort the incoming items into entities and components
        let [ents, coms] = (item as any[]).reduce(([ents, coms], item) => {
            if (isComponentLike(item)) {
                coms.push(item);
            } else if (isEntity(item)) {
                ents.push(item);
            }
            return [ents, coms];
        }, initial);
        
        // if(debug) console.time('[add][addComponents]');
        // if(debug) Log.debug('[add][addComponents]', ents);
        for( const e of ents ){
            es = await addComponents(es, getEntityComponents(e), {debug});
        }
        // if(debug) console.timeEnd('[add][addComponents]');

        // console.time('[add][addComponents]2');
        es = await addComponents(es, coms);
        // es = await applyRemoveChanges(es)
        // console.timeEnd('[add][addComponents]2');
    }
    else if (isComponentLike(item)) {
        es = await addComponents(es, [item as Component]);
    }
    else if (isEntity(item)) {
        let e = item as Entity
        es = await markRemoveComponents(es, e[EntityT]);
        es = await addComponents(es, getEntityComponents(e));
    }

    es = await applyRemoveChanges(es);

    // console.timeEnd('[ESIDB][add]');
    
    // Log.debug('[add]', 'ent', getChanges(es.entChanges) );
    // Log.debug('[add]', 'com', getChanges(es.comChanges) );
    // Log.debug('[add]', es.entUpdates );
    // Log.debug('[add]', 'com', getChanges(es.comChanges,ChangeSetOp.All) );
    // Log.debug('[add]', es.comUpdates );

    // console.time('[ESIDB][add][bulk]');
    if( es.entUpdates.size > 0 ){
        // Log.debug('[add][entUpdates]', Array.from( es.entUpdates.values() ).map( bf => bfToValues(bf) ) );
        await idbPutEntities( es.db, es.entUpdates );
        // console.timeEnd('[ESIDB][add][bulkEnt]');
        // Log.debug('[add]', 'bulk result', result );
        es.entUpdates.clear();
    }
    if( es.comUpdates.size > 0 ){
        // console.time('[ESIDB][add][bulkCom]');
        await idbPutComponents( es.db, es.comUpdates );
        // console.timeEnd('[ESIDB][add][bulkCom]');
        // Log.debug('[add]', 'bulk result', result );
        es.comUpdates.clear();
    }

    // console.timeEnd('[ESIDB][add][bulk]');

    // es.entUpdates.clear();
    // es.comUpdates.clear();

    return es;
}

export async function removeComponents(es:EntitySetIDB, coms:Component[], options:AddOptions = {}){
    es = options.retain ? es : clearChanges(es) as EntitySetIDB;

    for( let ii=0;ii<coms.length;ii++ ){
        es = markComponentRemove(es, getComponentId( coms[ii] ) ) as EntitySetIDB;
    }

    return await applyRemoveChanges(es);
}

/**
 * Removes a component. if it is the last entity on the component, the entity is also removed
 * @param es 
 * @param item 
 * @param options 
 */
export async function removeComponent(es: EntitySetIDB, item: RemoveType, options: AddOptions = {}): Promise<EntitySetIDB> {
    es = options.retain ? es : clearChanges(es) as EntitySetIDB;
    let cid = isComponentId(item) ? 
        item as ComponentId 
        : isComponent(item) ? 
            getComponentId(item as Component) 
            : undefined;
    
    if (cid === undefined) {
        return es;
    }
    es = markComponentRemove(es, cid) as EntitySetIDB;

    // Log.debug('[removeComponent]', es );
    return await applyRemoveChanges(es);
}

/**
 * Removes an entity and all its components
 * 
 * @param es 
 * @param item 
 * @param options 
 */
export async function removeEntity(es: EntitySetIDB, item: (number | Entity), options: AddOptions = {}): Promise<EntitySetIDB> {
    es = options.retain ? es : clearChanges(es) as EntitySetIDB;
    let eid = isInteger(item) ? item as number : isEntity(item) ? getEntityId(item as Entity) : 0;
    // Log.debug('[removeEntity]', eid);
    if (eid === 0) {
        return es;
    }
    es = await markEntityComponentsRemove(es, eid);
    return await applyRemoveChanges(es);
}


/**
 * Returns an entity instance with components
 * 
 * @param es 
 * @param eid 
 */
export async function getEntity(es:EntitySetIDB, eid:EntityId, populate:boolean = true): Promise<Entity> {
    es = await openEntitySet(es);
    let e = await _getEntity(es, eid);
    if( e === undefined ){
        return undefined;
    }

    if( !populate ){
        return e;
    }

    const store = es.db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);

    let result = await idbGetRange(store, IDBKeyRange.bound([eid,0], [eid,Number.MAX_SAFE_INTEGER] ) );

    for( const row of result ){
        let {'_e':ceid, '_d':cdid, ...rest} = row.value;
        let com = {'@e':ceid, '@d':cdid, ...rest};
        const def = getByDefId(es,cdid);

        e = addComponentUnsafe(e,cdid,com,def.name);
    }

    // e = result.reduce( (e,{value:cdat}) => {
    //     let {'_e':ceid, '_d':cdid, ...rest} = cdat;
    //     let com = {'@e':ceid, '@d':cdid, ...rest};
    //     const def = getByDefId(es,cdid);

    //     return addComponentUnsafe(e,cdid,com,def.name);
    // }, e);

    return e;
}

export async function getEntities(es:EntitySetIDB): Promise<EntityList> {
    es = await openEntitySet(es);
    const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);

    let result = await idbGetAllKeys(store);

    return createEntityList(result);
}

export async function size(es:EntitySetIDB): Promise<number> {
    es = await openEntitySet(es);
    const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);
    return idbCount(store);
}

interface ESOptions {
    debug?: boolean;
}

export async function addComponents(es: EntitySetIDB, components: Component[], options:ESOptions = {}): Promise<EntitySetIDB> {
    // set a new (same) entity id on all orphaned components
    [es, components] = assignEntityIds(es, components)

    // Log.debug('[addComponents]', components);
    // to keep track of changes only in this function, we must temporarily replace
    let changes = es.comChanges;
    es.comChanges = createChangeSet<ComponentId>();

    // mark incoming components as either additions or updates
    for( const com of components ){
        es = await markComponentAdd(es,com);
    }
    
    // gather the components that have been added or updated and apply
    const changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)

    // combine the new changes with the existing
    es.comChanges = mergeCS( changes, es.comChanges );

    // console.time('[addComponents][applyUpdatedComponents]');

    // Log.debug('[addComponents]', 'applying updated components', changedCids)
    
    for( const cid of changedCids ){
        es = await applyUpdatedComponents(es,cid, options);
    }

    // console.timeEnd('[addComponents][applyUpdatedComponents]');
    // return changedCids.reduce((pes, cid) => pes.then( es => applyUpdatedComponents(es, cid) ), Promise.resolve(es));
    return es;
}

async function applyUpdatedComponents(es: EntitySetIDB, cid: ComponentId, options:ESOptions = {}): Promise<EntitySetIDB> {
    const [eid, did] = fromComponentId(cid);
    let ebf: BitField;

    [es, ebf] = await getOrAddEntityBitfield(es, eid);

    const isNew = findCS( es.entChanges, eid ) === ChangeSetOp.Add;

    // Log.debug('[applyUpdatedComponents]', eid, did, isNew );
    // if(options.debug) Log.debug('[applyUpdatedComponents]', eid, did, isNew );

    // if(options.debug) console.time(`[applyUpdatedComponents] ${cid}`);
    // does the component already belong to this entity?
    if (bfGet(ebf,did) === false) {
        let e = createEntityInstance(eid);
        e.bitField = bfSet(ebf,did);
        // Log.debug('[applyUpdatedComponents]', eid, cid, did, bfToValues(ebf) );
        
        e = setEntity(es, e);
        
        return isNew ? es : markEntityUpdate(es as EntitySetIDB, eid) as EntitySetIDB;
    }

    // if(options.debug) console.timeEnd(`[applyUpdatedComponents] ${cid}`);

    // Log.debug('[applyUpdatedComponents]');

    return isNew ? es : markEntityUpdate(es, eid) as EntitySetIDB;
}


async function applyRemoveChanges(es: EntitySetIDB): Promise<EntitySetIDB> {
    // applies any removal changes that have previously been marked
    const removedComs = getChanges(es.comChanges, ChangeSetOp.Remove);
    
    // delete components - this will return a list of eids also deleted
    const deletedEids = await idbDeleteComponents( es.db, removedComs );
    
    // Log.debug('[applyRemoveChanges]', removedComs, deletedEids );

    for( let ii=0;ii<deletedEids.length;ii++ ){
        es = markEntityRemove(es, deletedEids[ii] ) as EntitySetIDB;
    }

    // const removedEnts = getChanges(es.entChanges, ChangeSetOp.Remove);

    // es = await removedEnts.reduce((pes, eid) => 
    //     pes.then( es => applyRemoveEntity(es, eid)), Promise.resolve(es));

    return es;
}

async function applyRemoveComponent(es: EntitySetIDB, cid: ComponentId): Promise<EntitySetIDB> {
    let [eid, did] = fromComponentId(cid);

    let e = await _getEntity(es, eid);
    if( e === undefined ){
        throw new Error(`entity ${eid} not found`);
    }

    // remove the component id from the entity
    e.bitField = bfSet(e.bitField,did, false);

    // remove component

    const store = es.db.transaction(STORE_COMPONENTS, 'readwrite').objectStore(STORE_COMPONENTS);
    await idbDelete(store, [eid,did] );

    // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

    if (bfCount(e.bitField) === 0) {
        return markEntityRemove(es, eid) as EntitySetIDB;
    } else {
        e = setEntity(es, e);
    }

    return es;
}

/**
 * Removes an entity from the store
 * @param es 
 * @param eid 
 */
function applyRemoveEntity(es: EntitySetIDB, eid: number): Promise<EntitySetIDB> {
    const store = es.db.transaction(STORE_ENTITIES, 'readwrite').objectStore(STORE_ENTITIES);
    return idbDelete(store, eid ).then( () => es );
}

async function markComponentAdd(es: EntitySetIDB, com: Component): Promise<EntitySetIDB> {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId(com);
    // Log.debug('[markComponentAdd]', cid, com );
    let existing;
    
    // try for already updated
    existing = es.comUpdates.get(cid);
    
    if( existing === undefined ){
        // hit the store
        existing = await getComponent(es, cid);
    }
    
    // convert the keys
    let {'@e':eid, '@d':did, ...rest} = com;
    let scom = {'_e':eid, '_d':did, ...rest};

    // just overwrite the component
    es.comUpdates.set( cid, scom );

    if (existing !== undefined) {
        return markComponentUpdate(es as EntitySet, cid) as EntitySetIDB;
    }

    
    return { ...es, comChanges: addCS(es.comChanges, cid) };
}

async function markRemoveComponents(es: EntitySetIDB, eid: number): Promise<EntitySetIDB> {
    if (eid === 0) {
        return es;
    }

    let e = await _getEntity(es, eid);
    if( e === undefined ){
        return es;
    }
    const {bitField} = e;

    if (bfCount(bitField) === 0) {
        return es;
    }

    // Log.debug('[markRemoveComponents]', eid, bitField.toValues() );

    for( const did of bfToValues(bitField) ){
        es = markComponentRemove(es, toComponentId(eid, did ));
    }

    return es;
}


async function markEntityComponentsRemove(es: EntitySetIDB, eid: number): Promise<EntitySetIDB> {

    const cids = await idbRetrieveEntityComponentIds(es.db, eid);

    for( const cid of cids ){
        es = markComponentRemove(es, cid) as EntitySetIDB
    }

    return es;
}

/**
 * 
 * @param es 
 * @param eid 
 */
async function getOrAddEntityBitfield(es: EntitySetIDB, eid: number): Promise<[EntitySetIDB, BitField]> {
    let record;
    // check cache first
    
    record = es.entUpdates.get(eid);
    
    if( record === undefined ){
        record = await idbRetrieveEntityBitField( es.db, eid );
        if( record === undefined ){
            return [markEntityAdd(es,eid) as EntitySetIDB, createBitField()];
        }
    }

    let ebf = createBitField( record );

    return [es, ebf];
}



function _getEntity(es:EntitySetIDB, eid:EntityId): Promise<Entity|undefined> {
    let store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);

    return idbGet(store, eid).then( data => {
        if( data === undefined ){
            return undefined;
        }
        
        let e = createEntityInstance(eid);
        e.bitField = bfSet( e.bitField, data );
        return e;
    })
}


/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export async function getComponent(es: EntitySetIDB, id: ComponentId | Component): Promise<Component> {
    let cid:ComponentId = isComponentId(id) ? id as ComponentId : getComponentId(id as Component);
    
    // es = await openEntitySet(es);
    
    return await idbRetrieveComponent(es.db, cid);
}


interface OpenEntitySetOptions {
    readDefs?: boolean;
}

function openEntitySet( es:EntitySetIDB, options:OpenEntitySetOptions = {} ): Promise<EntitySetIDB>{
    if( es.db !== undefined ){
        return Promise.resolve(es);
    }
    const readDefs = options.readDefs === undefined ? true : options.readDefs;

    return openMeta().then( (db:IDBDatabase) => {
        const tx = db.transaction(STORE_ENTITY_SETS, 'readwrite');
        const store = tx.objectStore(STORE_ENTITY_SETS);
        
        // ensure a record of the es exists
        const request = store.put( {uuid:es.uuid} )
        let dbName = esStoreName(es);
        
        return new Promise( (res,rej) => {
            request.onsuccess = () => {
                return idbOpen( dbName, 1, onEntitySetUpgrade ).then( db => {


                    es = {...es, db};
                    return res(es);
                    // Log.debug('[openEntitySet]', 'okkk', es, readDefs );
                    // return readDefs === true ?
                    //     getComponentDefs(es).then( es => res(es) )
                    //     : res(es);
                    // res( es );
                })
            }
            request.onerror = () => rej(request.error);
        })
    }).then( (es:EntitySetIDB) => {
        // read existing component defs into local cache
        if( readDefs === true ){
            return getComponentDefs(es).then( () => es );
        }
        return es;
    });
}

function closeEntitySet( es:EntitySet ){

}


export async function deleteEntitySet( es:EntitySet ){
    const db = await openMeta();
    let store = db.transaction(STORE_ENTITY_SETS, 'readonly').objectStore(STORE_ENTITY_SETS);
    
    // check the entitySet exists
    // const idx = store.index('by_uuid');
    const record = await idbGet(store, es.uuid);

    if( record === undefined ){
        Log.debug('[deleteEntitySet]', 'es', es.uuid, 'does not exist');
        return false;
    }

    await idbDeleteDB( esStoreName(es) )

    
    store = db.transaction(STORE_ENTITY_SETS, 'readwrite').objectStore(STORE_ENTITY_SETS);
    await idbDelete( store, record.uuid );

    return true;
}



const esStoreName = (es:EntitySet) => `${PREFIX}:es:${es.uuid}`;
const esMetaName = () => `${PREFIX}:${STORE_META}`;

/**
 * MetaDB stores details of entitysets stored within
 */
function openMeta(){
    return idbOpen( esMetaName(), 1, (db:IDBDatabase, evt:IDBVersionChangeEvent) => {
        let store = db.createObjectStore(STORE_ENTITY_SETS, {keyPath:'uuid'})
        // store.createIndex('by_uuid', 'uuid', {unique:true});
    });
}

function onEntitySetUpgrade(db:IDBDatabase, ev:IDBVersionChangeEvent) {
    let store = db.createObjectStore(STORE_ENTITIES, {autoIncrement:true});
    
    // store component data
    store = db.createObjectStore(STORE_COMPONENTS, {keyPath:['_e', '_d']});
    store.createIndex('by_did', ['_d', '_e'], {unique:true});
    
    store = db.createObjectStore(STORE_COMPONENT_DEFS, {autoIncrement:true});
    store.createIndex('by_uri', 'uri', {unique:false});
    store.createIndex('by_hash', '_hash', {unique:true});

}




export function clearIDB() {
    // get a list of all the entityset uuids
    return getEntitySetIDs()
        .then(uuids => {
            // Log.debug('[deleteIDB]', 'existing entitysets', uuids);
            return Promise.all(uuids.map(uuid => deleteEntitySet( {uuid} as EntitySet) ));
        })
        .then(() => idbDeleteDB(STORE_META));
}

function getEntitySetIDs():Promise<string[]> {
    return openMeta().then(conn => {
        return new Promise((resolve, reject) => {
            const store = conn.transaction(STORE_ENTITY_SETS, 'readonly').objectStore(STORE_ENTITY_SETS);
            let req = store.openCursor();
            let result = [];

            req.onsuccess = evt => {
                let cursor = req.result;
                if (cursor) {
                    result.push(cursor.value.uuid);
                    cursor.continue();
                    return;
                }
                resolve(result);
            };
        });
    });
}