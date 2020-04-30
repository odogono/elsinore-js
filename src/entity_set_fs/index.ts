import { BitField } from 'odgn-bitfield';
import { EntitySet, CreateEntitySetParams, markEntityAdd, clearChanges, markEntityUpdate, AddType, AddOptions, markComponentRemove, markComponentUpdate, markEntityRemove, RemoveType } from "../entity_set";

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
    createEntityList,
    EntityList,
} from "../entity";
import { FsRef, fsCreateRef, fsOpen, fsTmpDir, fsWriteFile, fsDelete, fsReadFile, fsExists } from "./fs";
import { createUUID } from "../util/uuid";
import { ComponentDef, 
    ComponentDefObj, 
    create as createComponentDef, 
    toObject as defToObject,
    hash as hashDef, 
    isComponentDef,
    getDefId,
    Type as ComponentDefT} from '../component_def';


import { ChangeSet,
    create as createChangeSet,
    add as addCS, 
    update as updateCS, 
    find as findCS,
    remove as removeCS, ChangeSetOp, getChanges 
} from "../entity_set/change_set";
import { stringify, parseJSON } from "../util/json";
import { createLog } from "../util/log";
import { buildFlake53, parseFlake53 } from '../util/id';
import { getByDefId, getByUri, getByHash } from '../component_registry';
import { fchmodSync } from 'fs-extra';
import { isString, isInteger, isEmpty } from '../util/is';
import { StackValue } from '../query/stack';
const Log = createLog('EntitySetFS');

/**
 * A file system based EntitySet
 */
export interface EntitySetFS extends EntitySet {
    isComponentRegistry: boolean;

    // keep a reference to the open es db
    db: FsRef;
    debug: boolean;
    isOpen: boolean;

    separatorChar: string;
    lineSep: string;
    prefix: string;

    // records entity changes from the last op
    // entChanges: ChangeSet<number>;
    
    // records component changes from the last op
    // comChanges: ChangeSet<ComponentId>;

    // cached component defs
    componentDefs: ComponentDefFS[];
    // byUri: Map<string, number>;
    // byHash: Map<number, number>;

    // esAdd: FSAdd;
    // esRegister: () => any;
}



export interface ComponentDefFS extends ComponentDef {
    tblName?: string;
    hash?: number;

    
}

const defDef = createComponentDef( 1, '/component/def', [ 'uri', 'name', 'hash', 'properties'] ) as ComponentDefFS;
defDef.tblName = 'component_def';


export interface CreateEntitySetFSParams extends CreateEntitySetParams {
    path?: string;
    prefix?: string;
    clearDb?: boolean;
    debug?: boolean;
}

export function create(options:CreateEntitySetFSParams={}):EntitySetFS {
    const uuid = options.uuid || createUUID();
    const debug = options.debug ?? false;
    const {path} = options;
    const prefix = options.prefix ?? 'ecs-';
    
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();

    const db = fsCreateRef( `${prefix}${uuid}`, path);

    return {
        isComponentRegistry: true,
        isEntitySet:true,
        isAsync: true,
        isOpen: false,
        db,
        separatorChar: '\t',
        lineSep: '\n',
        prefix,
        debug,
        uuid, entChanges, comChanges,
        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),

        esAdd: add,
        esRegister: register,
        esGetComponent: getComponent,
        esGetComponentDefs: (es:EntitySetFS) => es.componentDefs,
        esEntities: async (es:EntitySetFS) => await getEntities(es),
        esGetEntity: (es:EntitySetFS, eid:EntityId) => getEntity(es,eid),
        esSelect: (es:EntitySetFS, query:StackValue[]) => null,
    }
}

/**
 * Registers a new ComponentDef in the entityset
 * @param es 
 * @param value 
 */
export async function register( es: EntitySetFS, value:ComponentDef|ComponentDefObj|any ): Promise<[EntitySetFS, ComponentDef]> {

    es = await openEntitySet(es);
    const {lineSep, separatorChar} = es;

    await ensureComponentDefFile( es, defDef );

    // read existing
    es = await readComponentDefs(es);

    // Log.debug('[register]', 'existing', defRecords );

    const did = es.componentDefs.length + 1;

    let def = createComponentDef( did, value );

    es.componentDefs = [...es.componentDefs, def ];

    es = await writeComponentDefs( es );
    
    await writeComponentFile( es, def );

    
    return [es, undefined];
}


