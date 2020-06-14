import {
    ComponentId, Component,
    create as createComponentInstance,
    setEntityId as setComponentEntityId,
    getComponentId,
    isComponentId,
    fromComponentId,
    getComponentDefId,
    getComponentEntityId,
    isComponent,
    toComponentId,
    isComponentLike
} from "../component";
import {
    ComponentDef,
    ComponentDefObj,
    create as createComponentDef,
    toObject as defToObject,
    hash as hashDef,
    isComponentDef,
    Type as ComponentDefT
} from '../component_def';

import {
    Type as EntityT,
    isEntity,
    Entity,
    getEntityId,
    EntityId,
    EntityList
} from "../entity";
import {
    ChangeSet,
    create as createChangeSet,
    add as addCS,
    update as updateCS,
    find as findCS,
    merge as mergeCS,
    remove as removeCS, ChangeSetOp, getChanges
} from "../entity_set/change_set";
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
import { createUUID } from "../util/uuid";
import {
    SqlRef,
    sqlOpen, sqlIsOpen,
    sqlInsertDef, sqlRetrieveDefByUri, sqlRetrieveDefByHash,
    sqlRetrieveDefs,
    getLastEntityId,
    sqlUpdateEntity,
    sqlRetrieveEntity,
    sqlRetrieveComponent,
    sqlUpdateComponent,
    sqlCount,
    sqlDeleteComponent, sqlDeleteEntity,
    sqlRetrieveEntityComponents,
    sqlComponentExists,
    sqlGetEntities
} from "./sqlite";
import { createLog } from "../util/log";
import { isString, isInteger } from "../util/is";
import { select } from "./query";
import { EntitySetMem, AddType, AddOptions, RemoveType, ESOptions, EntitySet, EntitySetOptions } from "../entity_set";
import { StackValue } from "../query/types";

const Log = createLog('EntitySetSQL');


export interface ComponentDefSQL extends ComponentDef {
    tblName?: string;
    hash?: number;
}



export interface SQLEntitySetOptions extends EntitySetOptions {
    name?: string;
    readDefs?: boolean;
    isMemory?: boolean;
    clearDb?: boolean;
}




