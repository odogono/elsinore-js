import { createLog } from "../util/log";
import { Entity, create as createEntityInstance, EntityId } from "../entity";
import { ComponentId, Component, fromComponentId } from "../component";
import { ComponentDef, ComponentDefId, getDefId } from "../component_def";


const Log = createLog('IDB');

export const PREFIX = 'ecs';
export const STORE_META = 'meta';
export const STORE_ENTITY_SETS = 'entity_sets';
export const STORE_COMPONENT_DEFS = 'defs';
export const STORE_COMPONENTS = 'component';
export const STORE_ENTITIES = 'entity';



export type OnUpgradeHandler = (db:IDBDatabase, ev:IDBVersionChangeEvent) => any;




export async function idbRetrieveByQuery(db:IDBDatabase, query:any[] ):Promise<EntityId[]>{
    let result:EntityId[] = [];

    result = await walkFilterQuery( db, result, ...query );

    return result;
}

async function walkFilterQuery(db:IDBDatabase, eids:EntityId[], cmd?, ...args ){
    if( cmd === 'dids' ){
        let dids = args[0];
        Log.warn('[walkFilterQuery]', 'unhandled dids');
        // out.push(`SELECT eid from tbl_entity_component WHERE did IN ( ? )`);
        // params.push( dids );
        return eids;
    }
    else if( cmd === 'and' ){
        let left = await walkFilterQuery(db, eids, ...args[1] );
        // Log.debug('[and]', 'left', left);
        if( left.length === 0 ){
            return eids;
        }
        // out.push('INTERSECT');
        let right = await walkFilterQuery(db, eids, ...args[0] );
        if( right.length === 0 ){
            return eids;
        }
        // Log.debug('[and]', 'right', right);
        let l = new Set([...left])
        let r = new Set([...right])
        return Array.from(new Set([...l].filter(x => r.has(x))));
    } else if( cmd === 'or' ){
        let left = await walkFilterQuery(db, eids, ...args[0] );
        // out.push('UNION');
        let right = await walkFilterQuery(db, eids, ...args[1] );
        return Array.from(new Set([...left, ...right]));
    } else if( cmd === '==' ){
        let {def} = args[0];
        let [key,val] = args[1];
        Log.debug('[walkFilterQuery]', '==', key,val);
        if( Array.isArray(val) ){
            Log.debug('[walkFilterQuery]', 'might want to do this', val);
        }

        let coms = await idbRetrieveComponents(db, undefined, [getDefId(def)] );
        let ceids = coms.reduce( (eids,com) => {
            // Log.debug('[walkFilterQuery]', '==', key,val, com[key]);
            return com[key] === val ? [...eids, com["@e"] ] : eids
        }, [] );

        return [...eids, ...ceids];

        // let tbl = defToTbl(def);
        // out.push(`SELECT eid from ${tbl} WHERE ${key} = ?`);
        // params.push( valueToSQL(val) );
    }
}

/**
 * 
 * @param db 
 * @param did 
 */
export async function idbRetrieveEntityByDefId(db: IDBDatabase, dids: number[]): Promise<Entity[]> {

    // Log.debug('[idbRetrieveEntityIdByDefId]', dids);
    
    let store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    const index = store.index('by_did');


    let result;
    result = await idbGetAllOf(index, dids);

    result = result.map( ([did,eid]) => eid );

    // Log.debug('[idbRetrieveEntityIdByDefId]', 'result', result );

    // store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    result = await idbGetAllOf(store, result );

    // Log.debug('[idbRetrieveEntityIdByDefId]', 'result', result );

    let ents = result.reduce((result, [eid,did] ) => {
        let e = result[eid];
        if (e === undefined) {
            e = createEntityInstance(eid);
        }
        e.bitField.set(did);
        return { ...result, [eid]: e };
    }, {});

    return Object.values(ents);
}

