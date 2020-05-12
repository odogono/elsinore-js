import {hash as hashValue} from './util/hash';
import { isObject, isString, isFunction } from './util/is';
import { toCamelCase, toCapitalized } from './util/to';



export const Type = '@d'; 
export type ComponentDefId = number;

export enum PropertyType {
    String,
    Integer,
    Number,
    Boolean,
    Array,
    Binary,
    JSON, // also an object
    Entity,
    BitField,
};


export interface ComponentDef {
    [Type]: number;
    uri: string;
    name: string;
    properties: ComponentDefProperty[];
    additional: Map<string, any>;
}

export interface ComponentDefProperty {
    name: string;
    type: string;
    default: any;
    optional: boolean;
    additional: Map<string, any>
}

const propertyDefaults = {
    name: undefined,
    type: 'string',
    default: undefined,
    optional: false,
};


/**
 * 
 */
export function create( ...args:any[] ): ComponentDef {
    if( args.length === 0 ){

        throw new Error('invalid create params');
    }

    const first = args[0];
    let id = 0;
    let uri = '';
    let name = '';
    let properties = [];
    let params:any = {};

    // console.log('[create]', first, args );

    if( Number.isInteger(first) ){
        params.id = first;
    } else if( isObject(first) ){
        return createFromObj(first);
    }
    else if( isString(first) ){
        params.name = first;
    }

    let second = args[1];
    if( isString(second) ){
        params.uri = second;
    } else if( isObject(second) ){
        params = {...second, ...params };
    }

    let third = args[2];
    if( Array.isArray(third) || isString(third) ){
        params.properties = third;
    }
    else if( isObject(third) ){
        params = {...third, ...params };
    }
    // console.log('[create]', params );
    
    return createFromObj(params);
}


export function createFromObj({id, name, uri, properties, ...extra}): ComponentDef {

    // # use the provided or extract from the last part of the uri
    // name = name || uri |> String.split("/") |> List.last() |> Macro.camelize()

    if( '@d' in extra ){
        let {['@d']: did, ...res} = extra;
        id = extra['@d'];
        extra = res;
    }

    if( !name ){
        // console.log('[createFromObj]', 'creating name from', uri );
        let parts:string[] = uri.split('/').reverse();
        name = toCapitalized( toCamelCase( parts[0] ) );
    }

    if( isString(properties) || isObject(properties) ){
        properties = [ createProperty(properties) ];
    } else if( Array.isArray(properties) ){
        properties = properties.map( prop => createProperty(prop) );
    } else {
        // console.log('but what', properties );
        properties = [];
    }

    return {
        [Type]: id,
        uri,
        name,
        properties,
        additional: new Map<string, any>(),
    }
}

export function isComponentDef( value:any ):boolean {
    return isObject(value) && 'uri' in value && 'properties' in value;
}


/**
 * Returns a hashed number for the ComponentDef
 * 
 */
export function hash( def:ComponentDef ): number {
    return hashValue( JSON.stringify( toObject(def, false) ), false ) as number;
}

export function hashStr( def:ComponentDef ): string {
    return hashValue( JSON.stringify( toObject(def, false) ), true ) as string;
}

export function getDefId( def:ComponentDef ): number {
    return def[Type];
}

export function getProperty( def:ComponentDef, name:string ): ComponentDefProperty {
    return def.properties.find( p => p.name === name );
}


export interface ComponentDefObj {
    '@d'?: number;
    name?: string;
    uri: string;
    properties?: any[];
}

/**
 * Converts the ComponentDef into an object
 */
export function toObject( def:ComponentDef, includeId:boolean = true ): ComponentDefObj {
    let {[Type]:id, name, uri, properties } = def;

    let objProps:any[];

    if( properties ){
        objProps = properties.map( p => propertyToObject(p) );
    }

    let result:ComponentDefObj = { name, uri };
    if( includeId ){
        result['@d'] = id;
    }
    if( objProps?.length > 0 ){
        result = {...result, properties: objProps };
    }
    return result;
}

export function toShortObject( def:ComponentDef ) {
    // [ "/component/completed", [{"name":"isComplete", "type":"boolean", "default":false}] ]
    let obj = toObject(def, false);
    return [ obj.uri, obj.properties ];
}


/**
 * 
 * @param params 
 */
export function createProperty(params:any): ComponentDefProperty {
    let name = '';
    let additional = new Map<string,any>();
    let type = propertyDefaults.type;
    let defaultValue = propertyDefaults.default;
    let optional = propertyDefaults.optional;

    if( isString(params) ){
        name = params;
    } else if( isObject(params) ) {
        name = params.name || name;
        type = params.type || type;
        defaultValue = params.default !== undefined ? params.default : defaultValue;
        // console.log('but', name, params.default);
        
        for( let key of Object.keys(params) ){
            if( key === 'additional' ){
                continue;
            }
            if( key in propertyDefaults === false ){
                additional.set(key, params[key]);
            }
        }
    }

    return {
        name, type, 'default':defaultValue, optional, additional
    };
}

export function propertyToObject( prop:ComponentDefProperty ): object {
    let result = {};

    for( let key of Object.keys(propertyDefaults) ){
        if( propertyDefaults[key] == prop[key] || prop[key] === undefined ){
            continue;
        }
        result[key] = prop[key];
    }

    for (let [key,value] of prop.additional ) {
        result[key] = value;
    }

    // if( Object.keys(result).length === 1 ){
    //     return result[name];
    // }

    return result;
}
