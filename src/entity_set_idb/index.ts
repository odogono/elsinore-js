import { CreateEntitySetParams, EntitySet } from "../entity_set";
import { createUUID } from "../util/uuid";
import { ChangeSet,
    create as createChangeSet,
    add as addCS, update as updateCS, remove as removeCS, ChangeSetOp, getChanges 
} from "../entity_set/change_set";
import { ComponentId } from "../component";
import { ComponentDef, ComponentDefObj, create as createComponentDef, toObject as defToObject } from '../component_def';
import { createLog } from "../util/log";

const Log = createLog('EntitySetIDB');

const PREFIX = 'ecs';
const STORE_ENTITY_SETS = 'entity_sets';
const STORE_COMPONENT_DEFS = 'defs';
const STORE_COMPONENTS = 'component';

/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export interface EntitySetIDB extends EntitySet {
    isComponentRegistry: boolean;

    // keep a reference to the open es db
    db: IDBDatabase;
    // a map of {entity_id, def_id} to Component.t
    // components: Map<ComponentId, Component>;
    
    // a map of entityId to Bitfield
    // entities: Map<number, BitField>;

    entChanges: ChangeSet<number>;
    
    comChanges: ChangeSet<ComponentId>;
}


export function create({registry}:CreateEntitySetParams):EntitySetIDB {
    const uuid = createUUID();
    
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    return {
        isComponentRegistry: true,
        isEntitySet:true,
        db: undefined,
        uuid, entChanges, comChanges
    }
}


export async function register( es: EntitySetIDB, value:ComponentDef|ComponentDefObj|any ): Promise<[EntitySetIDB, ComponentDef]> {

    es = await openEntitySet(es);

    // get the latest id
    const tx = es.db.transaction(STORE_COMPONENT_DEFS, 'readwrite');
    const store = tx.objectStore(STORE_COMPONENT_DEFS);

    let did = await getLastKey( store );
    did = did === undefined ? 1 : did + 1;
    
    let def = createComponentDef( did, value );
    let record = defToObject( def );

    const evt = await put( store, {...record} );

    let all = store.openCursor();
    all.onsuccess = (evt) => {
        let cursor = (evt.target as any).result;
        if (cursor) {
            let key = cursor.primaryKey;
            let value = cursor.value;
            // Log.debug('[register][all]', value);
            cursor.continue();
        }
        else {
            // no more results
        }
    }

    return [es, def];
}

// export function getByHash( registry, hash:number ): ComponentDef {
//     const did = registry.byHash.get( hash );
//     return did === undefined ? undefined : registry.componentDefs[did-1];
// }

export async function getByUri( es:EntitySetIDB, uri:string ): Promise<ComponentDef|undefined> {
    es = await openEntitySet(es);

    const tx = es.db.transaction(STORE_COMPONENT_DEFS, 'readonly');
    const store = tx.objectStore(STORE_COMPONENT_DEFS);
    const idx = store.index('by_uri');
    const req = idx.get(uri);
    let evt = await new Promise( (res,rej) => {
        req.onsuccess = (evt) => res(evt);
        req.onerror = (evt) => rej(evt);
    })

    return req.result ? createComponentDef(req.result) : undefined;
}

// export function getByDefId( registry, defId:number ): ComponentDef {
//     return registry.componentDefs[defId-1];
// }

// export function getComponentDefs( registry ): ComponentDef[] {
//     return registry.componentDefs;
// }



export function createEntity(es: EntitySetIDB): Promise<[EntitySetIDB, number]> {

    return new Promise( (resolve,reject) => {

    
    let reqOpen = indexedDB.open("test");
    let edb;
    reqOpen.onupgradeneeded = () => {
        edb = reqOpen.result;

        let store = edb.createObjectStore('entities', {keyPath:'id', autoIncrement:true});
        store.put({bf:[1,2,3,4]});

        // store = db.createObjectStore("books", {keyPath: "isbn"});
        // store.createIndex("by_title", "title", {unique: true});
    
        // store.put({title: "Quarry Memories", author: "Fred", isbn: 123456});
        // store.put({title: "Water Buffaloes", author: "Fred", isbn: 234567});
        // store.put({title: "Bedrock Nights", author: "Barney", isbn: 345678});
    }

    reqOpen.onsuccess = (event) => {
        edb = reqOpen.result;
        // thisDb = e.target.result

        Log.debug('idb onsuccess', event );
        var store= edb.transaction('entities', 'readonly').objectStore('entities');

        var allRecords = store.getAll();
        allRecords.onsuccess = function() {
            console.log(allRecords.result);

            resolve([es,0]);
        };
    }

    });
    // Log.debug('idb open', request);
    // const eid = generateId();

    // const entities = new Map<number, BitField>(es.entities);
    // entities.set(eid, createBitfield());

    // es = { ...es, entities };

    // es = markEntityAdd(es, eid);

    // return [es, 0];
}