/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export class EntitySetSQL extends EntitySetMem {

    // keep a reference to the open es db
    db?: SqlRef;

    name: string;
    isMemory: boolean;
    debug: boolean;

    type: string = 'sql';
    isAsync: boolean = true;


    constructor(options: SQLEntitySetOptions = {}) {
        super(options as any);
        this.isMemory = options.isMemory ?? true;
        this.debug = options.debug ?? false;
        this.name = options.name ?? 'ecs.sqlite';
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

        return new EntitySetSQL(props as any);
    }

    select( query:StackValue[], options ): Promise<StackValue[]> {
        return select(this, query, options);
    }

    async applyUpdates(){
    }

    async markComponentAdd(com: Component): Promise<EntitySetSQL> {
        // adds the component to the entityset if it is unknown,
        // otherwise marks as an update
        const cid = getComponentId(com);
        const [eid, did] = fromComponentId(cid);
        const existing = sqlComponentExists(this.db, eid, did);

        // Log.debug('[markComponentAdd]', cid, existing );

        const def = this.getByDefId(did) as ComponentDefSQL;

        // Log.debug('[markComponentAdd]', existing, com );
        
        sqlUpdateComponent(this.db, com, def);
        
        if (existing === true ) {
            return this.markComponentUpdate(cid);
        }
        
        this.comChanges = addCS(this.comChanges, cid);

        return this;
    }

    async markEntityComponentsRemove(eid: number): Promise<EntitySetSQL> {
        const e = await this.getEntity(eid, false);
        if (e === undefined) {
            return this;
        }

        for (const did of bfToValues(e.bitField)) {
            this.markComponentRemove(toComponentId(eid, did));
        }

        return this;
    }

    async markRemoveComponents(eid: number): Promise<EntitySetSQL> {
        if (eid === 0) {
            return this;
        }

        let e = await this._getEntity(eid);
        if (e === undefined) {
            return this;
        }
        const { bitField } = e;

        if (bfCount(bitField) === 0) {
            return this;
        }

        // Log.debug('[markRemoveComponents]', eid, bitField.toValues() );

        for (const did of bfToValues(bitField)) {
            this.markComponentRemove(toComponentId(eid, did));
        }

        return this;
    }


    async applyRemoveChanges(): Promise<EntitySetSQL> {
        // applies any removal changes that have previously been marked
        const removedComs = getChanges(this.comChanges, ChangeSetOp.Remove);

        for (const cid of removedComs) {
            this.applyRemoveComponent(cid);
        }

        // Log.debug('[applyRemoveChanges]', es.entChanges );

        const removedEnts = getChanges(this.entChanges, ChangeSetOp.Remove);

        for (const eid of removedEnts) {
            this.applyRemoveEntity(eid);
        }

        return this;
    }

    async applyRemoveComponent(cid: ComponentId): Promise<EntitySetSQL> {
        let [eid, did] = fromComponentId(cid);

        const def = this.getByDefId(did);
        // remove component
        // Log.debug('[applyRemoveComponent]', eid, did );
        let e = sqlDeleteComponent(this.db, eid, def);

        if (bfCount(e.bitField) === 0) {
            return this.markEntityRemove(eid);
        } else {
            // e = setEntity(es, e);
        }

        return this;
    }

    /**
     * Removes an entity from the store
     * @param es 
     * @param eid 
     */
    async applyRemoveEntity(eid: number): Promise<EntitySetSQL> {
        sqlDeleteEntity(this.db, eid);
        return this;
    }



    /**
     * 
     * @param es 
     * @param eid 
     */
    async getOrAddEntityBitfield(eid: number): Promise<BitField> {
        // const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);

        let e = sqlRetrieveEntity(this.db, eid);

        // Log.debug('[getOrAddEntityBitfield]', eid, e );
        // let record = await idbGet(store, eid);
        if (e === undefined) {
            // e = createEntityInstance(eid, createBitfield() );
            // e = setEntity( es, e );
            this.markEntityAdd(eid);
            return createBitField();
        }

        return e.bitField;
    }


    /**
     * Returns a Component by its id
     * @param es 
     * @param id 
     */
    async getComponent(id: ComponentId | Component): Promise<Component> {
        let cid: ComponentId = isComponentId(id) ? 
            id as ComponentId 
            : getComponentId(id as Component);

        this.openEntitySet();

        let [eid, did] = fromComponentId(cid);
        const def = this.getByDefId(did);
        let com = sqlRetrieveComponent(this.db, eid, def);

        return com;
    }



    setEntity(e: Entity): Entity {
        // Log.debug('[setEntity]', e);  
        return sqlUpdateEntity(this.db, e);
    }

    _getEntity(eid: EntityId): Entity {
        let e = sqlRetrieveEntity(this.db, eid);
        // recreate the entity properly (with com references)
        return e !== undefined ? this.createEntity(e.id, e.bitField) : undefined;
    }

    
    /**
     * Returns an entity instance with components
     * 
     * @param es 
     * @param eid 
     */
    async getEntity(eid: EntityId, populate: boolean = true): Promise<Entity> {
        this.openEntitySet();
        let e = this._getEntity(eid);
        if (e === undefined) {
            return undefined;
        }

        if (!populate) {
            return e;
        }

        let dids = bfToValues(e.bitField);
        let defs = dids.map(did => this.getByDefId(did));

        let coms = sqlRetrieveEntityComponents(this.db, eid, defs);

        // Log.debug('[getEntity]', coms );
        for (const com of coms) {
            const did = getComponentDefId(com);
            // const def = this.getByDefId(did);
            e = e.addComponentUnsafe(did, com);
        }

        return e;
    }

    getEntities(): Promise<EntityList> {
        this.openEntitySet();

        let eids = sqlGetEntities(this.db);

        return Promise.resolve(new EntityList(eids));
    }


    /**
     * Registers a new ComponentDef in the entityset
     * @param es 
     * @param value 
     */
    async register(value: ComponentDef | ComponentDefObj | any): Promise<ComponentDef> {
        this.openEntitySet();
        let def = createComponentDef(0, value);


        // insert the def into the def tbl
        def = sqlInsertDef(this.db, def);

        // Log.debug('[register]', def);

        const did = def[ComponentDefT];
        const { hash, tblName } = (def as ComponentDefSQL);

        this.componentDefs[did - 1] = def;
        this.byUri.set(def.uri, did);
        this.byHash.set(hash, did);

        return def;
    }

    async getComponentDefs(): Promise<ComponentDef[]> {
        this.openEntitySet();
        return sqlRetrieveDefs(this.db);
    }


    async size(): Promise<number> {
        this.openEntitySet();
        return sqlCount(this.db);
    }



    async openEntitySet(options: SQLEntitySetOptions = {}): Promise<EntitySetSQL> {
        if (sqlIsOpen(this.db)) {
            return this;
        }
        const readDefs = options.readDefs ?? true;
        const { isMemory } = this;
        const verbose = this.debug ? console.log : undefined;
        const name = options.name ?? this.uuid;

        // Log.debug('[constructor]', name, { ...options, isMemory, verbose });
        this.db = sqlOpen(name, { ...options, isMemory, verbose });

        // read component defs into local cache

        return this;
    }

    closeEntitySet(es: EntitySetSQL) {

    }

}