type FSAdd = (es:EntitySetFS, item:AddType, options:AddOptions) => Promise<EntitySetFS>;

export async function add(es: EntitySetFS, item: AddType, options: AddOptions = {}): Promise<EntitySetFS> {
    es = await openEntitySet(es);
    es = options.retain ? es : clearChanges(es as EntitySet) as EntitySetFS;

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

        es = await ents.reduce((pes, e) => 
            pes.then( es => addComponents(es, getEntityComponents(e)) ), 
        Promise.resolve(es));

        es = await addComponents(es, coms);
        es = await applyRemoveChanges(es)
    }
    else if (isComponent(item)) {
        es = await addComponents(es, [item as Component]);
    }
    else if (isEntity(item)) {
        let e = item as Entity
        es = await markRemoveComponents(es, e[EntityT]);
        es = await addComponents(es, getEntityComponents(e));
    }

    es = await applyRemoveChanges(es)

    return es;
}




interface OpenEntitySetOptions {
    readDefs?: boolean;
    isMemory?: boolean;
    clearDb?: boolean;
}

async function openEntitySet( es:EntitySetFS, options:OpenEntitySetOptions = {} ): Promise<EntitySetFS>{
    if( es.isOpen ){
        return es;
    }

    const readDefs = options.readDefs ?? true;
    // const {isMemory} = es;
    const verbose = es.debug ? console.log : undefined;
    
    es.db = await fsOpen( es.db );

    await ensureEntityFile(es);

    await ensureComponentDefFile( es, defDef );

    if( readDefs ){
        es = await readComponentDefs(es);
    }
    
    return {...es, isOpen: true};
}

export async function deleteEntitySet( es:EntitySetFS ): Promise<EntitySetFS> {
    await fsDelete( es.db );
    return es;
}






export async function size(es:EntitySetFS): Promise<number> {
    es = await openEntitySet(es);

    let ents = await readEntityFile(es);

    return ents.length;
}


/**
 * Returns an entity instance with components
 * 
 * @param es 
 * @param eid 
 */
export async function getEntity(es:EntitySetFS, eid:EntityId): Promise<Entity> {
    es = await openEntitySet(es);
    let e = await _getEntity(es, eid);
    if( e === undefined ){
        return undefined;
    }

    let defs = e.bitField.toValues().map( did => getByDefId(es,did) );

    return defs.reduce( async (e,def) => {
        const did = getDefId(def);
        // const cid = toComponentId(eid, did);
        let coms = await readComponents(es, def);
        let com = coms.find( com => com["@d"] === did && com["@e"] === eid );
        return addComponentUnsafe( await e,did,com);
    }, Promise.resolve(e) );
    
}

export async function getEntities(es:EntitySetFS): Promise<EntityList> {
    es = await openEntitySet(es);
    let ents = await readEntityFile(es);
    let ids = ents.map( e => e[EntityT] );
    return createEntityList(ids);
}

/**
 * Removes a component. if it is the last entity on the component, the entity is also removed
 * @param es 
 * @param item 
 * @param options 
 */
export async function removeComponent(es: EntitySetFS, item: RemoveType, options: AddOptions = {}): Promise<EntitySetFS> {
    es = options.retain ? es : clearChanges(es) as EntitySetFS;
    let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
    if (cid === undefined) {
        return es;
    }
    es = markComponentRemove(es, cid) as EntitySetFS;

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
export async function removeEntity(es: EntitySetFS, item: (number | Entity), options: AddOptions = {}): Promise<EntitySetFS> {
    es = options.retain ? es : clearChanges(es) as EntitySetFS;
    let eid = isInteger(item) ? item as number : isEntity(item) ? getEntityId(item as Entity) : 0;
    // Log.debug('[removeEntity]', eid);
    if (eid === 0) {
        return es;
    }
    es = await markEntityComponentsRemove(es, eid);
    return await applyRemoveChanges(es);
}

export async function addComponents(es: EntitySetFS, components: Component[]): Promise<EntitySetFS> {
    // set a new (same) entity id on all orphaned components
    [es, components] = await assignEntityIds(es, components)

    // Log.debug('[addComponents]', components);

    // mark incoming components as either additions or updates
    es = await components.reduce( (pes, com) => {
        return pes.then( (es) => markComponentAdd(es, com));
    }, Promise.resolve(es));

    // gather the components that have been added or updated and apply
    const changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)

    return changedCids.reduce((pes, cid) => pes.then( es => applyUpdatedComponents(es, cid) ), Promise.resolve(es));

    // return es;
}

