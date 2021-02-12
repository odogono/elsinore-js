import {
    Component,
    isComponent,
    isComponentLike,
    ComponentId,
    getComponentId,
    getComponentDefId,
    getComponentEntityId,
    setEntityId as setComponentEntityId,
    toComponentId,
    isComponentId,
    fromComponentId,
    create as createComponentInstance,
    isExternalComponent,
    OrphanComponent
} from "../component";
import {
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    or as bfOr,
    toValues as bfToValues,
    isBitField
} from "@odgn/utils/bitfield";
import {
    Type as DefT,
    ComponentDef,
    ComponentDefId,
    ComponentDefObj,
    create as createComponentDef,
    hash as hashComponentDef,
    getProperty,
    getDefId,
    isComponentDef,
    toObject as defToObject
} from "../component_def";
import {
    Entity,
    isEntity,
    getEntityId,
    EntityId
} from "../entity";
import { StackValue, SType, InstResult } from "../query/types";
import { createUUID } from '@odgn/utils';
import { query, QueryOptions, createStdLibStack, Statement } from '../query';
import {
    ChangeSet,
    create as createChangeSet,
    add as addCS,
    update as updateCS,
    remove as removeCS,
    find as findCS,
    merge as mergeCS,
    ChangeSetOp, getChanges
} from "./change_set";
import { isInteger, isObject, isString } from '@odgn/utils';
import { MatchOptions } from '../constants';
import { select, matchEntities } from "./query";
import { buildFlake53 } from '@odgn/utils';
import { QueryStack } from "../query/stack";
import { unpackStackValueR } from "../query/util";

export interface ESOptions {
    debug?: boolean;
}

export interface AddOptions {
    debug?: boolean;
    retain?: boolean;
}


export function isEntitySet(value: any): boolean {
    return isObject(value) && value.isEntitySet === true;
}

export function isEntitySetMem(value: any): boolean {
    return isObject(value) && value.isEntitySetMem === true;
}

export type EntityIdGen = () => EntityId;

export interface EntitySetOptions {
    readDefs?: boolean;
    debug?: boolean;
    eidEpoch?: number;
    uuid?: string;
    // optional id generator
    idgen?: EntityIdGen;
}

export interface CloneOptions {
    cloneDefs?: boolean;
    cloneEntities?: boolean;
}

export type ResolveComponentDefIdResult = [Component, string][] | [BitField, string][];

export type ResolveDefIds = string | string[] | ComponentDefId | ComponentDefId[];

export type AddArrayType = (Entity | Component)[];// Entity[] | Component[];
export type AddType = Entity | Component | OrphanComponent | AddArrayType | EntitySetMem;
export type RemoveType = ComponentId | Entity | Component | EntitySetMem;


let workerIdBase = 0;

export abstract class EntitySet {
    isEntitySet: boolean = true;
    isAsync: boolean = false;
    type: string = 'es';

    uuid: string = createUUID();

    componentDefs: ComponentDef[] = [];
    byUri = new Map<string, number>();
    byHash = new Map<number, number>();

    entChanges = createChangeSet<number>();
    comChanges = createChangeSet<ComponentId>();
    comUpdates = new Map<ComponentId, any>();
    entUpdates = new Map<number, BitField>();

    // to slightly reduce the chance of eid collision, we randomise
    // the sequence
    eidSeq: EntityId = Math.random() * 255;

    // by default, make sure the workerId is incremented
    workerId: number = workerIdBase++;

    idgen: EntityIdGen;

    // for generation of entityids
    readonly eidEpoch: number = 1609459200000; // 2021-01-01T00:00:00.000Z

    stack: QueryStack;

    constructor(data?: EntitySet, options: EntitySetOptions = {}) {
        if (data !== undefined) {
            Object.assign(this, data);
        }
        this.idgen = options.idgen;
        this.eidEpoch = options.eidEpoch ?? 1609459200000; // 2021-01-01T00:00:00.000Z
    }

    /**
     * Returns a url indicating the type/config of this EntitySet
     */
    abstract getUrl();

    abstract clone(options?: CloneOptions);

    abstract select(stack: QueryStack, query: StackValue[]): Promise<StackValue[]>;

    abstract size(): Promise<number>;

    abstract add(item: AddType, options?: AddOptions): Promise<EntitySet>;

