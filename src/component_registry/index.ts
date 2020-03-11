import { ComponentDef, 
    Token as DefToken,
    create as createComponentDef,
    hash as hashComponentDef, 
    getDefId} from "../component_def";
import { createUUID } from "../util/uuid";
import { createLog } from "../util/log";
import { isString, isInteger } from "../util/is";
import { create as createComponentInstance, Component } from '../component';
import { BitField } from "odgn-bitfield";

export type ComponentDefs = Array<ComponentDef>;

const Log = createLog('ComponentRegistry');

export const Code = '@cr';
export const Type = Symbol.for(Code);

export interface ComponentRegistry {
    type: Symbol;

    uuid: string;

    componentDefs: ComponentDefs;

    byUri: Map<string, number>;

    byHash: Map<number, number>;
}

export function create(): ComponentRegistry {
    return {
        type: Type,
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
/**
 * Resolves an array of Def identifiers (uri,hash, or did) to ComponentDefs  
 * @param registry ComponentRegistry
 * @param dids array of def ids as strings or numbers 
 */
export function resolveComponentDefIds( registry:ComponentRegistry, dids:any[], options:ResolveComponentDefOptions = {} ): BitField | ComponentDef[] {
    const bf = new BitField();
    const asDef = options.asDef === true;

    if( !Array.isArray(dids) || dids.length === 0 ){
        return asDef ? [] : bf;
    }

    const defs = dids.map( did => {
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
    // console.log('[resolveComponentDefIds]', dids, defs, bf )

    return defs.reduce( (bf,def) => def === undefined ? bf : bf.set( getDefId(def) ), bf );
}


/**
 * Registers a Component definition
 * 
 * @param registry 
 * @param param1 
 */
export function register( registry:ComponentRegistry, {uri, properties} ): [ComponentRegistry, ComponentDef] {

    // Log.debug('[register]', uri, properties );

    let did = registry.componentDefs.length+1;

    let def = createComponentDef(did, {uri, properties});

    // Hash the def, and check whether we already have this
    let hash = hashComponentDef( def );

    const existing = getByHash(registry,hash);
    if( existing !== undefined ){
        throw new Error(`component definition already exists (${existing[DefToken]}/${existing.uri})`);
    }

    // seems legit, add it
    def = { ...def, [DefToken]: did };

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
        '@d': def[DefToken]
    };

    // Log.debug('[createComponent]', 'def', def[DefToken] );

    // create a component instance
    const component = createComponentInstance(params);

    return component;
}