export async function idbRetrieveEntities(db: IDBDatabase, eids: number[]): Promise<Entity[]> {

    // Log.debug('[idbRetrieveEntityIdByDefId]', dids);
    
    let store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    // const index = store.index('by_did');


    let result;
    result = await idbGetAllOf(store, eids, true);

    // result = result.map( ([did,eid]) => eid );

    // Log.debug('[idbRetrieveEntityIdByDefId]', 'result', result );

    // store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    // result = await idbGetAllOf(store, result );

    // Log.debug('[idbRetrieveEntityIdByDefId]', 'result', result );

    let ents = result.reduce((result, [eid,did] ) => {
        let e = result[eid];
        if (e === undefined) {
            e = createEntityInstance(eid);
        }
        e.bitField.set(did);
        return { ...result, [eid]: e };
    }, {});

    return Object.values(ents);
}

/**
 * Returns all of the keys
 * @param store 
 * @param keys 
 * @param returnKey 
 */
function idbGetAllOf( store: IDBObjectStore|IDBIndex, keys:number[], returnKey:boolean = true ):Promise<any[]>{
    keys.sort();
    const lo = keys[0];
    const hi = keys[keys.length-1];

    let lowerBound = [lo,0];
    let upperBound = [hi,Number.MAX_VALUE];
    const key = IDBKeyRange.bound(lowerBound,upperBound);

    return new Promise( (res,rej) => {
        let result = [];
        let ii = 0;
        let req = store.openCursor(key);
        req.onsuccess = (evt) => {
            let cursor = req.result;
            if( !cursor ){ return res(result); }
            const {key} = cursor;
            const [ka] = (key as number[]);
            while( ka > keys[ii] ){
                if( ++ii === keys.length ){
                    return res(result);
                }
            }
            if( ka === keys[ii] ){
                result.push( returnKey ? key : cursor.value );
                cursor.continue();
            } else {
                let nxt = [keys[ii],0];
                cursor.continue( nxt );
            }
        }
        req.onerror = (ev) => rej(ev);
    });
}


export async function idbRetrieveComponents(db:IDBDatabase, eids:EntityId[], dids:ComponentDefId[]): Promise<Component[]> {
    let result:Component[] = [];

    Log.debug('[idbRetrieveComponents]', eids, dids);

    let store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    const index = store.index('by_did');

    let coms;

    if( eids === undefined ){
        coms = await idbGetAllOf(index, dids, false);
    } else {
        coms = await idbGetAllOf(store, eids, false);
    }
    
    // Log.debug('[idbRetrieveComponents]', 'err', eids, coms );
    
    result = coms.map( c => {
        let {'_e':ceid, '_d':cdid, ...rest} = c;
        if( dids === undefined || dids.indexOf(cdid) !== -1 ){
            return {'@e':ceid, '@d':cdid, ...rest};
        }
    }).filter(Boolean);

    // Log.debug('[idbRetrieveComponents]', 'err', result, dids );
    
    return result;
}

export async function idbRetrieveComponent(db: IDBDatabase, cid: ComponentId): Promise<Component> {
    
    let [eid,did] = fromComponentId(cid);

    const store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    // const idx = store.index('by_cid');

    
    
    // Log.debug('[getComponent]', cid, eid, did);
    let result = await idbGetRange(store, IDBKeyRange.bound([eid,did], [eid,did]) );

    if( result.length === 0 ){
        return undefined;
    }

    let {'_e':ceid, '_d':cdid, ...rest} = result[0].value;
    let com = {'@e':ceid, '@d':cdid, ...rest};

    return com;
}

export async function idbComponentExists(db: IDBDatabase, eid: number, did: number): Promise<boolean> {
    const store = db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);

    const row = await idbGet( store, [eid,did] );

    // let stmt = db.prepare('SELECT cid FROM tbl_entity_component WHERE eid = ? AND did = ? LIMIT 1');
    // let row = stmt.get(eid, did);
    return row !== undefined;
}