    /**
     * Returns an entity by its id
     * 
     * @param eid 
     * @param populate 
     */
    abstract getEntity(eid: EntityId, populate?: boolean): Promise<Entity>;


    /**
     * Returns a generator of all entities in the set
     */
    // abstract getEntities(): Promise<EntityId[]>;
    abstract getEntities(populate?: boolean): AsyncGenerator<Entity, void, void>;

    /**
     * Returns a generator of all components in the set
     */
    abstract getComponents(): AsyncGenerator<Component, void, void>;

    /**
     * Returns entities by defId
     * 
     * @param dids 
     * @param populate 
     */
    // abstract getEntitiesByDefId( dids:ComponentDefId[], options:MatchOptions ): Promise<Entity[]|EntityId[]>;


    /**
     * Returns a Component by its id [entityId,defId]
     * 
     * @param id 
     */
    abstract getComponent(id: ComponentId | Component): Promise<Component>;

    /**
     * Removes an entity by its id
     * @param item 
     * @param options 
     */
    abstract removeEntity(item: (EntityId | EntityId[] | Entity), options?: AddOptions): Promise<EntitySet>;

    abstract removeComponent(item: RemoveType, options?: AddOptions): Promise<EntitySet>;

    abstract removeComponents(items: RemoveType[], options?: AddOptions): Promise<EntitySet>;


    /**
     * Returns an array of EntityId that were added or updated last op
     */
    getUpdatedEntities(): EntityId[] {
        return getChanges(this.entChanges, ChangeSetOp.Add | ChangeSetOp.Update);
    }

    /**
     * Returns an array of EntityId that were removed in the last operation
     */
    getRemovedEntities(): EntityId[] {
        return getChanges(this.entChanges, ChangeSetOp.Remove);
    }

    /**
     * 
     * @param q 
     * @param options 
     */
    prepare(q: string, options: QueryOptions = {}) {
        let stmt = new Statement(q, { values: [[SType.EntitySet, this]] });
        stmt.stack.addWords([
            ['!es', onEntitySet, SType.Map]
        ]);
        return stmt;
    }


    /**
     * 
     * @param q 
     * @param options 
     */
    async query(q: string, options: QueryOptions = {}): Promise<QueryStack> {
        const reset = options.reset ?? false;
        let values: StackValue[] = options.values ?? [];
        if (this.stack === undefined || reset) {
            this.stack = createStdLibStack();
            this.stack.addWords([
                ['!es', onEntitySet, SType.Map]
            ]);
        }

        values = [[SType.Value, 'cls'], [SType.EntitySet, this], ...values];

        return await query(q, { stack: this.stack, values });
    }

    /**
     * Returns the results of a query as an array of entities
     * 
     * @param q 
     * @param options 
     */
    async queryEntities(q: string, options: QueryOptions = {}): Promise<Entity[]> {
        const stack = await this.query(q, options);
        const value = stack.pop();
        let result: Entity[] = [];
        if (value === undefined) { return result; }

        const [type, val] = value;
        if (type === SType.List) {
            let e: Entity;
            for (const [lt, lv] of val) {
                if (lt === SType.Entity) {
                    result.push(lv);
                }
                else if (lt === SType.Component) {
                    let eid = getComponentEntityId(lv);
                    let did = getComponentDefId(lv);
                    // const name = this.getByDefId(did).name;
                    if (e === undefined || e.id !== eid) {
                        if (e !== undefined) {
                            result.push(e);
                        }
                        e = this.createEntity(eid);
                    }
                    e.addComponentUnsafe(did, lv);
                }
            }
            if (e !== undefined) {
                result.push(e);
            }
        } else if (type === SType.Component) {
            // result.push( addCom(undefined,val));
            let eid = getComponentEntityId(val);
            let did = getComponentDefId(val);
            // const name = this.getByDefId(did).name;
            let e = this.createEntity(eid);
            e.addComponentUnsafe(did, val);
            result.push(e);
        } else if (type == SType.Entity) {
            result.push(val);
        }

        return result;
    }



    async openEntitySet(options: EntitySetOptions = {}): Promise<EntitySet> {
        return this;
    }

    createEntity(eid: EntityId = 0, bf?: BitField): Entity {
        let e = new Entity(eid, bf);
        e = e.defineComponentProperties(this.componentDefs);
        return e;
    }

