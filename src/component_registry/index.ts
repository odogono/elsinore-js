import { ComponentDef, 
    Token as DefToken,
    create as createComponentDef,
    hash as hashComponentDef } from "../component_def";
import { createUUID } from "../util/uuid";
import { createLog } from "../util/log";
import { isString, isInteger } from "../util/is";
import { create as createComponentInstance, Component } from '../component';

export type ComponentDefs = Array<ComponentDef>;

const Log = createLog('ComponentRegistry');

export const Code = '@cr';
export const Type = Symbol.for(Code);

export interface ComponentRegistry {
    type: Symbol;

    uuid: string;

    componentDefs: ComponentDefs;

    byUri: Map<string, ComponentDef>;

    byHash: Map<number, ComponentDef>;
}

export function create(): ComponentRegistry {
    return {
        type: Type,
        uuid: createUUID(),
        componentDefs: [],
        byUri: new Map<string, ComponentDef>(),
        byHash: new Map<number, ComponentDef>(),
    };
}

export function getByUri( registry, uri:string ): ComponentDef {
    return registry.byUri.get( uri );
}

export function getByDefId( registry, defId:number ): ComponentDef {
    return registry.componentDefs[defId];
}

export function getComponentDefs( registry ): ComponentDef[] {
    return registry.componentDefs;
}


/**
 * Registers a Component definition
 * 
 * @param registry 
 * @param param1 
 */
export function register( registry:ComponentRegistry, {uri, properties} ): [ComponentRegistry, ComponentDef] {

    // Log.debug('[register]', uri, properties );

    let id = registry.componentDefs.length;

    let def = createComponentDef(id, {uri, properties});

    // Hash the def, and check whether we already have this
    let hash = hashComponentDef( def );

    const existing = registry.byHash.get(hash);
    if( existing !== undefined ){
        throw new Error(`component definition already exists (${existing[DefToken]}/${existing.uri})`);
    }

    // seems legit, add it
    def = { ...def, [DefToken]: registry.componentDefs.length+1 };

    let byHash = new Map<number, ComponentDef>(registry.byHash);
    let byUri = new Map<string, ComponentDef>(registry.byUri);
    byHash.set( hash, def );
    byUri.set( def.uri, def );

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
        def = registry.byUri.get( defId as string );
    } else if( isInteger(defId) ){
        def = registry.componentDefs[defId];
    }

    if( def === undefined ){
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