export function idbOpen( name:string, version:number, onUpgrade?:OnUpgradeHandler ): Promise<IDBDatabase> {
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



export function idbDeleteDB(name) {
    return new Promise((resolve, reject) => {
        // Log.debug('[deleteIDB]', 'deleting', name);
        const request = indexedDB.deleteDatabase(name);

        request.onerror = err => {
            Log.error('[deleteIDB]', 'Error deleting database.', err);
            return resolve(true);
        };

        request.onblocked = e => Log.error('[deleteIDB]', 'request blocked', e);

        request.onsuccess = event => {
            // Log.info('[deleteIDB]', 'ok', name);
            return resolve(true);
        };
    });
}



/**
 * Returns the key of the last record added
 * @param store 
 */
export function idbLastKey( store:IDBObjectStore ): Promise<any> {
    return new Promise( (res,rej) => {
        let req = store.openCursor(null, 'prev');
        req.onsuccess = (evt) => res( req.result ? req.result.key : undefined );
        req.onerror = (ev) => rej(ev);
    })
}

// export function idbGetRangeKeys( store:IDBObjectStore, key:any ): Promise<any[]> {
//     return new Promise( (res,rej) => {
//         let req = store.openCursor(key);
//         let result = [];
//         req.onsuccess = (evt) => {
//             let cursor = req.result;
//             if( cursor ){
//                 result.push( cursor.key );
//                 cursor.continue();
//             } else {
//                 return res( result );
//             }
//         }
//         req.onerror = (ev) => rej(ev);
//     });
// }

// export function idbGetRangeValues( store:IDBObjectStore, key:any ): Promise<any[]> {
//     return new Promise( (res,rej) => {
//         let req = store.openCursor(key);
//         let result = [];
//         req.onsuccess = (evt) => {
//             let cursor = req.result;
//             if( cursor ){
//                 result.push( cursor.value );
//                 cursor.continue();
//             } else {
//                 return res( result );
//             }
//         }
//         req.onerror = (ev) => rej(ev);
//     });
// }

interface RangeResult { key:IDBValidKey; value:any };
export function idbGetRange( store:IDBObjectStore|IDBIndex, key:any ): Promise<RangeResult[]> {
    return new Promise( (res,rej) => {
        let req = store.openCursor(key);
        let result = [];
        req.onsuccess = (evt) => {
            let cursor = req.result;
            if( cursor ){
                const {key,value} = cursor;
                result.push( {key,value} );
                cursor.continue();
            } else {
                return res( result );
            }
        }
        req.onerror = (ev) => rej(ev);
    });
}

/**
 * Puts a record on the store
 * @param store 
 * @param record 
 */
export async function idbPut( store:IDBObjectStore, record, key?:any ): Promise<Event> {
    return new Promise( (res,rej) => {
        const req = store.put( record, key );
        req.onsuccess = (ev:Event) => res(ev);
        req.onerror = () => { rej(req.error) };
    })
}

export function idbGet( idx:(IDBIndex|IDBObjectStore), key:any ):Promise<any>{
    return new Promise( (res,rej) => {
        const req = idx.get(key);
        req.onsuccess = (evt) => res(req.result);
        req.onerror = (evt) => rej(evt);
    })
}

export function idbGetAll( idx:(IDBIndex|IDBObjectStore), key:any ):Promise<any[]>{
    return new Promise( (res,rej) => {
        const req = idx.getAll( key );
        req.onsuccess = (evt) => res(req.result);
        req.onerror = (evt) => rej(evt);
    })
}

export function idbGetAllKeys( idx:(IDBIndex|IDBObjectStore) ):Promise<any[]>{
    return new Promise( (res,rej) => {
        const req = idx.getAllKeys();
        req.onsuccess = (evt) => res(req.result);
        req.onerror = (evt) => rej(evt);
    })
}

/**
 * Deletes a record from the store
 * @param store 
 * @param key 
 */
export function idbDelete( store:IDBObjectStore, key:any ):Promise<boolean> {
    return new Promise( (res,rej) => {
        if( key === undefined ){
            return rej('invalid key');
        }
        const req = store.delete(key);
        req.onsuccess = () => res(true);
        req.onerror = (evt) => rej(evt);
    })
}

export function idbCount( idx:(IDBObjectStore) ):Promise<number>{
    return new Promise( (res,rej) => {
        const req = idx.count();
        req.onsuccess = (evt) => res(req.result);
        req.onerror = (evt) => rej(evt);
    })
}