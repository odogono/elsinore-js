import { ComponentDef, 
    Type as DefT,
    create as createComponentDef,
    hash as hashComponentDef, 
    getDefId,
    getProperty,
    ComponentDefObj} from "../component_def";
import { createUUID } from "../util/uuid";
import { createLog } from "../util/log";
import { isString, isInteger } from "../util/is";
import { create as createComponentInstance, Component } from '../component';
import { BitField } from "odgn-bitfield";

export type ComponentDefs = Array<ComponentDef>;

const Log = createLog('ComponentRegistry');

export const Type = '@cr';

export interface ComponentRegistry {
    isComponentRegistry: boolean;

    uuid: string;

    componentDefs: ComponentDefs;

    byUri: Map<string, number>;

    byHash: Map<number, number>;
}

export function create(): ComponentRegistry {
    return {
        isComponentRegistry: true,
        uuid: createUUID(),
        componentDefs: [],
        byUri: new Map<string, number>(),
        byHash: new Map<number, number>(),
    };
}

export function getByHash( registry, hash:number ): ComponentDef {
    const did = registry.byHash.get( hash );
    return did === undefined ? undefined : registry.componentDefs[did-1];
}
export function getByUri( registry, uri:string ): ComponentDef {
    const did = registry.byUri.get( uri );
    return did === undefined ? undefined : registry.componentDefs[did-1];
}

export function getByDefId( registry, defId:number ): ComponentDef {
    return registry.componentDefs[defId-1];
}

export function getComponentDefs( registry ): ComponentDef[] {
    return registry.componentDefs;
}


export interface ResolveComponentDefOptions {
    asDef?: boolean;
}

type ResolveComponentDefIdResult = [ Component, string ][] | [BitField, string][];

type ResolveDefIds = string | string[] | number | number[];

/**
 * Resolves an array of Def identifiers (uri,hash, or did) to ComponentDefs  
 * @param registry ComponentRegistry
 * @param dids array of def ids as strings or numbers 
 */
export function resolveComponentDefIds( registry:ComponentRegistry, dids:ResolveDefIds, options:ResolveComponentDefOptions = {} ): BitField | ComponentDef[] {
    const bf = new BitField();
    const asDef = options.asDef === true;

    if( !Array.isArray(dids) || dids.length === 0 ){
        return asDef ? [] : bf;
    }

    const defs:ComponentDef[] = (dids as []).map( did => {
        // Log.debug('[resolveComponentDefIds]', did );
        if( isString(did) ){
            return getByUri( registry, did );
        }
        else if( isInteger(did) ){
            return getByHash(registry,did) || registry.componentDefs[did-1];
        }
        return undefined;
    });

    if( asDef ){
        return defs;
    }

    return defs.reduce( (bf,def) => def === undefined ? bf : bf.set( getDefId(def) ), bf );
}

/**
 * 
 * @param registry 
 * @param did 
 */
export function resolveComponentDefAttribute( registry:ComponentRegistry, did:string ): [BitField, string] {

    let attrName:string;
    const isAttr = (did as string).indexOf('#') !== -1;
    if( isAttr ){
        [did,attrName] = (did as string).split('#');
    }

    // Log.debug('[resolveComponentDefAttribute]', did,attrName );
    
    const def = getByUri( registry, did );

    if( !def ){
        Log.debug('[resolveComponentDefAttribute]', 'def not found', did);
        return [new BitField(), undefined];
    }

    // Log.debug('[resolveComponentDefAttribute]', 'getting prop', def, attrName );

    const prop = getProperty( def, attrName );

    const bf = BitField.create([getDefId(def)])

    // console.log('[resolveComponentDefAttribute]', did, isAttr, attrName, def.properties );

    // Log.debug('[resolveComponentDefAttribute]', def, attrName );
    return [bf, prop ? attrName : undefined];
    
}


/**
 * Registers a Component definition
 * 
 * @param registry 
 * @param param1 
 */
export function register( registry:ComponentRegistry, value:ComponentDef|ComponentDefObj ): [ComponentRegistry, ComponentDef] {

    // Log.debug('[register]', uri, properties );

    let did = registry.componentDefs.length+1;

    let def = createComponentDef(did, value );

    // Hash the def, and check whether we already have this
    let hash = hashComponentDef( def );

    const existing = getByHash(registry,hash);
    if( existing !== undefined ){
        throw new Error(`component definition already exists (${existing[DefT]}/${existing.uri})`);
    }

    // seems legit, add it
    def = { ...def, [DefT]: did };

    let byHash = new Map<number, number>(registry.byHash);
    let byUri = new Map<string, number>(registry.byUri);
    byHash.set( hash, did );
    byUri.set( def.uri, did );

    registry = {
        ...registry,
        byHash,
        byUri,
        componentDefs: [...registry.componentDefs, def]
    };

    return [registry, def];
}


/**
 * 
 */
export function createComponent( registry:ComponentRegistry, defId:(string|number), attributes ): Component {
    let def:ComponentDef = undefined;

    // Log.debug('[createComponent]', defId, attributes, registry );
    if( isString(defId) ){
        def = getByUri(registry,  defId as string );
    } else if( isInteger(defId) ){
        def = getByHash(registry, defId as number) || registry.componentDefs[(defId as number)-1];
    }

    if( def === undefined ){
        // Log.debug('[createComponent]', registry.byUri.get( defId as string ), registry.componentDefs );
        throw new Error(`component def not found: ${defId}`);
    }

    let params = {
        ...attributes,
        '@d': def[DefT]
    };

    // Log.debug('[createComponent]', 'def', def[DefT] );

    // create a component instance
    const component = createComponentInstance(params);

    return component;
}