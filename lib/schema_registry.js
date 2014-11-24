var _ = require('underscore');
var Backbone = require('backbone');
var Jsonpointer = require('jsonpointer');

var Utils = require('./utils');

// 
// With some 'inspiration' taken from https://github.com/natesilva/jayschema/blob/master/lib/schemaRegistry.js
// 

var SchemaRegistry = function(){
    // map of latest schema-ids -> schemas
    this.schemasByUri = {};
    // map of hash -> schema
    this.schemasByHash = {};
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
        var subObjs;
        var uri;
        var result;
        
        options || (options={});

        // if( options.returnSchemas ){
            result = [];
        // }

        // extracts an array with every object with an id from the passed argument 
        objs = findObjectsWithId( schema );

        for( i=0,len=objs.length;i<len;i++ ){

            entry = objs[i];
            obj = entry.obj;
            uri = entry.uri;
            hash = entry.hash;

            // if the particular schema id already exists, then keep original
            if( this.schemasByHash[hash] ){
                throw new Error('schema ' + uri + ' already exists' );
            }

            // clone the object
            entry = Utils.deepExtend( {}, entry );
            
            // add to schemas
            this.schemasByUri[ uri ] = entry;

            // // add to versioned schemas
            // versioned = this.versions[ uri ] || {};
            // versioned[ hash ] = entry;
            // this.versions[ uri ] = versioned;

            // add to hash -> schema
            this.schemasByHash[ hash ] = entry;

            this.trigger('schema:add', uri, hash, obj );
        }

        // examine and decompose object refs for each found schema
        for( i=0,len=objs.length;i<len;i++ ){
            entry = objs[i];

            subObjs = replaceSubObjects( this.schemasByUri, entry.obj, entry.uri );
            
            // if( result ){
                result.push( subObjs );
            // }

            if( subObjs.hash === entry.hash )
                continue;

            // entry was replaced, so remove
            delete this.schemasByHash[ entry.hash ];
            delete this.schemasByUri[ entry.uri ];
            this.schemasByHash[ subObjs.hash ] = subObjs;
            this.schemasByUri[ subObjs.uri ] = subObjs;
        }

        return result;
    },


    unregister: function( schemaId, schemaHash, options ){

    },

    /**
    *
    */
    get: function( schemaId, schemaHash, options ){
        var result;
        var uri;
        var pointer;
        var isRootSchema = true;

        // resolve any references so that the result contains
        // a full tree
        var resolveRefs = true;

        // return a full record, including the schema hash and
        // other meta-info
        var returnFull;

        if( _.isObject(schemaHash) ){
            options = schemaHash;
            schemaHash = undefined;
        }

        if( options ){
            returnFull = options.full;
            resolveRefs = _.isUndefined(options.resolve) ? true : options.resolve;
        }

        schemaId = Utils.normalizeUri( schemaId );

        // atempt to return by hash,,,
        result = this.schemasByHash[schemaId];

        if( !result && schemaHash ){
            result = this.schemasByHash[schemaHash];
        }

        if( !result ){
            result = this.schemasByUri[schemaId];
        }

        if( !result && _.isString(schemaId) ){
            uri = Utils.parseUri( schemaId );
            
            // log.debug('parsed ' + schemaId );
            // printIns( uri );
            result = this.schemasByUri[ uri.baseUri ];
            
            if( !result )
                return null;

            result = result.obj;

            isRootSchema = false;

            if( uri.fragment ){
                pointer = uri.fragment;
                if( pointer.slice(0, 1) !== '/' )
                    pointer = '/' + pointer;
                try {
                    result = Jsonpointer.get(result, pointer);
                } catch(e){
                    return null;
                }
            }
        }

        if( !result ){
            return null;
        }

        if( resolveRefs ){
            result = resolveSchemaRefs( result, this.schemasByUri );
        }

        if( isRootSchema && !returnFull ){
            return result.obj;
        }

        return result;
    },


    /**
    *   Returns the hash of a given schema
    */
    getHash: function( schemaId, schemaHash, options ){
        var schema;

        options = _.extend({}, options, {full:true});

        schema = this.get(schemaId, schemaHash, options );

        return schema.hash;
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

        schema = this.get( schemaId, null, {resolve:false} );

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
            // printVar( schema );
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
        var i;
        var property;
        var def
        var properties;
        var includeNullProperties;
        var result = {};

        options || (options={});

        includeNullProperties = options.includeNull;
        properties = this.getProperties( schemaId, options );

        for( i in properties ){
            property = properties[i];
            def = property['default'];
            if( def || includeNullProperties )
                result[ property.name ] = def || null;
        }

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
            // log.debug('ah good ' + JSON.stringify(propertySchema));
            if( propertySchema ){
                property = _.extend( {}, _.omit(property,'$ref'), propertySchema );
            }
        }

        return property;
    },

});