export function createComponent( registry:EntitySetFS, defId:(string|number|ComponentDef), attributes = {} ): Component {
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

async function applyUpdatedComponents(es: EntitySetFS, cid: ComponentId): Promise<EntitySetFS> {
    const [eid, did] = fromComponentId(cid);
    let ebf: BitField;

    [es, ebf] = await getOrAddEntityBitfield(es, eid);

    const isNew = findCS( es.entChanges, eid ) === ChangeSetOp.Add;

    // Log.debug('[applyUpdatedComponents]', eid, isNew, es.entChanges );

    // does the component already belong to this entity?
    if (ebf.get(did) === false) {
        let e = createEntityInstance(eid);
        e.bitField = ebf;
        e.bitField.set(did);
        
        e = await setEntity(es, e);

        return isNew ? es : markEntityUpdate(es as EntitySetFS, eid) as EntitySetFS;
    }

    return isNew ? es : markEntityUpdate(es, eid) as EntitySetFS;
}


async function applyRemoveChanges(es: EntitySetFS): Promise<EntitySetFS> {
    // applies any removal changes that have previously been marked
    const removedComs = getChanges(es.comChanges, ChangeSetOp.Remove);

    es = await removedComs.reduce((pes, cid) => pes.then( es => applyRemoveComponent(es, cid)), Promise.resolve(es));

    // Log.debug('[applyRemoveChanges]', es.entChanges );

    const removedEnts = getChanges(es.entChanges, ChangeSetOp.Remove);

    es = await removedEnts.reduce((pes, eid) => pes.then( es => applyRemoveEntity(es, eid)), Promise.resolve(es));

    return es;
}

async function applyRemoveComponent(es: EntitySetFS, cid: ComponentId): Promise<EntitySetFS> {
    let [eid, did] = fromComponentId(cid);

    let e = await _getEntity(es, eid);
    if( e === undefined ){
        throw new Error(`entity ${eid} not found`);
    }

    // remove the component id from the entity
    e.bitField.set(did, false);

    // remove component
    let def = getByDefId(es, did);
    let coms = await readComponents( es, def );

    coms = coms.filter( com => com["@e"] !== eid && com["@d"] !== did );

    writeComponentFile( es, def, coms );

    // const store = es.db.transaction(STORE_COMPONENTS, 'readwrite').objectStore(STORE_COMPONENTS);
    // await idbDelete(store, [eid,did] );

    // Log.debug('[applyRemoveComponent]', cid, ebf.count() );

    if (e.bitField.count() === 0) {
        return markEntityRemove(es, eid) as EntitySetFS;
    } else {
        e = await setEntity(es, e);
    }

    return es;
}

/**
 * Removes an entity from the store
 * @param es 
 * @param eid 
 */
async function applyRemoveEntity(es: EntitySetFS, eid: number): Promise<EntitySetFS> {
    let ents = await readEntityFile(es);
    ents = ents.filter( e => getEntityId(e) !== eid );
    await writeEntityFile(es, ents);
    return es;
    // const store = es.db.transaction(STORE_ENTITIES, 'readwrite').objectStore(STORE_ENTITIES);
    // return idbDelete(store, eid ).then( () => es );
}

export async function markComponentAdd(es: EntitySetFS, com: Component): Promise<EntitySetFS> {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId(com);
    const existing = await getComponent(es, cid);

    // Log.debug('[markComponentAdd]', cid, existing );

    if (existing !== undefined) {
        return Promise.resolve( markComponentUpdate(es as EntitySet, cid) as EntitySetFS );
    }

    // convert the keys
    let {'@e':eid, '@d':did, ...rest} = com;
    // let scom = {'_e':eid, '_d':did, ...rest};

    // es = await openEntitySet(es);
    let def = getByDefId(es, did);

    let coms = await readComponents(es, def);

    coms = [...coms, com];

    await writeComponentFile(es, def, coms);

    
    // Log.debug('[markComponentAdd]', scom);

    return { ...es, comChanges: addCS(es.comChanges, cid) };
}

async function markRemoveComponents(es: EntitySetFS, eid: number): Promise<EntitySetFS> {
    if (eid === 0) {
        return es;
    }

    let e = await _getEntity(es, eid);
    if( e === undefined ){
        return es;
    }

    // const ebf = es.entities.get(id);
    if (e.bitField.count() === 0) {
        return es;
    }

    const dids = e.bitField.toValues();

    for (let ii = 0; ii < dids.length; ii++) {
        es = markComponentRemove(es, toComponentId(eid, dids[ii])) as EntitySetFS;
    }

    return es;
}


async function markEntityComponentsRemove(es: EntitySetFS, eid: number): Promise<EntitySetFS> {
    // read entity from entity file
    let e = await _getEntity(es, eid);

    if( e === undefined ){
        return es;
    }

    let dids = e.bitField.toValues();

    return dids.reduce( (es,did) => markComponentRemove(es, toComponentId(eid,did)), es ) as EntitySetFS;

    // let defs = e.bitField.toValues().map( did => getByDefId(es,did) );

    // defs.forEach( async def => {
    //     let coms = await readComponents( es, def );

    // })

    // look up each did and remove from component file

    // readComponents(es, def);

    // const store = es.db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    // let result = await idbGetRange(store, IDBKeyRange.bound([eid,0], [eid,Number.MAX_SAFE_INTEGER] ) );

    // return result.reduce( (prev, {key}) => {
    //     return prev.then( es => {
    //         const [eid,did] = key as number[];
    //         return markComponentRemove(es, toComponentId(eid,did)) as EntitySetFS
    //     })
    // }, Promise.resolve(es) );

    // return ebf.toValues().reduce((es, did) =>
    //     markComponentRemove(es, toComponentId(eid, did)), es as EntitySet) as EntitySetFS;
}

/**
 * 
 * @param es 
 * @param eid 
 */
async function getOrAddEntityBitfield(es: EntitySetFS, eid: number): Promise<[EntitySetFS, BitField]> {
    // const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);

    let e = await _getEntity(es, eid);
    // let record = await idbGet(store, eid);
    if( e === undefined ){
        return [markEntityAdd(es,eid) as EntitySetFS, createBitfield()];
    }

    let ebf = createBitfield( e.bitField );

    return [es, ebf];
}


/**
 * Assigns entity ids to an array of components
 * 
 * @param es 
 * @param components 
 */
async function assignEntityIds(es: EntitySetFS, components: Component[]): Promise<[EntitySetFS, Component[]]> {
    let set;
    let eid;
    type Memo = [ EntitySetFS,Set<number>,number,Component[] ];
    const initial:Memo = [es, new Set(), 0, []];

    [es, set, eid, components] = await components.reduce( async (last, com) => {

        let [es, set, eid, components] = await last;

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
            [es, eid] = await createEntity(es);

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
    }, Promise.resolve<Memo>(initial) ) as Memo;

    // Log.debug('[assignEntityIds]', 'coms', components );

    return [es, components];
}


export async function createEntity(es: EntitySetFS): Promise<[EntitySetFS, number]> {
    es = await openEntitySet(es);

    let e = createEntityInstance();

    e = await setEntity( es, e );
    const eid = getEntityId(e);
    // Log.debug('[createEntity]', eid);

    es = markEntityAdd(es, eid ) as EntitySetFS;

    return [es, eid];
}

async function setEntity(es:EntitySetFS, e:Entity): Promise<Entity> {
    // let store = es.db.transaction(STORE_ENTITIES, 'readwrite').objectStore(STORE_ENTITIES);

    let eid = getEntityId(e);

    if( eid === 0 ){
        eid = buildFlake53();
    }
    // Log.debug('[setEntity]', eid);
    
    let ents = await readEntityFile(es);
    // Log.debug('[setEntity]', ents);

    ents = ents.filter( ee => ee[EntityT] !== eid );
    
    let se = createEntityInstance(eid, e.bitField);
    ents = [ se, ...ents ]

    await writeEntityFile(es, ents);
    
    // await idbPut( store, {bf}, eid );

    return setEntityId(e,eid);
}

async function _getEntity(es:EntitySetFS, eid:EntityId): Promise<Entity|undefined> {

    let ents = await readEntityFile(es);

    let result = ents.find( e => getEntityId(e) === eid );

    return result;
}



/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export async function getComponent(es: EntitySetFS, id: ComponentId | Component): Promise<Component> {
    let cid:ComponentId = isComponentId(id) ? id as ComponentId : getComponentId(id as Component);
    
    es = await openEntitySet(es);

    let [eid,did] = fromComponentId(cid);

    const def = getByDefId(es, did);

    let coms = await readComponents(es, def);

    return coms.find( com => com["@d"] === did && com["@e"] === eid );
    

    // // const store = es.db.transaction(STORE_COMPONENTS, 'readonly').objectStore(STORE_COMPONENTS);
    // // const idx = store.index('by_cid');

    
    // let result = await idbGetRange(store, IDBKeyRange.bound([eid,did], [eid,did]) );
    // // Log.debug('[getComponent]', eid, did, result);

    // if( result.length === 0 ){
    //     return undefined;
    // }

    // let {'_e':ceid, '_d':cdid, ...rest} = result[0].value;
    // let com = {'@e':ceid, '@d':cdid, ...rest};

    // return com;

    // return Promise.resolve(undefined); //es.components.get(cid);
}



async function readComponentDefs( es:EntitySetFS ): Promise<EntitySetFS>{
    const rows = await readComponents( es, defDef );
    
    const defs = rows.map( obj => {
        let def = createComponentDef(obj);
        return {...def, tblName:defNameToName(def) };
    });

    es.componentDefs = defs;
    
    es = updateComponentDefIndexes(es);

    return es;
}

function updateComponentDefIndexes(es:EntitySetFS):EntitySetFS{
    es.byUri = new Map<string, number>();
    es.byHash = new Map<number, number>();

    es.componentDefs.forEach( def => {
        es.byUri.set( def.uri, getDefId(def) );
        es.byHash.set( hashDef(def), getDefId(def) );
    })
    return es;
}


async function readComponents( es:EntitySetFS, def:ComponentDefFS ){
    const name = defNameToName(def);
    let rows = await readRawComponents(es, name );
    // Log.debug('[readComponents]', name, rows);
    return rows.map( obj => {
        let { eid, did, ...props } = obj;
        eid = parseInt(eid);
        did = parseInt(did);
        // Log.debug('[readComponents]', obj );
        let params = {...props, '@e':eid, '@d':did};// '@d':def[ComponentDefT] };
        return createComponentInstance(params);
    });
}


async function readRawComponents( es:EntitySetFS, name:string ): Promise<any[]>{
    es.db = await fsOpen( es.db );
    
    const data = await fsReadFile( es.db, name );
    // Log.debug('[readRawComponents]', name, data ? data.length : 0 );

    if( data == undefined ){
        return [];
    }

    let rows = data.split( es.lineSep ).filter(Boolean);
    
    // Log.debug('[readRawComponents]', name, data );

    let records = rows.map( row => row.split(es.separatorChar) );
    
    let header = records.shift();
    let objs = records.map( row => {
        return header.reduce( (obj,h,idx) => ({...obj, [h]: parseJSON(row[idx]) }), {});
    })
    return objs;
}

async function writeComponentDefs( es:EntitySetFS ):Promise<EntitySetFS>{
    // let def = createComponentDef( did, value );
    // let record = defToObject( def, false );
    // let hash = hashDef( def );
    const defs = es.componentDefs;

    es = updateComponentDefIndexes(es);

    let coms = defs.map( def => {
        let record = defToObject( def, false );
        let com:Component = { ...record, '@e':0, '@d': getDefId(def) };
        return com;
    })
    
    // let com:Component = { ...record, '@e':0, '@d':did };
    // Log.debug('[register]', com);
    await writeComponentFile( es, defDef, coms );

    return es;
}


async function writeComponentFile( es:EntitySetFS, def:ComponentDefFS, coms:Component[] = [] ) {
    // await ensureComponentFile(es, def);

    let [header, names] = buildDefHeader(es,def);

    let lines = [ header, ...coms.map( com => {
        let row:string[] = [ stringify(getComponentEntityId(com)), stringify(getComponentDefId(com)) ];
        row = names.reduce( (row, name) => ([...row, stringify(com[name]) ]), row);
        // Log.debug('[writeComponentFile]', row);
        return row.join(es.separatorChar);
    })];
    const name = defNameToName( def );
    // Log.debug('[writeComponentFile]', name, lines );

    await fsWriteFile(es.db, name, lines.join(es.lineSep) );
}

async function ensureEntityFile( es:EntitySetFS ){
    const name = 'entity';
    if( await fsExists(es.db, name) ){
        return true;
    }

    let data = ['eid', 'dids'].join(es.separatorChar) + es.lineSep;

    await fsWriteFile(es.db, name, data);

    return false;
}

async function writeEntityFile( es:EntitySetFS, ents:Entity[] ){
    let header = [ 'eid', 'dids' ];
    let name = 'entity';

    let records = ents.map( e => {
        if( isNaN( getEntityId(e) ) ){
            throw new Error(`illegal eid`);
        }
        return [ getEntityId(e), stringify( e.bitField.toValues() ) ]
    })

    let lines = [ header, ...records ];

    // Log.debug('[writeEntityFile]', name, lines );

    let data = lines.map( l => l.join(es.separatorChar) ).join(es.lineSep);

    await fsWriteFile(es.db, name, data);

    return es;
}

async function readEntityFile( es:EntitySetFS ): Promise<Entity[]>{
    // es.db = await fsOpen(es.db);
    let data = await fsReadFile( es.db, 'entity' );
    if( data === undefined ){
        return [];
    }

    let rows = data.split( es.lineSep ).filter(Boolean);
    // Log.debug('[readEntityFile]', rows );

    let records = rows.map( row => row.split(es.separatorChar) );
    
    let header = records.shift();
    return records.map( ([eid,dids]) => {
        const bf = new BitField( parseJSON( dids ) );
        return createEntityInstance( parseInt(eid), bf );
    })
}

async function ensureComponentDefFile( es:EntitySetFS, def:ComponentDefFS ): Promise<boolean> {
    const name = defNameToName(def);
    if( !await fsExists( es.db, name ) ){
        // Log.debug('[ensureComponentDefFile]', name );
    //if( !await ensureComponentFile(es, def) ){
        // write the def itself
        let record = defToObject( def, false );
        let hash = hashDef( def );
    
        // Log.debug('[register]', record);
    
        let com:Component = { ...record, '@e':0, '@d':1 };
        await writeComponentFile( es, defDef, [com] );
        // Log.debug('[ensureComponentDefFile]', 'done' );
        return false;
    }
    return true;
}

// async function ensureComponentFile( es:EntitySetFS, def:ComponentDefFS ): Promise<boolean> {
//     es.db = await fsOpen( es.db );
//     const name = defNameToName(def);
    
//     let [header] = buildDefHeader(es,def);

//     // Log.debug('[ensureComponentFile]', header );
//     if( await fsExists( es.db, name ) ){
//         return true;
//     }
//     await fsWriteFile(es.db, name, header );
//     return false;
// }

function buildDefHeader(es:EntitySetFS, def:ComponentDefFS): [ string, string[] ] {
    let headers = [ 'eid', 'did' ];
    let properties = def.properties || [];
    let names = properties.map( pr => pr.name );
    return [[...headers,...names].join(es.separatorChar), names];
}

function defNameToName( def:ComponentDef ):string {
    if( 'tblName' in def ){
        return def['tblName'];
    }
    return def.uri.split('/').join('_').substring(1);
}