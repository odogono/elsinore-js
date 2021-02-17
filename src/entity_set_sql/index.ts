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
    EntityId
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
} from '@odgn/utils/bitfield';
import { createUUID, toBoolean } from '@odgn/utils';
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
    sqlGetEntities,
    sqlRetrieveComponentsByDef,
    sqlBegin, 
    sqlCommit
} from "./sqlite";
import { createLog } from "../util/log";
import { select } from "./query";
import { EntitySetMem, AddType, AddOptions, RemoveType, ESOptions, EntitySet, EntitySetOptions, CloneOptions } from "../entity_set";
import { StackValue } from "../query/types";
import { QueryStack } from "../query";

const Log = createLog('EntitySetSQL');


export interface ComponentDefSQL extends ComponentDef {
    tblName?: string;
}



export interface SQLEntitySetOptions extends EntitySetOptions {
    path?: string;
    readDefs?: boolean;
    isMemory?: boolean;
    clearDb?: boolean;
    db?: SqlRef;
}




/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export class EntitySetSQL extends EntitySetMem {

    // keep a reference to the open es db
    db?: SqlRef;

    path: string;
    isMemory: boolean;
    debug: boolean;

    type: string = 'sql';
    isAsync: boolean = true;


    constructor(options: SQLEntitySetOptions = {}) {
        super(options as any);
        this.isMemory = toBoolean(options.isMemory ?? false);
        this.debug = options.debug ?? false;
        this.path = options.path ?? 'ecs.sqlite';
        this.db = options.db ?? undefined;
    }

    getUrl() {
        return this.isMemory ?
            `es://sqlite?uuid=${this.uuid}&isMemory=${this.isMemory}`
            : `es://sqlite${this.path}?uuid=${this.uuid}`;
    }

    clone(options: CloneOptions = {}) {
        const { byUri, byHash, entChanges, comChanges } = this;
        let componentDefs = this.componentDefs.map(d => ({ ...d }));

        let props = {
            ...this,
            componentDefs,
            uuid: createUUID(),
            byUri: new Map<string, number>(byUri),
            byHash: new Map<number, number>(byHash),
            entChanges: createChangeSet(entChanges),
            comChanges: createChangeSet(comChanges),
        }

        return new EntitySetSQL(props as any);
    }

    select(stack: QueryStack, query: StackValue[]): Promise<StackValue[]> {
        stack.es = this as unknown as EntitySet;
        return select(stack, query);
    }

    // /**
    //  * 
    //  */
    // *entityIds() {
    //     this.openEntitySet();
    //     let eids = sqlGetEntities(this.db);

    //     for (const eid of eids) {
    //         yield eid;
    //     }
    // }

    /**
     * Returns an iterate over all of the Entitys in the es
     * @param populate 
     */
    async *getEntities(populate: boolean = true): AsyncGenerator<Entity, void, void> {
        this.openEntitySet();
        let eids = sqlGetEntities(this.db);

        for (const eid of eids) {
            yield await this.getEntity(eid, populate);
        }
    }

    async *getComponents() {
        this.openEntitySet();

        for (const def of this.componentDefs) {
            // console.log('getC', def.uri);
            for (const com of sqlRetrieveComponentsByDef(this.db, def)) {
                yield com;
            }
        }
    }

    /**
     * Returns an AsyncIterator for all of the entity ids
     * in the es
     * 
     */
    async *[Symbol.asyncIterator]() {
        this.openEntitySet();
        let eids = sqlGetEntities(this.db);

        for (const eid of eids) {
            yield eid;
        }
    }

    // getEntities(): Promise<EntityId[]> {
    //     this.openEntitySet();

    //     let eids = sqlGetEntities(this.db);

    //     return Promise.resolve(eids);
    // }


    async beginUpdates() {
        sqlBegin(this.db);
    }

    async applyUpdates() {
        // if (this.entUpdates.size > 0 || this.comUpdates.size > 0) {
            sqlCommit(this.db);
        // }
    }

    async markComponentAdd(com: Component, options: ESOptions = {}): Promise<EntitySetSQL> {
        const debug = options.debug ?? false;
        // adds the component to the entityset if it is unknown,
        // otherwise marks as an update
        const cid = getComponentId(com);
        const [eid, did] = fromComponentId(cid);
        const existing = sqlComponentExists(this.db, eid, did);

        // Log.debug('[markComponentAdd]', cid, existing );

        const def = this.getByDefId(did) as ComponentDefSQL;

        // Log.debug('[markComponentAdd]', existing, com );

        sqlUpdateComponent(this.db, com, def);

        if (existing === true) {
            return this.markComponentUpdate(cid);
        }

        this.comChanges = addCS(this.comChanges, cid);

        return this;
    }

    async markEntityComponentsRemove(eids: EntityId[]): Promise<EntitySetSQL> {
        for (let ii = 0; ii < eids.length; ii++) {
            const eid = eids[ii];
            const e = await this.getEntity(eid, false);
            if (e === undefined) {
                continue;
            }
            for (const did of bfToValues(e.bitField)) {
                this.markComponentRemove(toComponentId(eid, did));
            }
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
        // let ee = sqlRetrieveEntity(this.db, eid);
        // Log.debug('[applyRemoveComponent]', eid, did, ee );

        let e = sqlDeleteComponent(this.db, eid, def);

        if (e === undefined || bfCount(e.bitField) === 0) {
            return this.markEntityRemove(eid);
        }

        this.markEntityUpdate(eid);


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

        e = this.retrieveEntityComponents(e);

        // let dids = bfToValues(e.bitField);
        // let defs = dids.map(did => this.getByDefId(did));

        // let coms = sqlRetrieveEntityComponents(this.db, eid, defs);

        // // Log.debug('[getEntity]', coms );
        // for (const com of coms) {
        //     const did = getComponentDefId(com);
        //     // const def = this.getByDefId(did);
        //     e = e.addComponentUnsafe(did, com);
        // }

        return e;
    }

    retrieveEntityComponents(e: Entity) {
        let dids = bfToValues(e.bitField);
        let defs = dids.map(did => this.getByDefId(did));

        let coms = sqlRetrieveEntityComponents(this.db, e.id, defs);

        // Log.debug('[getEntity]', coms );
        for (const com of coms) {
            const did = getComponentDefId(com);
            // const def = this.getByDefId(did);

            e = this.addComponentToEntity(e, com, did);
            // e = e.addComponentUnsafe(did, com);
        }
        return e;
    }


    /**
     * Registers a new ComponentDef in the entityset
     * @param es 
     * @param value 
     */
    async register(value: ComponentDef | ComponentDefObj | any): Promise<ComponentDef> {
        this.openEntitySet();
        let def: ComponentDef = createComponentDef(0, value);

        // Hash the def, and check whether we already have this
        // const existing = this.getByHash(def.hash);
        let existing = sqlRetrieveDefByHash(this.db, def.hash);

        def = existing === undefined ? sqlInsertDef(this.db, def) : existing;

        const did = def[ComponentDefT];
        // const { hash, tblName } = (def as ComponentDefSQL);

        this.componentDefs[did - 1] = def;
        this.byUri.set(def.uri, did);
        this.byHash.set(def.hash, did);

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
        const path = this.path ?? this.uuid;

        // Log.debug('[constructor]', path, { ...options, isMemory, verbose });
        this.db = sqlOpen(path, { ...options, isMemory, verbose });

        // read component defs into local cache

        return this;
    }

    closeEntitySet(es: EntitySetSQL) {

    }

}