function openEntitySet( es:EntitySetIDB ): Promise<EntitySetIDB>{
    if( es.db !== undefined ){
        return Promise.resolve(es);
    }
    return openMeta().then( (db:IDBDatabase) => {
        const tx = db.transaction(STORE_ENTITY_SETS, 'readwrite');
        const store = tx.objectStore(STORE_ENTITY_SETS);
        
        // ensure a record of the es exists
        const request = store.put( {uuid:es.uuid} )
        let dbName = esStoreName(es);
        
        return new Promise( (res,rej) => {
            request.onsuccess = () => {
                return openIDB( dbName, 1, onEntitySetUpgrade ).then( db => {
                    res( {...es, db} );
                })
            }
            request.onerror = () => rej(request.error);
        });
    })
}

function closeEntitySet( es:EntitySet ){

}

const esStoreName = (es:EntitySet) => `${PREFIX}:es:${es.uuid}`;


/**
 * MetaDB stores details of entitysets stored within
 */
function openMeta(){
    return openIDB('meta', 1, (db:IDBDatabase, evt:IDBVersionChangeEvent) => {
        let store = db.createObjectStore(STORE_ENTITY_SETS, {keyPath:'id', autoIncrement:true})
        store.createIndex('by_uuid', 'uuid', {unique:true});
    });
}

function onEntitySetUpgrade(db:IDBDatabase, ev:IDBVersionChangeEvent) {
    let store = db.createObjectStore('entity', {keyPath:'id', autoIncrement:true});
    
    // store component data
    store = db.createObjectStore(STORE_COMPONENTS, {keyPath:'id', autoIncrement:true});
    store.createIndex('by_cid', 'cid', {unique:true}); // [eid,did]
    // store.createIndex('by_eid', '@e');
    // store.createIndex('by_did', '@d');
    store = db.createObjectStore(STORE_COMPONENT_DEFS, {autoIncrement:true});
    store.createIndex('by_uri', 'uri');
}

type OnUpgradeHandler = (db:IDBDatabase, ev:IDBVersionChangeEvent) => any;

function openIDB( name:string, version:number, onUpgrade?:OnUpgradeHandler ): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);

        if( onUpgrade ){
            request.onupgradeneeded = (evt:IDBVersionChangeEvent) => {
                const db = request.result;
                return onUpgrade(db,evt);
            };
        }

        request.onsuccess = evt => {
            const db = request.result;

            db.onversionchange = evt => {
                db.close();
            };
            return resolve(db);
        };

        request.onerror = () => reject(request.error);
        request.onblocked = () => Log.warn('[openIDB][onblocked]', 'pending till unblocked');
    });
}

export function deleteIDB(name) {
    return new Promise((resolve, reject) => {
        // Log.debug('[deleteIDB]', 'deleting', dbName);
        const request = indexedDB.deleteDatabase(name);

        request.onerror = err => {
            Log.error('[deleteIDB]', 'Error deleting database.', err);
            return resolve(true);
        };

        request.onblocked = e => Log.error('[deleteIDB]', 'request blocked', e);

        request.onsuccess = event => {
            Log.info('[deleteIDB]', 'ok', name);
            return resolve(true);
        };
    });
}


/**
 * Returns the key of the last record added
 * @param store 
 */
function getLastKey( store:IDBObjectStore ): Promise<any> {
    return new Promise( (res,rej) => {
        let req = store.openCursor(null, 'prev');
        req.onsuccess = (evt) => res( req.result ? req.result.key : undefined );
        req.onerror = (ev) => rej(ev);
    })
}

/**
 * Puts a record on the store
 * @param store 
 * @param record 
 */
async function put( store:IDBObjectStore, record ): Promise<Event> {
    return new Promise( (res,rej) => {
        const req = store.put( record );
        req.onsuccess = (ev:Event) => res(ev);
        req.onerror = () => { rej(req.error) };
    })
}