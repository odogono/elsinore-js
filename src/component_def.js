import _ from 'underscore';
import Backbone from 'backbone';

import Model from './model';
import * as Utils from './util'

const ComponentDef = Model.extend({
    type: 'ComponentDef',
    isComponentDef: true,

    getUri: function(){
        return this.get('uri');
    },
    
    getName: function(){
        return this.get('name');
    },

    getAttrs: function(){ 
        return this.get('attrs');
    },

    getProperties: function(){
        return this.get('properties');
    },

    toJSON: function(){
        let result = Model.prototype.toJSON.apply(this, arguments);
        return _.omit( result, 'attrs');
    },

    hash: function( asString=true ){
        let result;// = this.get('hash');
        // if( !result ){
        // 
        // console.log(this);
            result = Utils.hash(JSON.stringify(this.getProperties()) + ":" + this.getName(), asString );
        // console.log('hash', JSON.stringify(this.getProperties()) + ":" + this.getName(), result )
        // }
        return result;
    },
})


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

    return Utils.toPascalCase( name + suffix );
}

ComponentDef.isComponentDef = function( cdef ){
    return cdef && cdef.isComponentDef;
};


ComponentDef.create = function( attrs ){
    attrs.attrs = createAttrsFromProperties( attrs.properties );

    if( !attrs.name ){
        attrs.name = componentNameFromUri( attrs.uri );
    }

    let result = new ComponentDef( attrs );

    return result;
}


export default ComponentDef;