    createEntityId(): EntityId {
        if (this.idgen !== undefined) {
            return this.idgen();
        }
        return buildFlake53({
            timestamp: Date.now(),
            workerId: this.workerId,
            epoch: this.eidEpoch,
            sequence: this.eidSeq++
        });
    }

    createComponent(defId: (string | number | ComponentDef), attributes = {}): Component {
        let def: ComponentDef = undefined;

        if (isString(defId)) {
            def = this.getByUri(defId as string);
        } else if (isInteger(defId)) {
            def = this.getByHash(defId as number) || this.componentDefs[(defId as number) - 1];
        } else if (isComponentDef(defId)) {
            def = defId as any as ComponentDef;
        }

        // Log.debug('[createComponent]', defId, attributes, def );
        if (def === undefined) {
            // Log.debug('[createComponent]', registry.byUri.get( defId as string ), registry.componentDefs );
            throw new Error(`component def not found: ${defId}`);
        }

        let params = {
            ...attributes,
            '@d': def[DefT]
        };

        // create a component instance
        const component = createComponentInstance(params);

        return component;
    }

    getByUri(uri: string): ComponentDef {
        const did = this.byUri.get(uri);
        return did === undefined ? undefined : this.componentDefs[did - 1];
    }

    getByDefId(defId: number): ComponentDef {
        return this.componentDefs[defId - 1];
    }

    getByHash(hash: number): ComponentDef {
        const did = this.byHash.get(hash);
        return did === undefined ? undefined : this.componentDefs[did - 1];
    }

    // getComponentDefs( bf?:BitField|'all' ): Promise<ComponentDef[]> {
    getComponentDefs(): Promise<ComponentDef[]> {
        // if( bf !== undefined ){

        // }
        return Promise.resolve(this.componentDefs);
    }


    getComponentDefsFromBitField(bf?: BitField | 'all', asDefIds = false): ComponentDef[] | ComponentDefId[] {
        if (bf === undefined || bf === 'all' || (isBitField(bf) && bf.isAllSet)) {
            let defs = this.componentDefs;
            return asDefIds ? defs.map(d => getDefId(d)) : defs;
        }

        let dids = bfToValues(bf);
        return asDefIds ? dids : dids.map(d => this.getByDefId(d));
    }



    /**
     * 
     */
    addComponentToEntity(e: Entity, com: Component, did?: ComponentDefId): Entity {
        did = did === undefined ? getComponentDefId(com) : did;
        return e.addComponentUnsafe(did, com);
    }


    /**
     * Register a ComponentDef with this EntitySet
     */
    async register(value: ComponentDef | ComponentDefObj | any): Promise<ComponentDef> {

        let did = this.componentDefs.length + 1;

        let def = createComponentDef(did, value);

        // Hash the def, and check whether we already have this
        let hash = hashComponentDef(def);

        const existing = this.getByHash(hash);
        if (existing !== undefined) {
            // throw new Error(`component definition already exists (${existing[DefT]}/${existing.uri})`);
            return existing;
        }

        // seems legit, add it
        def = { ...def, [DefT]: did };

        this.byHash.set(hash, did);
        this.byUri.set(def.uri, did);

        this.componentDefs = [...this.componentDefs, def];

        return def;
    }

    resolveComponent(com: (OrphanComponent | Component)): Component {
        if (!isExternalComponent(com)) {
            return com as any;
        }
        const sdid = com[DefT] as string;
        const def = this.getByUri(sdid);
        if (def === undefined) {
            throw new Error(`def id not found ${sdid}`);
        }
        const did = def[DefT];
        return { ...com, [DefT]: did } as any;
    }

    resolveComponentDefAttribute(did: string): [BitField, string] {

        let attrName: string;
        const isAttr = (did as string).indexOf('#') !== -1;
        if (isAttr) {
            [did, attrName] = (did as string).split('#');
        }

        // Log.debug('[resolveComponentDefAttribute]', did,attrName );

        const def = this.getByUri(did);

        if (!def) {
            // Log.debug('[resolveComponentDefAttribute]', 'def not found', did);
            return [createBitField(), undefined];
        }

        // Log.debug('[resolveComponentDefAttribute]', 'getting prop', def, attrName );

        const prop = getProperty(def, attrName);

        const bf = createBitField([getDefId(def)])

        // console.log('[resolveComponentDefAttribute]', did, isAttr, attrName, def.properties );

        // Log.debug('[resolveComponentDefAttribute]', def, attrName );
        return [bf, prop ? attrName : undefined];
    }


