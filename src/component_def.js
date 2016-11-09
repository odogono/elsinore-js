/* @flow */

import _ from 'underscore';

import Model from './model';

import {
    hash,
    stringify,
    toPascalCase,
    createLog
} from './util';

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

    toJSON(){
        let result = Model.prototype.toJSON.apply(this, arguments);
        return _.omit( result, 'attrs');
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
        if( _.isObject(value) ){
            if( !_.isUndefined(value.default) ){
                value = property.default;
            }
            else if( !_.isUndefined(value.type) ){
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

function componentNameFromUri( schemaUri:string, suffix:string='' ){
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
