import Model from './model';

import {
    hash,
    isObject,
    stringify,
    toPascalCase,
} from './util';
import {createLog} from './util/log';

const Log = createLog('ComponentDef',false);

export default class ComponentDef extends Model {
    
    constructor(attrs,options){
        Log.debug('create', attrs);

        attrs.attrs = createAttrsFromProperties( attrs.properties );

        if( !attrs.name ){
            attrs.name = componentNameFromUri( attrs.uri );
        }

        Log.debug('create', attrs);
        super(attrs,options);
    }

    getUri(){
        return this.get('uri');
    }
    
    getName(){
        return this.get('name');
    }

    getAttrs(){ 
        return this.get('attrs');
    }

    getProperties(){
        return this.get('properties');
    }

    toJSON(...args){
        let result = Model.prototype.toJSON.apply(this, args);
        delete result.attrs;
        return result; //omit( result, 'attrs');
    }

    hash( asString=true ){
        let result;
        result = hash(stringify(this.getProperties()) + ":" + this.getName(), asString );
        return result;
    }
}


ComponentDef.prototype.type = 'ComponentDef';
ComponentDef.prototype.isComponentDef = true;


function createAttrsFromProperties( props ){
    let name, property, value;
    let result = {};
    if( !props ){
        return result;
    }

    for( name in props ){
        value = props[name];
        property = value;
        if( isObject(value) ){
            if( value.default !== void 0 ){
                value = property.default;
            }
            else if( value.type !== void 0 ){
                switch( value.type ){
                    case 'integer': value = 0; break;
                    case 'string': value = ''; break;
                    case 'boolean': value = false; break;
                    default: value = null; break;
                }
            }
        }
        result[name] = value;
    }

    return result;
}

/**
 * 
 */
function componentNameFromUri( schemaUri, suffix='' ){
    let name;
    // let schema = this.getSchema( schemaUri );

    // if( !schema ){
    //     throw new Error('unknown schema ' + schemaUri );
    // }

    // if( schema.obj.name ){
    //     name = schema.obj.name;
    // } else {
    name = schemaUri;
    name = name.split('/').pop();
    // }

    return toPascalCase( name + suffix );
}