    /**
     * Resolves an array of Def identifiers (uri,hash, or did) to ComponentDefs  
     * @param registry ComponentRegistry
     * @param dids array of def ids as strings or numbers 
     */
    resolveComponentDefIds(value: ResolveDefIds): BitField {
        const bf = createBitField();

        let dids = Array.isArray(value) ? value : [value];
        if (dids.length === 0) {
            return bf;
        }

        const defs: ComponentDef[] = (dids as []).map(did => {
            // Log.debug('[resolveComponentDefIds]', did, registry );
            if (isString(did)) {
                return this.getByUri(did);
            }
            else if (isInteger(did)) {
                return this.getByHash(did) || this.componentDefs[did - 1];
            }
            return undefined;
        });

        return defs.reduce((bf, def) => 
            def === undefined ? 
                bf : 
                bfSet(bf, getDefId(def)), 
        bf);
    }

    /**
     * Resolves a def uri to its Did
     * @param value 
     */
    resolveComponentDefId(value: string): ComponentDefId {
        const def = this.getByUri(value);
        return def !== undefined ? def[DefT] : 0;
    }
}


/**
 * 
 */
export class EntitySetMem extends EntitySet {
    type: string = 'mem';


    isEntitySetMem: boolean = true;

    components = new Map<ComponentId, Component>();
    entities = new Map<EntityId, BitField>();

    constructor(data?: EntitySet, options: EntitySetOptions = {}) {
        super(data, options);
        if (data !== undefined) {
            Object.assign(this, data);
        }
    }

    getUrl(){
        return `es://${this.type}/?uuid=${this.uuid}`;
    }

    clone(options: CloneOptions = {}) {
        let includeDefs = options.cloneDefs ?? true;
        let includeEnts = includeDefs ? options.cloneEntities ?? true : false;

        let { componentDefs, components, entities, byUri, byHash, entChanges, comChanges } = this;
        if (!includeEnts) {
            components = undefined;
            entities = undefined;
            entChanges = undefined;
            comChanges = undefined;
        }
        if (!includeDefs) {
            componentDefs = undefined;
            byHash = undefined;
            byUri = undefined;
        }
        let props = {
            ...this,
            uuid: createUUID(),
            components: new Map<ComponentId, Component>(components),
            entities: new Map<EntityId, BitField>(entities),
            componentDefs: componentDefs ? [...componentDefs] : [],
            byUri: new Map<string, number>(byUri),
            byHash: new Map<number, number>(byHash),
            entChanges: createChangeSet(entChanges),
            comChanges: createChangeSet(comChanges),
        }


        let result = new EntitySetMem(props as any);
        // console.log('[mem][clone]', this.components, result.components);

        return result;
    }

    async size(): Promise<number> {
        return this.entities.size;
    }

    select(stack: QueryStack, query: StackValue[]): Promise<StackValue[]> {
        stack.es = this as unknown as EntitySet;
        return select(stack, query);
    }

