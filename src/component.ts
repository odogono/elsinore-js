

export type ComponentProperties = Map<string, any>;

export const Type = Symbol.for('Component');
export const Token = Symbol.for('@c');
import { Token as EntityToken } from './entity';
import { Token as DefToken } from './component_def';


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


export function create(params:any):Component {
    const result = {
        [DefToken]: 0,
        [EntityToken]: 0,
        ...params,
    };

    // console.log('[Component][create]', toObject(result) );

    return result;
}

export function getComponentDefId( component:Component ): number {
    return component[DefToken];
}

export function getComponentEntityId( component:Component ): number {
    return component[EntityToken];
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