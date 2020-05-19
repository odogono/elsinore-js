import { ComponentId, Component,
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
import { ComponentDef, 
    ComponentDefObj, 
    create as createComponentDef, 
    toObject as defToObject,
    hash as hashDef, 
    isComponentDef,
    Type as ComponentDefT} from '../component_def';
import { getByUri, getByHash, getByDefId } from "../entity_set/registry";
import { EntitySet, 
    CreateEntitySetParams, 
    markEntityAdd, 
    markComponentUpdate, 
    markEntityUpdate, 
    AddType, AddOptions, 
    clearChanges, 
    markEntityRemove, 
    markComponentRemove, 
    assignEntityIds,
    RemoveType } from "../entity_set";
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
import { ChangeSet,
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
import { SqlRef, 
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
export { getByHash, getByUri } from '../entity_set/registry';

const Log = createLog('EntitySetSQL');

/**
 * As a storage backed ES, this entityset has functions
 * as a ComponentRegistry
 */
export interface EntitySetSQL extends EntitySet {
    
    // keep a reference to the open es db
    db?: SqlRef;

    isMemory: boolean;

    debug: boolean;

    // records entity changes from the last op
    entChanges: ChangeSet<number>;
    
    // records component changes from the last op
    comChanges: ChangeSet<ComponentId>;

    // cached component defs
    componentDefs: ComponentDefSQL[];
    byUri: Map<string, number>;
    byHash: Map<number, number>;
}

export interface ComponentDefSQL extends ComponentDef {
    tblName?: string;
    hash?: number;
}

export interface CreateEntitySetSQLParams extends CreateEntitySetParams {
    // name: string;
    isMemory?: boolean;
    clearDb?: boolean;
    debug?: boolean;
}

export function create(options?:CreateEntitySetSQLParams):EntitySetSQL {
    const uuid = options.uuid || createUUID();
    const isMemory = options.isMemory ?? true;
    const debug = options.debug ?? false;
    
    const entChanges = createChangeSet<number>();
    const comChanges = createChangeSet<ComponentId>();
    const entUpdates = new Map<number,BitField>();
    const comUpdates = new Map<ComponentId,any>();

    // Log.debug('[create]');
    return {
        type: 'sql',
        isEntitySet:true,
        isAsync: false,
        db: undefined,
        isMemory,
        debug,
        uuid, 
        entChanges, comChanges,
        entUpdates, comUpdates,
        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),

        esAdd: add,
        esRegister: register,
        esGetComponent: getComponent,
        esGetComponentDefs: (es:EntitySetSQL) => getComponentDefs(es),
        esEntities: (es:EntitySetSQL) => getEntities(es),
        esGetEntity: (es:EntitySetSQL, eid:EntityId) => Promise.resolve(getEntity(es,eid)),
        esSelect: select,
        esClone: clone,
        esSize: (es) => Promise.resolve(size(es)),
    }
}

async function clone(es:EntitySetSQL):Promise<EntitySetSQL>{
    return {
        ...es
    };
}


/**
 * Registers a new ComponentDef in the entityset
 * @param es 
 * @param value 
 */
export function register( es: EntitySetSQL, value:ComponentDef|ComponentDefObj|any ): [EntitySetSQL, ComponentDef] {
    es = openEntitySet(es);    
    let def = createComponentDef( 0, value );


    // insert the def into the def tbl
    def = sqlInsertDef( es.db, def );

    // Log.debug('[register]', def);

    const did = def[ComponentDefT];
    const {hash,tblName} = (def as ComponentDefSQL);

    es.componentDefs[did-1] = def;
    es.byUri.set( def.uri, did );
    es.byHash.set( hash, did );

    return [es, def];
}

export function getComponentDefs( es:EntitySetSQL ): ComponentDef[] {
    es = openEntitySet(es);
    return sqlRetrieveDefs(es.db);
}


export function size(es:EntitySetSQL): number {
    es = openEntitySet(es);
    return sqlCount(es.db);
    // const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);
    // return idbCount(store);
}

// export function getByUri( es:EntitySetSQL, uri:string ) {
//     es = openEntitySet(es);
//     let def = sqlRetrieveDefByUri(es.db, uri);
//     return def;
// }

// export function getByHash( es:EntitySetSQL, id:number ) {
//     es = openEntitySet(es);
//     let def = sqlRetrieveDefByHash(es.db, id);
//     return def;
// }

export function add(es: EntitySetSQL, item: AddType, options: AddOptions = {}): EntitySetSQL {
    es = openEntitySet(es);
    es = options.retain ? es : clearChanges(es as EntitySet) as EntitySetSQL;

    if (Array.isArray(item)) {
        // sort the incoming items into entities and components
        let [ents, coms] = (item as any[]).reduce(([ents, coms], item) => {
            if (isComponentLike(item)) {
                coms.push(item);
            } else if (isEntity(item)) {
                ents.push(item);
            }
            return [ents, coms];
        }, [[], []]);

        // Log.debug('[add]', ents)

        // add components from entity
        es = ents.reduce((pes, e) => {
            let coms = getEntityComponents(e);
            // Log.debug('[add]', '🐦coms from e', getEntityId(e), coms.length);
            return addComponents(pes, coms );
        }, es);
        
        // adds lone components
        es = addComponents(es, coms);

        es = applyRemoveChanges(es)
    }
    else if (isComponentLike(item)) {
        es = addComponents(es, [item as Component]);
    }
    else if (isEntity(item)) {
        let e = item as Entity
        es = markRemoveComponents(es, e[EntityT]);
        es = addComponents(es, getEntityComponents(e));
    }

    es = applyRemoveChanges(es)

    return es;
}


export function removeComponent(es: EntitySetSQL, item: RemoveType, options: AddOptions = {}): EntitySetSQL {
    es = options.retain ? es : clearChanges(es) as EntitySetSQL;
    let cid = isComponentId(item) ? item as ComponentId : isComponent(item) ? getComponentId(item as Component) : undefined;
    if (cid === undefined) {
        return es;
    }
    es = markComponentRemove(es, cid) as EntitySetSQL;

    // Log.debug('[removeComponent]', es );
    return applyRemoveChanges(es);
}

export function removeEntity(es: EntitySetSQL, item: (number | Entity), options: AddOptions = {}): EntitySetSQL {
    es = options.retain ? es : clearChanges(es) as EntitySetSQL;
    let eid = isInteger(item) ? item as number : isEntity(item) ? getEntityId(item as Entity) : 0;
    if (eid === 0) {
        return es;
    }
    es = markEntityComponentsRemove(es, eid);
    return applyRemoveChanges(es);
}

export function createComponent( registry:EntitySetSQL, defId:(string|number|ComponentDef), attributes = {} ): Component {
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


export function markComponentAdd(es: EntitySetSQL, com: Component): EntitySetSQL {
    // adds the component to the entityset if it is unknown,
    // otherwise marks as an update
    const cid = getComponentId(com);
    const [eid,did] = fromComponentId(cid);
    const existing = sqlComponentExists(es.db, eid, did);// getComponent(es, cid);

    // Log.debug('[markComponentAdd]', cid, existing );

    const def = getByDefId(es, did) as ComponentDefSQL;
    
    // Log.debug('[markComponentAdd]', com );

    sqlUpdateComponent( es.db, com, def );

    if (existing) {
        return markComponentUpdate(es as EntitySet, cid) as EntitySetSQL;
    }

    return { ...es, comChanges: addCS(es.comChanges, cid) };
}

export function markEntityComponentsRemove(es: EntitySetSQL, eid: number): EntitySetSQL {
    const e = getEntity(es, eid, false);
    if (e === undefined) {
        return es;
    }

    return bfToValues(e.bitField).reduce((es, did) =>
        markComponentRemove(es, toComponentId(eid, did)), es as EntitySet) as EntitySetSQL;
}

function markRemoveComponents(es: EntitySetSQL, eid: number): EntitySetSQL {
    if (eid === 0) {
        return es;
    }

    const {db} = es;

    let e = _getEntity(es, eid);
    if( e === undefined ){
        return es;
    }

    // const ebf = es.entities.get(id);
    if (bfCount(e.bitField) === 0) {
        return es;
    }

    const dids = bfToValues(e.bitField);

    for (let ii = 0; ii < dids.length; ii++) {
        es = markComponentRemove(es, toComponentId(eid, dids[ii])) as EntitySetSQL;
    }

    return es;
}

export function addComponents( es: EntitySetSQL, components: Component[]): EntitySetSQL {
    // set a new (same) entity id on all orphaned components
    [es, components] = assignEntityIds(es, components)


    
    // let changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)
    // Log.debug('[addComponents]', 'pre', changedCids);
    
    // to keep track of changes only in this function, we must temporarily replace
    let changes = es.comChanges;
    es.comChanges = createChangeSet<ComponentId>();

    // mark incoming components as either additions or updates
    for( const com of components ){
        es = markComponentAdd(es,com);
    }
    // es = components.reduce( (es, com) => markComponentAdd(es, com), es);
    
    // gather the components that have been added or updated and apply
    let changedCids = getChanges(es.comChanges, ChangeSetOp.Add | ChangeSetOp.Update)
    // Log.debug('[addComponents]', 'post', changedCids);

    // combine the new changes with the existing
    es.comChanges = mergeCS( changes, es.comChanges );

    // return changedCids.reduce((es, cid) => applyUpdatedComponents(es, cid), es);
    for( const cid of changedCids ){
        es = applyUpdatedComponents(es,cid);
    }
    return es;
}


function applyRemoveChanges(es: EntitySetSQL): EntitySetSQL {
    // Log.debug('[applyRemoveChanges]', es.comChanges );
    // applies any removal changes that have previously been marked
    const removedComs = getChanges(es.comChanges, ChangeSetOp.Remove);

    es = removedComs.reduce((es, cid) => applyRemoveComponent(es, cid), es);

    // Log.debug('[applyRemoveChanges]', es.entChanges );

    const removedEnts = getChanges(es.entChanges, ChangeSetOp.Remove);

    es = removedEnts.reduce((es, eid) => applyRemoveEntity(es, eid), es);

    return es;
}

function applyRemoveComponent(es: EntitySetSQL, cid: ComponentId): EntitySetSQL {
    let [eid, did] = fromComponentId(cid);

    const def = getByDefId( es, did );
    // remove component
    // Log.debug('[applyRemoveComponent]', eid, did );
    let e = sqlDeleteComponent( es.db, eid, def );

    if (bfCount(e.bitField) === 0) {
        return markEntityRemove(es, eid) as EntitySetSQL;
    } else {
        // e = setEntity(es, e);
    }

    return es;
}

/**
 * Removes an entity from the store
 * @param es 
 * @param eid 
 */
function applyRemoveEntity(es: EntitySetSQL, eid: number): EntitySetSQL {
    sqlDeleteEntity( es.db, eid );
    return es;
}


function applyUpdatedComponents(es: EntitySetSQL, cid: ComponentId): EntitySetSQL {
    const [eid, did] = fromComponentId(cid);
    let ebf: BitField;

    [es, ebf] = getOrAddEntityBitfield(es, eid);

    const isNew = findCS( es.entChanges, eid ) === ChangeSetOp.Add;

    // Log.debug('[applyUpdatedComponents]', eid, isNew, ebf.get(did) === false );

    // does the component already belong to this entity?
    if (bfGet(ebf,did) === false) {
        let e = createEntityInstance(eid);
        e.bitField = bfSet(ebf,did);
        
        e = setEntity(es, e);

        return isNew ? es : markEntityUpdate(es as EntitySetSQL, eid) as EntitySetSQL;
    }

    return isNew ? es : markEntityUpdate(es, eid) as EntitySetSQL;
}

/**
 * 
 * @param es 
 * @param eid 
 */
function getOrAddEntityBitfield(es: EntitySetSQL, eid: number): [EntitySetSQL, BitField] {
    // const store = es.db.transaction(STORE_ENTITIES, 'readonly').objectStore(STORE_ENTITIES);

    let e = sqlRetrieveEntity(es.db, eid);

    // Log.debug('[getOrAddEntityBitfield]', eid, e );
    // let record = await idbGet(store, eid);
    if( e === undefined ){
        // e = createEntityInstance(eid, createBitfield() );
        // e = setEntity( es, e );
        
        return [markEntityAdd(es,eid) as EntitySetSQL, createBitField() ];
    }

    // let ebf = createBitField( record.bf );

    return [es, e.bitField];
}


/**
 * Returns a Component by its id
 * @param es 
 * @param id 
 */
export function getComponent(es: EntitySetSQL, id: ComponentId | Component): Component {
    let cid:ComponentId = isComponentId(id) ? id as ComponentId : getComponentId(id as Component);
    
    es = openEntitySet(es);

    let [eid,did] = fromComponentId(cid);
    const def = getByDefId(es, did);
    let com = sqlRetrieveComponent( es.db, eid, def );

    return com;
}



function setEntity(es:EntitySetSQL, e:Entity): Entity {  
    // Log.debug('[setEntity]', e);  
    return sqlUpdateEntity(es.db, e);
}

function _getEntity(es:EntitySetSQL, eid:EntityId): Entity {
    return sqlRetrieveEntity(es.db, eid);
}

export function createEntity(es: EntitySetSQL): [EntitySetSQL, number] {
    es = openEntitySet(es);

    let e = createEntityInstance();

    e = setEntity( es, e );
    const eid = getEntityId(e);
    // Log.debug('[createEntity]', es);

    es = markEntityAdd(es, eid ) as EntitySetSQL;

    return [es, eid];
}

/**
 * Returns an entity instance with components
 * 
 * @param es 
 * @param eid 
 */
export function getEntity(es:EntitySetSQL, eid:EntityId, populate:boolean = true): Entity {
    es = openEntitySet(es);
    let e = _getEntity(es, eid);
    if( e === undefined ){
        return undefined;
    }

    if( !populate ){
        return e;
    }

    let dids = bfToValues(e.bitField);
    let defs = dids.map( did => getByDefId(es,did) );

    let coms = sqlRetrieveEntityComponents( es.db, eid, defs );

    // Log.debug('[getEntity]', coms );
    e = coms.reduce( (e,com) => {
        const did = getComponentDefId(com);
        return addComponentUnsafe(e,did,com);
    }, e);

    return e;
}

export async function getEntities(es:EntitySetSQL): Promise<EntityList> {
    es = openEntitySet(es);

    let eids = sqlGetEntities( es.db );

    return Promise.resolve( createEntityList(eids) );
}

interface OpenEntitySetOptions {
    readDefs?: boolean;
    isMemory?: boolean;
    clearDb?: boolean;
}

function openEntitySet( es:EntitySetSQL, options:OpenEntitySetOptions = {} ): EntitySetSQL{
    if( sqlIsOpen(es.db) ){
        return es;
    }
    const readDefs = options.readDefs ?? true;
    const {isMemory} = es;
    const verbose = es.debug ? console.log : undefined;
    
    es.db = sqlOpen(es.uuid, {...options, isMemory, verbose});

    // read component defs into local cache
    
    return es;
}

function closeEntitySet( es:EntitySetSQL ){

}

