import { createLog } from "../util/log";


const Log = createLog('IDB');

export type OnUpgradeHandler = (db:IDBDatabase, ev:IDBVersionChangeEvent) => any;


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
export function idbGetRange( store:IDBObjectStore, key:any ): Promise<RangeResult[]> {
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