import { Token as EntityToken } from './entity';
import { Token as DefToken } from './component_def';
import { isObject, isString } from './util/is';


export type ComponentProperties = Map<string, any>;

export const Code = '@c';
export const Token = Symbol.for(Code);

// made up of entityId,defId
export type ComponentId = string; //[number, number];

export interface ComponentList {
    componentIds: ComponentId[];
}

export interface Component {
    [key: string]: any;
    [DefToken]: number;
    [EntityToken]: number;
    // props: Map<string, any>;
}

export interface ComponentObj {
    [key: string]: any;
    '@d': number;
    '@e': number;
}


export function create(params:object):Component {

    let result:any = { [DefToken]: 0, [EntityToken]:0 };
    for( let key of Object.keys(params) ){
        if( key === '@d' ){
            result[DefToken] = params['@d'];
        }
        else if( key === '@e' ){
            result[EntityToken] = params['@e'];
        }
        else {
            result[key] = params[key];
        }
    }

    // const result = {
    //     [DefToken]: 0,
    //     [EntityToken]: 0,
    //     ...params,
    // };

    // console.log('[Component][create]', toObject(result) );

    return result;
}

export function getComponentId( component:Component ): ComponentId {
    return JSON.stringify( [component[EntityToken], component[DefToken]] );
    // return [component[EntityToken], component[DefToken]].join(',');
}
export const toComponentId = ( eid:number, did:number ) => JSON.stringify([eid,did]);

export const isComponentId = (val:any) => isString(val);

export function fromComponentId( id:ComponentId ): [number,number] {
    return JSON.parse(id);
    // return id.split(',');
}

export function getComponentDefId( component:Component ): number {
    return component[DefToken];
}

export function getComponentEntityId( component:Component ): number {
    return component[EntityToken];
}

export function setEntityId( component:Component, entityId:number ): Component {
    return {
        ...component,
        [EntityToken]: entityId
    };
}

export function toObject( component:Component ): ComponentObj {
    let result = {
        '@d': component[DefToken],
        '@e': component[EntityToken]
    };
    for( let key of Object.keys(component) ){
        result[key] = component[key];
    }
    return result;
}

export function isComponent( item:any ): boolean {
    return isObject(item) && DefToken in item && EntityToken in item;
}

// export class Component {
    
//     constructor(defId: number, entityId: number = 0, properties:ComponentProperties = new Map<string, any>()){
//         this.defId = defId;
//         this.entityId = entityId;
//         this.properties = properties;
//     }


//     get(name:string):any {
//         return this.properties.get(name);
//     }
// }