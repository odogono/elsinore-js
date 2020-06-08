// import { AddType, AddOptions, clearChanges, RemoveType } from ".";
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
    ComponentList,
    isComponentList,
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
    toValues as bfToValues
} from "../util/bitfield";
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
} from "../component_def";
import {
    Entity,
    isEntity,
    getComponents as getEntityComponents,
    Type as EntityT,
    create as createEntityInstance,
    addComponentUnsafe,
    getEntityId,
    EntityList,
    createEntityList,
    isEntityList,
    EntityId,
    setEntityId
} from "../entity";
import { StackValue } from "../query/types";
import { createUUID } from "../util/uuid";
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
import { isInteger, isObject, isString } from "../util/is";
import { MatchOptions } from '../constants';
import { select } from "./query";
import { buildFlake53 } from "../util/id";

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


export type ResolveComponentDefIdResult = [Component, string][] | [BitField, string][];

export type ResolveDefIds = string | string[] | number | number[];

export type AddArrayType = (Entity | Component)[];// Entity[] | Component[];
export type AddType = Entity | Component | OrphanComponent | AddArrayType;
export type RemoveType = ComponentId | Entity | Component;

export abstract class EntitySet {
    isEntitySet: boolean = true;
    isAsync: boolean = false;

    uuid: string = createUUID();

    componentDefs: ComponentDef[] = [];
    byUri = new Map<string, number>();
    byHash = new Map<number, number>();

    entChanges = createChangeSet<number>();
    comChanges = createChangeSet<ComponentId>();
    comUpdates = new Map<ComponentId, any>();
    entUpdates = new Map<number, BitField>();

    constructor(data?: EntitySet) {
        if (data !== undefined) {
            Object.assign(this, data);
        }
    }

    abstract clone();

    // clone<ES extends EntitySet>( es:ES ):ES {
    //     return new EntitySet(es) as ES;
    // }

    abstract select( query:StackValue[], options ): Promise<StackValue[]>;

    abstract size(): Promise<number>;

    abstract add(item: AddType, options?: AddOptions): Promise<EntitySet>;

    abstract getEntity(eid: EntityId, populate?: boolean): Promise<Entity>;

    abstract getComponent(id: ComponentId | Component): Promise<Component>;

    abstract removeEntity(item: (number | Entity), options?: AddOptions): Promise<EntitySet>;

    abstract removeComponent(item: RemoveType, options?: AddOptions): Promise<EntitySet>;