    /**
     * 
     * @param item 
     * @param options 
     */
    async add<ES extends EntitySet>(item: AddType, options: AddOptions = {}): Promise<ES> {
        await this.openEntitySet();

        if (options.retain !== true) {
            this.clearChanges();
        }

        const { debug } = options;

        // if( debug ){
        //     console.log('[add]', 'entUpdates', this.entUpdates );
        // }

        if (Array.isArray(item)) {

            let initial: [Entity[], Component[]] = [[], []];
            // sort the incoming items into entities and components
            let [ents, coms] = (item as any[]).reduce(([ents, coms], item) => {
                if (isComponentLike(item)) {
                    coms.push(item);
                } else if (isEntity(item)) {
                    ents.push(item);
                }
                return [ents, coms];
            }, initial);

            // console.log('[add]', ents);
            // add components on entities
            if (ents.length > 0) {
                await ents.reduce((p, e) => p.then(() => this.addComponents(e.getComponents())), Promise.resolve());
            }

            // add components
            await this.addComponents(coms);
        }
        else if (isComponentLike(item)) {
            await this.addComponents([item as Component]);
        }
        else if (isEntity(item)) {
            let e = item as Entity
            // if( debug ){ console.log('add', e)}
            this.markEntityComponentsRemove([e.id]);
            await this.addComponents(e.getComponents());
        }
        else if (isEntitySet(item)) {
            let es = item as EntitySet;
            // apply defs
            let defs = await es.getComponentDefs();
            let didTable = new Map<ComponentDefId, ComponentDefId>();


            // register sender defs and record their ids
            for (let ii = 0, len = defs.length; ii < len; ii++) {
                let def = defs[ii];
                await this.register(def);
                let rdef = this.getByHash(def.hash);
                didTable.set(getDefId(def), getDefId(rdef));
            }

            // console.log('[add][es]', 'convert', didTable);
            // console.log('[add][es]', 'convert', es.components);

            // rebuild each of the sender components altering their
            // def id
            let coms: Component[] = [];

            for await( const com of es.getComponents() ){
                let { '@d': did, ...rest } = com;
                did = didTable.get(did);
                coms.push({ '@d': did, ...rest });
            }

            // console.log('[add][es]', 'convert', coms);
            await this.addComponents(coms);
        } else {
            // console.log('[add]', 'no matching type');
        }

        this.applyRemoveChanges();

        await this.applyUpdates();

        return this as unknown as ES;
    }




    async applyUpdates() {

        if (this.entUpdates.size > 0) {

            // console.log('[add]', 'applying entity updates', this.entUpdates );
            const entities = new Map<number, BitField>(this.entities);

            for (const [eid, bf] of this.entUpdates) {
                if (bf === undefined) {
                    entities.delete(eid)
                } else {
                    entities.set(eid, bf);
                }
            }

            this.entities = entities;
            // console.log('[add]', 'applying entity updates', this.entities );
            this.entUpdates.clear();

            // console.log('[add]', 'cleared entity updates', this.entUpdates );
        }

        if (this.comUpdates.size > 0) {
            // console.log('[add]', 'applying com updates', this.comUpdates );

            const components = new Map<ComponentId, Component>(this.components);

            for (const [cid, com] of this.comUpdates) {
                components.set(cid, com);
            }

            this.components = components;

            this.comUpdates.clear();
        }
    }

    async addComponents(components: Component[], options: ESOptions = {}): Promise<EntitySet> {
        // set a new (same) entity id on all orphaned components
        components = this.assignEntityIds(components)

        // Log.debug('[addComponents]', components);

        // to keep track of changes only in this function, we must temporarily replace
        let changes = this.comChanges;
        this.comChanges = createChangeSet<ComponentId>();
        // clearChanges()

        // mark incoming components as either additions or updates
        await components.reduce((p, com) => p.then(() => this.markComponentAdd(com)), Promise.resolve());

        // gather the components that have been added or updated and apply
        let changedCids = getChanges(this.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)
        // console.log('[addComponents]', 'pre', changedCids);

        this.comChanges = mergeCS(changes, this.comChanges);
        // console.log('[addComponents]', 'changes', this.comChanges);

        // sequentially apply
        await changedCids.reduce((p, cid) => p.then(() => this.applyUpdatedComponents(cid)), Promise.resolve());

        // console.log('[addComponents]', 'ent updates', this.entUpdates.size);

        return this;
    }

    /**
     * 
     * @param components 
     * @param options 
     */
    async removeComponents(items: RemoveType[], options: AddOptions = {}): Promise<EntitySet> {
        if (options.retain !== true) {
            this.clearChanges();
        }
        for (const item of items) {
            let cid = isComponentId(item) ?
                item as ComponentId
                : isComponent(item) ? getComponentId(item as Component) : undefined;
            this.markComponentRemove(cid);
        }

        return this.applyRemoveChanges();
    }

    /**
     * 
     * @param item 
     * @param options 
     */
    async removeComponent(item: RemoveType, options: AddOptions = {}): Promise<EntitySet> {
        return this.removeComponents([item], options);
    }


    /**
     * 
     * @param item 
     * @param options 
     */
    async removeEntity(item: (EntityId | EntityId[] | Entity | Entity[]), options: AddOptions = {}): Promise<EntitySet> {
        if (options.retain !== true) {
            this.clearChanges();
        }

        let eids: EntityId[];

        if (!Array.isArray(item)) {
            item = [item] as any[];
        }

        eids = (item as any[]).map(ii => isInteger(ii) ? ii : isEntity(ii) ? getEntityId(ii as Entity) : 0)
            .filter(it => it !== 0);

        if (eids.length === 0) {
            return this;
        }
        await this.markEntityComponentsRemove(eids);

        return this.applyRemoveChanges();
    }

