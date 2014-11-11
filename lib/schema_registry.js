var _ = require('underscore');
var Backbone = require('backbone');
// var URI = require('uri-js');
var jsonpointer = require('jsonpointer');

var Utils = require('./utils');

// 
// With some 'inspiration' taken from https://github.com/natesilva/jayschema/blob/master/lib/schemaRegistry.js
// 

var SchemaRegistry = function(){
    this.schemas = {};
};

SchemaRegistry.create = function create( options ){
    var result = new SchemaRegistry();
    return result;
}


_.extend(SchemaRegistry.prototype, Backbone.Events, {
    
    /**
    *
    */
    register: function( schema, options ){
        var i,len;
        schema = _.extend( {}, schema );
        schema.id = Utils.normalizeUri( schema.id );
        schema.hash = SchemaRegistry.hashSchema( schema );

        // console.log('registering obj ' + schema.id + ' hash ' + schema.hash );
        // print_ins( schema );
        var obj, objs = findObjectsWithId( schema, schema.id );

        for( i=0,len=objs.length;i<len;i++ ){
            obj = objs[i];
            // if the particular schema id already exists, then keep original
            if( this.schemas[obj.uri] ){
                var existingHash = this.schemas[obj.uri].hash;                
                throw new Error('schema ' + obj.uri + ' already exists ' + existingHash );
            }
            this.schemas[ obj.uri ] = obj.obj;
            this.trigger('schema:add', obj.obj);
        }

        return this;
    },

    /**
    *
    */
    get: function( schemaId ){
        var result;
        var uri;

        schemaId = Utils.normalizeUri( schemaId );
        if( this.schemas[schemaId] ){
            return this.schemas[schemaId];
        }
        
        // console.log( 'get ' + schemaId );
        uri = Utils.parseUri( schemaId );
        result = this.schemas[ uri.path ];

        // printIns( uri );
        // printIns( require('url').parse( schemaId ) );
        // console.log('retrieving ' + uri.path + ' ' + uri.fragment );

        if( uri.fragment ){
            var pointer = '/' + uri.fragment;
            // console.log('retrieving ' + pointer);
            try {
                result = jsonpointer.get(result, pointer);
            } catch(e){
                // log.debug('error finding ' + pointer + ' : ' + e );
                return null;
            }
        }

        return result;
    },


    /**
    *
    */
    getProperties: function( schemaId, options ){
        var self = this, result, prop, properties, schema;
        options || (options = {});
        
        if( _.isArray(schemaId) ){
            return Array.prototype.concat.apply( [], schemaId.map( function(s){
                return self.getProperties(s);
            }));
        }

        schema = this.get( schemaId );

        if( !schema ){
            return null;
        }

        result = [];
        properties = schema.properties;
        if( !properties ){
            return result;
        }

        var priorities = schema.propertyPriorities;

        // convert from property object into an array
        var keys = _.keys(properties);

        for (var i = 0, len = keys.length; i !== len; ++i) {
            name = keys[i];
            prop = properties[ name ];
            prop = _.extend({name:name}, prop);
            if( priorities && priorities[name] ){
                prop.priority = priorities[name];
            }
            result[i] = prop;
        }


        // process the allOf property if it exists - combine
        // the properties of referenced schemas into the result
        if( _.isArray(schema.allOf) ){
            var allOf = _.pluck( schema.allOf, '$ref' );
            var props = this.getProperties( allOf, {raw:true} );
            result = result.concat( props );
            priorities = true;
        }

        if( priorities ){
            result = result.sort( propertySort );
        }

        return result;
    },

    getPropertiesObject: function( schemaId, options ){
        var property, def, properties = this.getProperties( schemaId, options );
        var includeNullProperties = options ? !_.isUndefined( options.includeNull ) : false;
        var result = {};
        for( var i in properties ){
            property = properties[i];
            def = property['default'];
            if( def || includeNullProperties )
                result[ property.name ] = def || null;
        }
        // print_ins( result );
        return result;
    }

});


function findObjectsWithId( obj, resolveUri ){
    // find objects with an id and add them    
    var result = [];
    var objects = [];
    var current = obj;
    var keys, prop, next;

    do {
        if( _.has(current, 'id') && _.isString(current.id) ){
            resolveUri = Utils.resolveUri( resolveUri, current.id );
            result.push( {obj:current, uri:resolveUri} );
        }

        keys = _.keys(current);
        for (var i = 0, len = keys.length; i !== len; ++i) {
            prop = current[keys[i]];
            if (_.isObject(prop) && !_.isEmpty(prop)) {
                objects.push( {obj:prop, uri:resolveUri} );
            }
        }

        if( next = (objects.pop()) ){
            resolveUri = next.uri;
            current = next.obj;
        }
    } while( next );

    return result;
}


/**
 * Determines the sort order of two properties
 * 
 * @param  {[type]} a [description]
 * @param  {[type]} b [description]
 * @return {[type]}   [description]
 */
function propertySort(a,b){
    var ap = a.priority || 0;
    var bp = b.priority || 0;
    if( ap < bp ){ return 1; }
    if( ap > bp ){ return -1; }
    return 0;
}

// /**
//  * [ description]
//  * @param  {[type]} schema [description]
//  * @return {[type]}        [description]
//  */
// SchemaRegistry.titleFromSchema = function(schema){
//     var schemaId = _.isString(schema) ? schema : null;
//     schema = SchemaRegistry.getSchema(schema);
//     if( schema.title )
//         return schema.title;
//     var title = schema.id.split('/');
//     title.splice(0,2);
//     title = title.join('_');
//     // var title = schema.id.split('/').pop();
//     return title;
// };


// SchemaRegistry.schemaFromTitle = function(slug){
//     var schemaId = '/component/' + slug;
//     var schema = this.getSchema( schemaId );
//     if( schema )
//         return schema;
//     return null;
// };

SchemaRegistry.hashSchema = function( schema ){
    var schemaId = Utils.normalizeUri( schema.id );
    var result = JSON.stringify(schema);
    result = Utils.hash( result, true );
    return result;
}

    // /**
    //  * Takes a value and attempts to resolve it into
    //  * the type specified by the schema fragment
    //  * 
    //  * @param  {[type]} value  [description]
    //  * @param  {[type]} schema [description]
    //  * @return {[type]}        [description]
    //  */
    // SchemaRegistry.resolveProperty = function( data, schemaProperty ){
    //     if( !schemaProperty )
    //         return data;
    //     if( schemaProperty.type ){
    //         switch( schemaProperty.type ){
    //             case "string":
    //                 return data.toString();
    //             case "integer":
    //                 return parseInt(data,10);
    //             case "number":
    //                 return parseFloat(data);
    //             case "boolean":
    //                 switch( data.toLowerCase() ){
    //                     case "true": case "yes": case "1": return true;
    //                     case "false": case "no": case "0": case null: return false;
    //                     default: return Boolean(data);
    //                 }
    //                 break;
    //             case "object":
    //                 return JSON.parse(data);
    //                 break;
    //         }
    //     }
    //     if( schemaProperty["$ref"] ){
    //         return this.parse( data, {schemaId:schemaProperty["$ref"]} );
    //     }
    //     return data;
    // };

module.exports = SchemaRegistry;