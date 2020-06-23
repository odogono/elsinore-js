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
    isEntity,
    Entity,
    getEntityId,
    EntityId,
    EntityList,
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
import { select } from "./query";
import { EntitySet, EntitySetMem, ESOptions, AddType, AddOptions, RemoveType, EntitySetOptions } from "../entity_set";
import { StackValue } from "../query/types";
import { QueryStack } from "../query";

const Log = createLog('EntitySetIDB');


export interface ComponentDefIDB extends ComponentDef {
    tblName?: string;
    hash?: number;
}


/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export class EntitySetIDB extends EntitySetMem {

    // keep a reference to the open es db
    db?: IDBDatabase;

    // cached component defs
    componentDefs: ComponentDefIDB[];

    type: string = 'idb';
    isAsync: boolean = true;


    constructor(data?:EntitySetIDB){
        super(data as any);
        if (data !== undefined) {
            Object.assign(this, data);
        }
    }

    clone(){
        const {byUri,byHash,entChanges,comChanges} = this;
        let componentDefs = this.componentDefs.map(d => ({...d}) );
        
        let props = {
            ...this,
            componentDefs,
            uuid: createUUID(),
            byUri: new Map<string,number>(byUri),
            byHash: new Map<number,number>(byHash),
            entChanges: createChangeSet(entChanges),
            comChanges: createChangeSet(comChanges),
        }

        return new EntitySetIDB(props as any);
    }

    size(): Promise<number> {
        this.openEntitySet();
        const store = this.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);
        return idbCount(store);
    }

    select(stack:QueryStack, query: StackValue[]): Promise<StackValue[]> {
        stack.es = this as unknown as EntitySet;
        return select(stack, query);
    }


    async applyUpdates(){
        // console.timeEnd('[ESIDB][add]');
        
        // Log.debug('[add]', 'ent', getChanges(es.entChanges) );
        // Log.debug('[add]', 'com', getChanges(es.comChanges) );
        // Log.debug('[add]', es.entUpdates );
        // Log.debug('[add]', 'com', getChanges(es.comChanges,ChangeSetOp.All) );
        // Log.debug('[add]', es.comUpdates );
    
        // console.time('[ESIDB][add][bulk]');
        if( this.entUpdates.size > 0 ){
            // Log.debug('[add][entUpdates]', Array.from( es.entUpdates.values() ).map( bf => bfToValues(bf) ) );
            await idbPutEntities( this.db, this.entUpdates );
            // console.timeEnd('[ESIDB][add][bulkEnt]');
            // Log.debug('[add]', 'bulk result', result );
            this.entUpdates.clear();
        }
        if( this.comUpdates.size > 0 ){
            // console.time('[ESIDB][add][bulkCom]');
            await idbPutComponents( this.db, this.comUpdates );
            // console.timeEnd('[ESIDB][add][bulkCom]');
            // Log.debug('[add]', 'bulk result', result );
            this.comUpdates.clear();
        }
    
        // console.timeEnd('[ESIDB][add][bulk]');
    
        // es.entUpdates.clear();
        // es.comUpdates.clear();
    }

    async getEntity(eid:EntityId, populate:boolean = true): Promise<Entity> {
        this.openEntitySet();
        let e = await this._getEntity(eid);
        if( e === undefined ){
            return undefined;
        }
    
        if( !populate ){
            return e;
        }
    
        const store = this.db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    
        let result = await idbGetRange(store, IDBKeyRange.bound([eid,0], [eid,Number.MAX_SAFE_INTEGER] ) );
    
        for( const row of result ){
            let {'_e':ceid, '_d':cdid, ...rest} = row.value;
            let com = {'@e':ceid, '@d':cdid, ...rest};
            
            e.addComponentUnsafe(cdid,com);
        }
    
        return e;
    }

    async getEntities(): Promise<EntityList> {
        await this.openEntitySet();
        const store = this.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);
    
        let result = await idbGetAllKeys(store);
    
        return new EntityList(result);
    }


    


    removeComponents(coms:Component[], options:AddOptions = {}) {
        if( options.retain !== true ){
            this.clearChanges();
        }
    
        for( let ii=0;ii<coms.length;ii++ ){
            this.markComponentRemove( getComponentId( coms[ii] ) );
        }
    
        return this.applyRemoveChanges();
    }


    // async removeComponent(item: RemoveType, options: AddOptions = {}): Promise<EntitySetIDB> {
    //     if( options.retain !== true ){
    //         this.clearChanges();
    //     }

    //     let cid = isComponentId(item) ? 
    //         item as ComponentId 
    //         : isComponent(item) ? 
    //             getComponentId(item as Component) 
    //             : undefined;
        
    //     if (cid === undefined) {
    //         return this;
    //     }
    //     this.markComponentRemove(cid);
    
    //     // Log.debug('[removeComponent]', es );
    //     return this.applyRemoveChanges();
    // }

    async markComponentAdd(com: Component): Promise<EntitySetIDB> {
        // adds the component to the entityset if it is unknown,
        // otherwise marks as an update
        const cid = getComponentId(com);
        // Log.debug('[markComponentAdd]', cid, com );
        let existing;
        
        // try for already updated
        existing = this.comUpdates.get(cid);
        
        if( existing === undefined ){
            // hit the store
            existing = await this.getComponent(cid);
        }
        
        
        // convert the keys
        let {'@e':eid, '@d':did} = com;
        
        let def = this.getByDefId(did);
        let props = def.properties.map(p => p.persist === true ? p.name : undefined).filter(Boolean);
        let scom:any = {'_e':eid, '_d':did};
        
        for( let ii=0, len=props.length;ii<len;ii++ ){
            let name = props[ii];
            scom[ name ] = com[name];
        }

        // console.log('[markComponentAdd]', 'props', props);


    
        // just overwrite the component
        this.comUpdates.set( cid, scom );
    
        if (existing !== undefined) {
            return this.markComponentUpdate(cid);
        }
    
        this.comChanges = addCS(this.comChanges, cid);
        return this;
    }
    
    async markRemoveComponents(eid: number): Promise<EntitySetIDB> {
        if (eid === 0) {
            return this;
        }
    
        let e = await this._getEntity(eid);
        if( e === undefined ){
            return this;
        }
        const {bitField} = e;
    
        if (bfCount(bitField) === 0) {
            return this;
        }
    
        // Log.debug('[markRemoveComponents]', eid, bitField.toValues() );
    
        for( const did of bfToValues(bitField) ){
            this.markComponentRemove(toComponentId(eid, did ));
        }
    
        return this;
    }

    // async applyUpdatedComponents(cid: ComponentId, options:ESOptions = {}): Promise<EntitySetIDB> {
    //     const [eid, did] = fromComponentId(cid);
    //     let ebf: BitField;
    
    //     ebf = await this.getOrAddEntityBitfield(eid);
    
    //     const isNew = findCS( this.entChanges, eid ) === ChangeSetOp.Add;
    
    //     // Log.debug('[applyUpdatedComponents]', eid, did, isNew );
    //     // if(options.debug) Log.debug('[applyUpdatedComponents]', eid, did, isNew );
    
    //     // if(options.debug) console.time(`[applyUpdatedComponents] ${cid}`);
    //     // does the component already belong to this entity?
    //     if (bfGet(ebf,did) === false) {
    //         let e = createEntityInstance(eid);
    //         e.bitField = bfSet(ebf,did);
    //         // Log.debug('[applyUpdatedComponents]', eid, cid, did, bfToValues(ebf) );
            
    //         e = this.setEntity(e);
            
    //     }
    
    //     if( isNew ){
    //         this.markEntityUpdate(eid);
    //     }

    //     return this;
    // }
    
    
    async applyRemoveComponent(cid: ComponentId): Promise<EntitySetIDB> {
        let [eid, did] = fromComponentId(cid);
    
        let e = await this._getEntity(eid);
        if( e === undefined ){
            throw new Error(`entity ${eid} not found`);
        }
    
        // remove the component id from the entity
        e.bitField = bfSet(e.bitField,did, false);
    
        // remove component
    
        const store = this.db.transaction(STORE_COMPONENTS, 'readwrite').objectStore(STORE_COMPONENTS);
        await idbDelete(store, [eid,did] );
    
        // Log.debug('[applyRemoveComponent]', cid, ebf.count() );
    
        if (bfCount(e.bitField) === 0) {
            return this.markEntityRemove(eid);
        } else {
            e = this.setEntity(e);
        }
    
        return this;
    }
    
    /**
     * Removes an entity from the store
     * @param es 
     * @param eid 
     */
    async applyRemoveEntity(eid: number): Promise<EntitySetIDB> {
        const store = this.db.transaction(STORE_ENTITIES, 'readwrite').objectStore(STORE_ENTITIES);
        await idbDelete(store, eid );
        return this;
    }
    
    
    
    /**
     * 
     * @param es 
     * @param eid 
     */
    async getOrAddEntityBitfield(eid: number): Promise<BitField> {
        let record;
        // check cache first
        
        record = this.entUpdates.get(eid);
        
        if( record === undefined ){
            record = await idbRetrieveEntityBitField( this.db, eid );
            if( record === undefined ){
                this.markEntityAdd(eid);
                return createBitField();
            }
        }
    
        let ebf = createBitField( record );
    
        return ebf;
    }
    
    
    
    
    /**
     * Returns a Component by its id
     * @param es 
     * @param id 
     */
    async getComponent(id: ComponentId | Component): Promise<Component> {
        let cid:ComponentId = isComponentId(id) ? id as ComponentId : getComponentId(id as Component);
        return idbRetrieveComponent(this.db, cid);
    }
    

    async markEntityComponentsRemove(eid: number): Promise<EntitySetIDB> {

        const cids = await idbRetrieveEntityComponentIds(this.db, eid);
    
        for( const cid of cids ){
            this.markComponentRemove(cid);
        }
    
        return this;
    }

    async applyRemoveChanges() {
        // applies any removal changes that have previously been marked
        const removedComs = getChanges(this.comChanges, ChangeSetOp.Remove);
        
        // delete components - this will return a list of eids also deleted
        const deletedEids = await idbDeleteComponents( this.db, removedComs );
        
        // Log.debug('[applyRemoveChanges]', removedComs, deletedEids );
    
        for( let ii=0;ii<deletedEids.length;ii++ ){
            this.markEntityRemove( deletedEids[ii] );
        }
    
        return this;
    }


    async register( value:ComponentDef|ComponentDefObj|any ): Promise<ComponentDef> {
        await this.openEntitySet();
    
        // get the latest id
        const tx = this.db.transaction(STORE_COMPONENT_DEFS, 'readwrite');
        const store = tx.objectStore(STORE_COMPONENT_DEFS);
    
        let did = await idbLastKey( store );
        did = did === undefined ? 1 : did + 1;
        
        let def = createComponentDef( did, value );
        // Log.debug('[register]', did, def );
        let record = defToObject( def );
        let hash = hashDef( def );
    
        await idbPut( store, {...record, '_hash':hash} );
    
        this.componentDefs[did-1] = def;
        this.byUri.set( def.uri, did );
        this.byHash.set( hash, did );
    
    
        return def;
    }


    async openEntitySet(options:EntitySetOptions = {} ): Promise<EntitySetIDB>{
        if( this.db !== undefined ){
            return Promise.resolve(this);
        }
        // Log.debug('[openEntitySet]');

        const readDefs = options.readDefs === undefined ? true : options.readDefs;
    
        return openMeta().then( (db:IDBDatabase) => {
            
            const tx = db.transaction(STORE_ENTITY_SETS, 'readwrite');
            const store = tx.objectStore(STORE_ENTITY_SETS);
            
            // ensure a record of the es exists
            const request = store.put( {uuid:this.uuid} )
            let dbName = esStoreName(this);
            
            // Log.debug('[openEntitySet]', dbName);
            return new Promise( (res,rej) => {
                request.onsuccess = () => {
                    return idbOpen( dbName, 1, onEntitySetUpgrade ).then( db => {
                        this.db = db;
                        return res(this);
                    })
                }
                request.onerror = () => rej(request.error);
            })
        }).then( (es:EntitySetIDB) => {
            // read existing component defs into local cache
            if( readDefs === true ){
                return this.getComponentDefs().then( () => es );
            }
            return this;
        });
    }

    async getComponentDefs(): Promise<ComponentDef[]> {
        await this.openEntitySet({readDefs:false});
    
        const tx = this.db.transaction(STORE_COMPONENT_DEFS, 'readonly');
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
                    this.componentDefs[ did-1 ] = def;
                    this.byHash.set( hash, did );
                    this.byUri.set( def.uri, did );
                    result.push( def );
                    cursor.continue();
                } else {
                    res( result );
                }
            }
            all.onerror = (evt) => rej( evt );
        });
    }


    async _getEntity(eid:EntityId): Promise<Entity|undefined> {
        let store = this.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);
    
        return idbGet(store, eid).then( data => {
            if( data === undefined ){
                return undefined;
            }
            
            let e = this.createEntity(eid);
            e.bitField = bfSet( e.bitField, data );
            return e;
        })
    }
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
        // Log.debug('[deleteEntitySet]', 'es', es.uuid, 'does not exist');
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