    async getComponent(id: ComponentId | Component): Promise<Component> {
        return this.getComponentMem(id);
    }

    /**
     * 
     * @param id 
     */
    getComponentMem(id: ComponentId | Component): Component {
        if (isComponentId(id)) {
            return this.components.get(id as ComponentId);
        }
        const cid = getComponentId(id as Component);
        return this.components.get(cid);
    }

    async getEntity(eid: number, populate: boolean = true): Promise<Entity> {
        return this.getEntityMem(eid, populate);
    }

    /**
     * todo : use MatchOptions
     * @param eid 
     * @param populate 
     */
    getEntityMem(eid: number, populate: boolean = true): Entity {
        let ebf = this.entities.get(eid);
        if (ebf === undefined) {
            return undefined;
        }
        let e = this.createEntity(eid, ebf);// new Entity(eid, ebf);

        if (!populate) {
            return e;
        }

        for (const did of bfToValues(ebf)) {
            const com = this.components.get(toComponentId(eid, did));

            e = this.addComponentToEntity(e, com, did);
        }

        return e;
    }

    /**
     * Returns Entity instances for the supplied list of EntityIds
     * 
     * @param eids 
     */
    getEntitiesByIdMem(eids: EntityId[] | boolean, options: MatchOptions = {}): Entity[] {
        const entities = this.entities;
        const populate = options.populate ?? false;

        if (Array.isArray(eids)) {
            return eids.map(eid => {
                let ebf = entities.get(eid);
                return ebf === undefined ? undefined
                    : this.getEntityMem(eid, populate);
            });
        }
        let result = [];
        if (eids === true) {
            for (const [eid] of this.entities) {
                result.push(this.getEntityMem(eid, populate));
            }
        }
        return result;
    }

    /**
     * 
     * @param dids 
     * @param options 
     */
    // getEntitiesByDefId( dids:ComponentDefId[], options:MatchOptions ): Promise<Entity[]|EntityId[]> {

    //     return Promise.resolve([]);
    // }

    // getEntities(): Promise<EntityId[]> {
    //     return Promise.resolve( Array.from(this.entities.keys()) );
    // }

    async * [Symbol.asyncIterator]() {
        for( const eid of this.entities.keys() ){
            yield eid;
        }
    }

    async *getEntities( populate:boolean = true): AsyncGenerator<Entity, void, void> {
        for( const eid of this.entities.keys() ){
            yield await this.getEntity(eid, populate);
        }
    }
    // getEntities(): Promise<EntityId[]> {
    //     return Promise.resolve( Array.from(this.entities.keys()) );
    // }

    async *getComponents(): AsyncGenerator<Component, void, void> {
        for( const [cid, com] of this.components ){
            yield com;
        }
    }

    /**
     * 
     * @param bf 
     * @param options 
     */
    getEntitiesMem(bf: BitField, options: MatchOptions = {}): Entity[] {
        const populate = options.populate ?? false;
        const eids = matchEntities(this, undefined, bf);
        let result = [];
        for (let ii = 0, len = eids.length; ii < len; ii++) {
            result.push(this.getEntityMem(eids[ii], populate));
        }
        return result;
    }

    /**
     * 
     * @param bf 
     * @param options 
     */
    getComponentsMem(bf: BitField, options: MatchOptions = {}): Component[] {
        let coms: Component[] = [];
        let limit = options.limit ?? Number.MAX_SAFE_INTEGER;
        for (const [cid, com] of this.components) {
            const [, did] = fromComponentId(cid);
            if (bfGet(bf, did)) {
                coms.push(com);
            }
            if (coms.length >= limit) {
                break;
            }
        }
        return coms;
    }

    // /**
    //  * 
    //  * @param mbf 
    //  * @param options 
    //  */
    // matchComponents(mbf:BitField, options: MatchOptions = {}): Component[] {
    //     let matches:Component[] = [];
    //     let limit = options.limit ?? Number.MAX_SAFE_INTEGER;