    createEntity(): EntityId {
        return createEntityId();
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

    getComponentDefs(): Promise<ComponentDef[]> {
        return Promise.resolve(this.componentDefs);
    }



    addComponentToEntity(e: Entity, com: Component, did?: ComponentDefId): Entity {
        did = did === undefined ? getComponentDefId(com) : did;
        const def = this.getByDefId(did);
        return addComponentUnsafe(e, did, com, def.name);
    }

    async register(value: ComponentDef | ComponentDefObj | any): Promise<ComponentDef> {

        let did = this.componentDefs.length + 1;

        let def = createComponentDef(did, value);

        // Hash the def, and check whether we already have this
        let hash = hashComponentDef(def);

        const existing = this.getByHash(hash);
        if (existing !== undefined) {
            throw new Error(`component definition already exists (${existing[DefT]}/${existing.uri})`);
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
    resolveComponentDefIds(dids: ResolveDefIds): BitField {
        const bf = createBitField();

        if (!Array.isArray(dids) || dids.length === 0) {
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

        return defs.reduce((bf, def) => def === undefined ? bf : bfSet(bf, getDefId(def)), bf);
    }
}

export class EntitySetMem extends EntitySet {
    type: string = 'memt';


    isEntitySetMem: boolean = true;

    components = new Map<ComponentId, Component>();
    entities = new Map<EntityId, BitField>();


    // esAdd = this.add;
    // esRegister = this.register;
    // esGetComponentDefs = this.getComponentDefs;
    // esGetComponent = this.getComponent;
    // esEntities = this.getEntities;

    constructor(data?: EntitySet) {
        super();
        if (data !== undefined) {
            Object.assign(this, data);
        }
    }

    clone(){
        const {components,entities,byUri,byHash,entChanges,comChanges} = this;
        let props = {
            ...this,
            uuid: createUUID(),
            components: new Map<ComponentId,Component>(components),
            entities: new Map<EntityId,BitField>(entities),
            byUri: new Map<string,number>(byUri),
            byHash: new Map<number,number>(byHash),
            entChanges: createChangeSet(entChanges),
            comChanges: createChangeSet(comChanges),
        }

        
        let result = new EntitySetMem(props as any);
        // console.log('[mem][clone]', this.components, result.components);

        return result;
    }

    async size():Promise<number>{
        return this.entities.size;
    }

    select( query:StackValue[], options ): Promise<StackValue[]> {
        return select(this, query, options);
    }

    async add<ES extends EntitySet>(item: AddType, options: AddOptions = {}): Promise<ES> {
        if (options.retain !== true) {
            this.clearChanges();
        }

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

            // add components on entities
            await ents.reduce( (p,e) => p.then( () => this.addComponents(getEntityComponents(e))), Promise.resolve() );

            // add components
            await this.addComponents(coms);
        }
        else if (isComponentLike(item)) {
            await this.addComponents([item as Component]);
        }
        else if (isEntity(item)) {
            let e = item as Entity
            this.markRemoveComponents(e[EntityT]);
            await this.addComponents(getEntityComponents(e));
        }
        
        this.applyRemoveChanges();
        
        await this.applyUpdates();
        

        return this as unknown as ES;
    }

    async applyUpdates(){
        
        if (this.entUpdates.size > 0) {
            
            const entities = new Map<number, BitField>(this.entities);
            
            for (const [eid, bf] of this.entUpdates) {
                entities.set(eid, bf);
            }
            
            this.entities = entities;
            // console.log('[add]', 'applying entity updates', this.entities );
            this.entUpdates.clear();
        }

        if (this.comUpdates.size > 0) {
            // Log.debug('[add]', 'applying com updates', es.comUpdates );

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
        await components.reduce( (p,com) => p.then( () => this.markComponentAdd(com)), Promise.resolve() );

        // gather the components that have been added or updated and apply
        let changedCids = getChanges(this.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)
        // console.log('[addComponents]', 'pre', changedCids);

        this.comChanges = mergeCS(changes, this.comChanges);

        // sequentially apply
        await changedCids.reduce( (p,cid) => p.then( () => this.applyUpdatedComponents(cid)), Promise.resolve() );

        // console.log('[addComponents]', 'ent updates', this.entUpdates.size);

        return this;
    }

    async removeComponent(item: RemoveType, options: AddOptions = {}): Promise<EntitySet> {
        if (options.retain !== true) {
            this.clearChanges();
        }

        let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
        if (cid === undefined) {
            return this;
        }
        this.markComponentRemove(cid);

        // Log.debug('[removeComponent]', cid );
        return this.applyRemoveChanges();
    }


    async removeEntity(item: (number | Entity), options: AddOptions = {}): Promise<EntitySet> {
        if( options.retain !== true ){
            this.clearChanges();
        }

        let eid = isInteger(item) ? item as number : isEntity(item) ? getEntityId(item as Entity) : 0;
        if (eid === 0) {
            return this;
        }
        await this.markEntityComponentsRemove(eid);

        return this.applyRemoveChanges();
    }

    async getComponent(id: ComponentId | Component): Promise<Component> {
        // Log.debug('[getComponent]', id);
        if (isComponentId(id)) {
            return this.components.get(id as ComponentId);
        }
        const cid = getComponentId(id as Component);
        return this.components.get(cid);
    }

    async getEntity(eid: number, populate: boolean = true): Promise<Entity> {
        let ebf = this.entities.get(eid);
        if (ebf === undefined) {
            return undefined;
        }
        let e = createEntityInstance(eid, ebf);

        if (!populate) {
            return e;
        }

        for (const did of bfToValues(ebf)) {
            const com = this.components.get(toComponentId(eid, did));

            e = this.addComponentToEntity(e, com, did);
        }

        return e;
    }

    async getEntities(bf?: BitField) {
        return this.matchEntities(bf);
    }

    matchEntities(mbf: BitField, options: MatchOptions = {}): EntityList {
        let matches = [];
        // let entities = new Map<number,BitField>();
        let { returnEntities, limit } = options;
        limit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;

        for (let [eid, ebf] of this.entities) {
            // console.log('[matchEntities]', 'limit', eid, mbf.toString(), ebf.toString(), BitField.or( mbf, ebf ));
            if (mbf.isAllSet || bfOr(mbf, ebf)) {
                if (returnEntities) {
                    matches.push(this.getEntity(eid));
                } else {
                    matches.push(eid);
                    // entities.set(eid, ebf);
                }

                if (matches.length >= limit) {
                    break;
                }
            }
        }

        // Log.debug('[matchEntities]', 'dammit', entities );
        return createEntityList(matches, mbf);
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
            eid = createEntityId();
        }
        
        this.entUpdates.set(eid, bf);

        return setEntityId(e, eid);
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
    async markEntityComponentsRemove(eid: number): Promise<EntitySet> {
        const e = await this.getEntity(eid, false);
        if (e === undefined) {
            return this;
        }

        for (const did of bfToValues(e.bitField)) {
            this.markComponentRemove(toComponentId(eid, did));
        }
        return this;
    }

    /**
     * 
     * @param eid 
     */
    async markRemoveComponents(eid: number): Promise<EntitySet> {
        if (eid === 0) {
            return this;
        }

        const ebf = this.entities.get(eid);
        if (ebf === undefined) {
            return this;
        }

        for (const did of bfToValues(ebf)) {
            this.markComponentRemove(toComponentId(eid, did));
        }

        return this;
    }

    /**
     * 
     * @param eid 
     */
    applyRemoveEntity(eid: number) {
        this.entities.delete(eid);
    }

    /**
     * 
     */
    async applyRemoveChanges(): Promise<EntitySet> {
        // applies any removal changes that have previously been marked
        const removedComs = getChanges(this.comChanges, ChangeSetOp.Remove);

        for (const cid of removedComs) {
            this.applyRemoveComponent(cid);
        }
        // es = removedComs.reduce((es, cid) => applyRemoveComponent(es, cid), es);

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

        // console.log('[applyUpdatedComponents]', eid, did, isNew, bfGet(ebf,did) === false, findCS(this.entChanges, eid) );

        // does the component already belong to this entity?
        if (bfGet(ebf, did) === false) {
            let e = createEntityInstance(eid);
            // console.log('[applyUpdatedComponents]', eid, did, bfToValues(e.bitField) );
            e.bitField = bfSet(ebf, did);

            // console.log('[applyUpdatedComponents]', eid, did, isNew, bfToValues(e.bitField), this.entChanges );

            this.setEntity(e);

            // console.log('[applyUpdatedComponents]', eid, did, this.entUpdates );
        }

        if (isNew) {
            this.markEntityUpdate(eid);
        }
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
        // if( ebf !== undefined ){
        ebf = bfSet(ebf, did, false);
        // }

        // let entities = new Map<number, BitField>(es.entities);
        // let ebf = createBitfield(entities.get(eid));
        // ebf.set(did, false);
        // entities.set(eid, ebf);

        // remove component
        let components = new Map<ComponentId, Component>(this.components);
        components.delete(cid);

        this.components = components;

        // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

        if (bfCount(ebf) === 0) {
            return this.markEntityRemove(eid);
        } else {
            this.entUpdates.set(eid, ebf);
        }

        return this;
    }

    clearChanges() {
        this.comChanges = createChangeSet();
        this.entChanges = createChangeSet();
    }


    createEntityAlt(): EntityId {
        let eid = createEntityId();
        this.markEntityAdd(eid);
        return eid;
    }


}


const ESEpoch = 1577836800000; // 2020-01-01T00:00:00.000Z
let idSequence = 0;

function createEntityId() {
    return buildFlake53({ timestamp: Date.now(), workerId: 0, epoch: ESEpoch, sequence: idSequence++ });
}