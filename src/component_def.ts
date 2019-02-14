import { Base, BaseOptions } from './base';

import { componentNameFromUri } from './util/name_from_uri';
import { hash } from './util/hash';
import { isObject } from './util/is';
import { stringify } from './util/stringify';
// import { createLog } from './util/log';

// const Log = createLog('ComponentDef', false);


interface ComponentDefOptions extends BaseOptions {

}

export interface ComponentDefAttrs {
    id?: number;
    uri?: string;
    name?: string;
    type? : string;
    componentType? : string;
    properties?: any;
    options?: any;
}


function processOptions( attrs:ComponentDefAttrs={}, options:ComponentDefOptions={} ) : ComponentDefOptions {
    if( attrs.id !== undefined ){
        options.id = attrs.id;
    }

    return options;
}


export class ComponentDef extends Base {
    
    readonly type:string = 'ComponentDef';

    readonly isComponentDef:boolean = true;

    uri: string;

    name: string;

    properties;

    attrs;

    options:ComponentDefOptions;

    componentType;

    
    constructor(attrs:ComponentDefAttrs = {}, options:ComponentDefOptions = {}) {
        super( processOptions(attrs,options) );
        
        this.properties = attrs.properties;
        this.attrs = createAttrsFromProperties(this.properties);
        this.uri = attrs.uri;
        this.name = attrs.name || componentNameFromUri(this.uri);
        this.componentType = attrs.type || attrs.componentType;
        this.options = attrs.options || options;
    }

    getUri() : string {
        return this.uri;
    }

    getName() : string {
        return this.name;
    }

    getType() {
        return this.componentType;
    }

    getAttrs() : ComponentDefAttrs {
        return this.attrs;
    }

    getProperties() : any {
        return this.properties;
    }

    toJSON(...args) : ComponentDefAttrs {
        let result:ComponentDefAttrs = { id: this.id, name: this.name, uri: this.uri }; //  //Model.prototype.toJSON.apply(this, args);
        if (this.properties !== undefined) {
            result.properties = this.properties;
        }
        // delete result.attrs;
        return result;
    }

    hash() : number {
        return <number>hash(stringify(this.getProperties()) + ':' + this.getName(), false);
    }
}


/**
 *
 * @param {*} props
 */
function createAttrsFromProperties(props) {
    let name, property, value;
    let result = {};
    if (!props) {
        return result;
    }

    for (name in props) {
        value = props[name];
        property = value;
        if (isObject(value)) {
            if (value.default !== void 0) {
                value = property.default;
            } else if (value.type !== void 0) {
                switch (value.type) {
                    case 'integer':
                        value = 0;
                        break;
                    case 'string':
                        value = '';
                        break;
                    case 'boolean':
                        value = false;
                        break;
                    default:
                        value = null;
                        break;
                }
            }
        }
        result[name] = value;
    }

    return result;
}