    //     for( let [cid, com] of this.components ){
    //         const [eid,did] = fromComponentId(cid);
    //         if( mbf.isAllSet || bfGet(mbf,did) === true ){
    //             matches.push(com);
    //         }
    //         if( matches.length >= limit ){
    //             break;
    //         }
    //     }

    //     return matches;
    // }


    /**
     * Returns the first component that matches the bitfield and the supplied
     * comparison function
     * @param mbf 
     * @param cb 
     */
    findComponent(mbf: BitField, cb: (com: Component, eid: EntityId, did: ComponentDefId) => boolean): Component {
        for (let [cid, com] of this.components) {
            const [eid, did] = fromComponentId(cid);
            if (mbf.isAllSet || bfGet(mbf, did) === true) {
                if (cb(com, eid, did)) {
                    return com;
                }
            }
        }
        return undefined;
    }

    async getOrAddEntityBitfield(eid: number): Promise<BitField> {
        let record = this.entUpdates.get(eid);

        // Log.debug('[getOrAddEntityBitfield]', bfToValues(record), bfToValues(es.entities.get(eid)) );

        if (record === undefined) {
            record = this.entities.get(eid);

            if (record === undefined) {
                // {mark_entity(es, :add, eid), Entity.ebf()}
                this.markEntityAdd(eid);
                return createBitField();
            }
        }

        // let ebf = createBitField(record);
        // Log.debug('[getOrAddEntityBitfield]!', bfToValues(record), bfToValues(ebf) );

        return record;
    }



    setEntity(e: Entity): Entity {
        let eid = getEntityId(e);
        let bf = e.bitField || createBitField();

        if (eid === 0) {
            eid = this.createEntityId();
        }

        // console.log('[setEntity]', eid);
        this.entUpdates.set(eid, bf);
        e.id = eid;
        return e;
    }


    assignEntityIds(components: Component[]): Component[] {
        let coms = [];
        let eids = new Set();
        let eid = 0;
        let comEid = 0;
        for (let com of components) {
            // ensure the component did is resolved
            com = this.resolveComponent(com);

            let did = getComponentDefId(com);

            comEid = getComponentEntityId(com);

            // component already has an id - add it to the list of components
            if (comEid !== 0) {
                coms.push(com);
                continue;
            }


            // not yet assigned an entity, or we have already seen this com type
            if (eid === 0 || eids.has(did)) {
                // create a new entity - this also applies if we encounter a component
                // of a type we have seen before
                eid = this.createEntityAlt();// await createEntity(es);
                comEid = eid;

                // Log.debug('[assignEntityIds]', 'new e', eid);

                eids = new Set();
                // mark the def as having been seen, store the new entity, add the component
                eids.add(did);
            } else {
                comEid = eid;
            }

            // Log.debug('[assignEntityIds]', 'com eid', {comEid, eid}, eids);

            com = setComponentEntityId(com, comEid);
            // Log.debug('[aei]', 'eid was', eid, com);
            coms.push(com);
        }

        return coms;
    }


    async markComponentAdd(com: Component): Promise<EntitySet> {
        // adds the component to the entityset if it is unknown,
        // otherwise marks as an update
        const cid = getComponentId(com);
        let existing;

        // try for already updated
        existing = this.comUpdates.get(cid);

        if (existing === undefined) {
            // hit the store
            existing = await this.getComponent(cid);
        }

        // Log.debug('[markComponentAdd]', cid, existing );
        this.comUpdates.set(cid, com);

        if (existing !== undefined) {
            return this.markComponentUpdate(cid);
        }
        this.comChanges = addCS(this.comChanges, cid);
        return this;
    }

    markComponentUpdate(cid: ComponentId) {
        this.comChanges = updateCS(this.comChanges, cid)
        // Log.debug('[markComponentUpdate]', cid, comChanges);
        return this;
    }

    markComponentRemove(cid: ComponentId) {
        this.comChanges = removeCS(this.comChanges, cid);
        // Log.debug('[markComponentRemove]', cid);
        return this;
    }

    markEntityAdd(eid: number) {
        this.entChanges = addCS(this.entChanges, eid)
        // Log.debug('[markEntityAdd]', eid);
        return this;
    }
    markEntityUpdate(eid: number) {
        this.entChanges = updateCS(this.entChanges, eid);
        // Log.debug('[markEntityUpdate]', eid);
        // throw new Error('do not update');
        return this;
    }
    markEntityRemove(eid: number) {
        this.entChanges = removeCS(this.entChanges, eid);
        return this;
    }

