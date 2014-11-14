var _ = require('underscore');
var Backbone = require('backbone');
var jsonpointer = require('jsonpointer');

var Utils = require('./utils');

// 
// With some 'inspiration' taken from https://github.com/natesilva/jayschema/blob/master/lib/schemaRegistry.js
// 

var SchemaRegistry = function(){
    // map of latest schema-ids -> schemas
    this.schemas = {};
    // map of schema-ids -> version -> schemas
    this.versions = {};
};

SchemaRegistry.create = function create( options ){
    var result = new SchemaRegistry();
    return result;
}


_.extend(SchemaRegistry.prototype, Backbone.Events, {
    
    /**
    * Registers schemas from the presented data
    */
    register: function( schema, options ){
        var i,len;
        var entry;
        var versioned;
        var hash;
        var obj;
        var objs;
        var uri;
        var result;
        
        options || (options={});

        if( options.returnSchemas ){
            result = [];
        }

        // schema = _.extend( {}, schema );
        // schema.id = Utils.normalizeUri( schema.id );
        
        // hash = schema.hash = SchemaRegistry.hashSchema( schema );

        // console.log('registering obj ' + schema.id + ' hash ' + schema.hash );
        // print_ins( schema );

        // extracts an array with every object with an id from the passed argument 
        objs = findObjectsWithId( schema );

        for( i=0,len=objs.length;i<len;i++ ){

            entry = objs[i];
            obj = entry.obj;
            uri = entry.uri;
            hash = entry.hash;
            // printIns( entry );
            // console.log('');
            // console.log('obj: ' + JSON.stringify(obj));
            // console.log('uri: ' + uri);
            // console.log('hash: ' + hash);
            
            // if the particular schema id already exists, then keep original
            if( this.versions[uri] && this.versions[uri][hash] ){
            // if( this.schemas[obj.uri] ){
                // var existingHash = this.schemas[obj.uri].hash;   
                throw new Error('schema ' + uri + ' already exists' );
            }

            // clone the object
            obj = Utils.deepExtend( {}, obj );
            // obj.hash = hash;

            this.schemas[ uri ] = obj;

            versioned = this.versions[ uri ] || {};
            versioned[ hash ] = obj;
            this.versions[ uri ] = versioned;

            if( result ){
                result.push( entry );
            }

            this.trigger('schema:add', uri, hash, obj );
        }
        return result || this;
    },

    /**
    *
    */
    get: function( schemaId, schemaHash ){
        var result;
        var uri;
        var pointer;

        schemaId = Utils.normalizeUri( schemaId );

        if( this.schemas[schemaId] ){
            if( schemaHash ){
                return this.versions[schemaId][schemaHash];
            }
            return this.schemas[schemaId];
        }
        
        // console.log('');
        // console.log( 'get ' + schemaId );
        
        uri = Utils.parseUri( schemaId );
        result = this.schemas[ uri.baseUri ];

        if( uri.fragment ){
            pointer = uri.fragment;

            if( pointer.slice(0, 1) !== '/' )
                pointer = '/' + pointer;

            // console.log('retrieving ' + pointer + ' from ' + schemaId );

            try {
                result = jsonpointer.get(result, pointer);
            } catch(e){
                // console.log('error finding ' + pointer + ' : ' + e );
                return null;
            }
        }

        return result;
    },


    /**
    *
    */
    getProperties: function( schemaId, options ){
        var i;
        var len;
        var priorities;
        var allOf;
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


        priorities = schema.propertyPriorities;

        // convert from property object into an array
        var keys = _.keys(properties);

        for (i = 0, len = keys.length; i !== len; ++i) {
            name = keys[i];
            
            prop = this.resolveProperty( schema, properties[ name ] );
            
            prop = _.extend({name:name}, prop);
            
            if( priorities && priorities[name] ){
                prop.priority = priorities[name];
            }
            result[i] = prop;
        }

        // process the allOf property if it exists - combine
        // the properties of referenced schemas into the result
        if( _.isArray(schema.allOf) ){

            allOf = _.pluck( schema.allOf, '$ref' );

            properties = this.getProperties( allOf, {raw:true} );
            
            result = result.concat( properties );
            
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
    },

    /**
    *
    */
    resolveProperty: function( schema, property, options ){
        var propertySchema;
        var ref;

        if( !property ){
            return property;
        }

        if( ref = property['$ref'] ){
            propertySchema = this.get( schema.id + ref );
            if( propertySchema ){
                property = _.extend( {}, _.omit(property,'$ref'), propertySchema );
            }
        }

        return property;
    },

});


function findObjectsWithId( obj, resolveUri ){
    // find objects with an id and add them    
    var result = [];
    var objects = [];
    var current = obj;
    var keys, prop, next;
    var hash;

    resolveUri = resolveUri || '';

    do {
        if( _.has(current, 'id') && _.isString(current.id) ){
            resolveUri = Utils.resolveUri( resolveUri, current.id );
            hash = SchemaRegistry.hashSchema( current );
            result.push( {obj:current, uri:resolveUri, hash:hash} );
        }

        keys = _.keys(current);
        for (var i = 0, len = keys.length; i !== len; ++i) {
            prop = current[keys[i]];
            if (_.isObject(prop) && !_.isEmpty(prop)) {
                // hash = SchemaRegistry.hashSchema( prop );
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