function replaceSubObjects( schemas, obj, rootUri ){
    // var result = [];
    var objects = [];
    var current = obj;
    var i, len, keys, prop, next;
    var resolveUri = '';
    var subUri;

    resolveUri = Utils.resolveUri( resolveUri, current.id );
    result = {obj:current, uri:resolveUri};

    do {
        if( _.has(current, 'id') && _.isString(current.id) ){
            resolveUri = Utils.resolveUri( resolveUri, current.id );
        }

        keys = _.keys(current);

        for (i = 0, len = keys.length; i !== len; ++i) {
            prop = current[keys[i]];
            if (_.isObject(prop) && !_.isEmpty(prop)) {
                // hash = SchemaRegistry.hashSchema( prop );
                
                if( _.has(prop,'id') && _.isString(prop.id) ){
                    subUri = Utils.resolveUri( resolveUri, prop.id );
                    // if( schemas[subUri] ){
                    //     console.log('  replace ' + subUri );
                    // }
                    current[ keys[i] ] = { '$ref': subUri };
                } else {
                    objects.push( {obj:prop, uri:resolveUri} );
                }
            }
        }

        if( next = (objects.pop()) ){
            resolveUri = next.uri;
            current = next.obj;
        }
    } while( next );

    // for( i=0, len = result.length; i !== len; ++i ){
    result.hash = SchemaRegistry.hashSchema( result.obj );
    // }

    return result;
}



/**
*   
*/
function findObjectsWithId( obj, resolveUri, replaceWithRef ){
    // find objects with an id and add them    
    var result = [];
    var objects = [];
    var current = obj;
    var i, len, keys, prop, next;
    var hash;
    var store;

    resolveUri = resolveUri || '';

    do {
        if( _.has(current, 'id') && _.isString(current.id) ){
            resolveUri = Utils.resolveUri( resolveUri, current.id );
            
            // store = _.omit( current, 'id' );
            
            store = current;
            store.id = resolveUri;

            hash = SchemaRegistry.hashSchema( store );
            result.push( {obj:store, uri:resolveUri, hash:hash} );
        }

        keys = _.keys(current);
        for (i = 0, len = keys.length; i !== len; ++i) {
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
*
*/
function resolveSchemaRefs( obj, schemasByUri, options ){
    var i, len;
    var key;
    var ref;
    var result = _.isArray(obj) ? [] : {};
    
    if( obj && obj['$ref'] ){
        ref = schemasByUri[ obj['$ref'] ];
        if( ref )
            ref = ref.obj;
        return resolveSchemaRefs( ref, schemasByUri, options );
    }

    for (key in obj) {
        if( !obj.hasOwnProperty(key) ){
            continue;
        }

        if( _.isArray(obj[key] ) ){
            result[key] = resolveSchemaRefs( obj[key], schemasByUri, options );
        }
        else if ( _.isObject(obj[key]) ) {
            // if( _.has(obj[key], '$ref') && _.isString(obj[key]['$ref']) ){
            //     ref = schemasByUri( obj[key]['$ref'] );
            //     if( ref )
            //         result[key] = resolveSchemaRefs( ref, schemasByUri, options );
            // } else {
                result[key] = resolveSchemaRefs( obj[key], schemasByUri, options );
            // }
        }
        else {
            result[key] = obj[key];
        }
        
    }
    
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