    /**
     * 
     * @param eid 
     */
    async markEntityComponentsRemove(eids: EntityId[]): Promise<EntitySet> {

        for (let ii = 0; ii < eids.length; ii++) {
            const eid = eids[ii];
            let ebf = this.entities.get(eid);
            if (ebf === undefined) { continue; }
            const dids = bfToValues(ebf);
            for (let dd = 0; dd < dids.length; dd++) {
                this.markComponentRemove(toComponentId(eid, dids[dd]));
            }
        }

        return this;
    }


    /**
     * 
     * @param eid 
     */
    applyRemoveEntity(eid: EntityId) {
        // console.log('[applyRemoveEntity]', eid);
        this.entities.delete(eid);
    }

    /**
     * 
     */
    async applyRemoveChanges(): Promise<EntitySet> {
        // applies any removal changes that have previously been marked
        const removedComs = getChanges(this.comChanges, ChangeSetOp.Remove);
        if (removedComs.length === 0) {
            return this;
        }

        for (const cid of removedComs) {
            this.applyRemoveComponent(cid);
        }

        // Log.debug('[applyRemoveChanges]', removedComs );

        const removedEnts = getChanges(this.entChanges, ChangeSetOp.Remove);

        for (const eid of removedEnts) {
            this.applyRemoveEntity(eid);
        }

        return this;
    }

    /**
     * 
     * @param cid 
     */
    async applyUpdatedComponents(cid: ComponentId): Promise<EntitySet> {
        const [eid, did] = fromComponentId(cid);
        let ebf: BitField;
        // console.log('[applyUpdatedComponents]', eid, did, this.entChanges );
        // console.log('[applyUpdatedComponents]', 'in', this.entUpdates);

        ebf = await this.getOrAddEntityBitfield(eid);

        // console.log('[applyUpdatedComponents]', eid, did, ebf );

        const isNew = findCS(this.entChanges, eid) === ChangeSetOp.Add;
        const hasComponent = bfGet(ebf, did) === true;
        // console.log('[applyUpdatedComponents]', eid, did, isNew, bfGet(ebf,did) === false, findCS(this.entChanges, eid) );

        // does the component already belong to this entity?
        if (!hasComponent) {
            let e = this.createEntity(eid);// new Entity(eid);
            // console.log('[applyUpdatedComponents]', eid, did, bfToValues(e.bitField) );
            e.bitField = bfSet(ebf, did);

            // console.log('[applyUpdatedComponents]', eid, did, isNew, bfToValues(e.bitField), this.entChanges );

            this.setEntity(e);
            // console.log('[applyUpdatedComponents]', eid, did, this.entUpdates );
        }

        // if (isNew) {
        this.markEntityUpdate(eid);
        // }
        // console.log('[applyUpdatedComponents]', 'out', this.entUpdates);

        return this;
    }

    async applyRemoveComponent(cid: ComponentId): Promise<EntitySet> {
        let [eid, did] = fromComponentId(cid);

        // remove the component id from the entity
        let ebf = this.entUpdates.get(eid);

        if (ebf === undefined) {
            ebf = createBitField(this.entities.get(eid));
        }

        // remove from the entity
        ebf = bfSet(ebf, did, false);


        // remove component from the internal component map
        let components = new Map<ComponentId, Component>(this.components);
        components.delete(cid);

        this.components = components;

        // console.log('[applyRemoveComponent]', cid, bfCount(ebf) );

        if (bfCount(ebf) === 0) {
            this.entUpdates.set(eid, undefined);
            return this.markEntityRemove(eid);
        }
        // console.log('[applyRemoveComponent]', 'set', eid, bfCount(ebf));
        this.entUpdates.set(eid, ebf);
        return this.markEntityUpdate(eid);

    }

    clearChanges() {
        this.comChanges = createChangeSet();
        this.entChanges = createChangeSet();
    }


    createEntityAlt(): EntityId {
        let eid = this.createEntityId();
        this.markEntityAdd(eid);
        return eid;
    }


}





function onEntitySet<QS extends QueryStack>(stack: QS): InstResult {
    let data = stack.pop();

    let options = unpackStackValueR(data, SType.Map);
    let es = new EntitySetMem(options);

    return [SType.EntitySet, es];
}