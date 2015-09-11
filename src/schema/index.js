import _ from 'underscore';
import Backbone from 'backbone';
import Jsonpointer from 'jsonpointer';

import * as Utils from '../util'
import SchemaProperties from './properties';

// 
// With some inspiration from https://github.com/natesilva/jayschema/blob/master/lib/schemaRegistry.js
// 

function SchemaRegistry(){
    // map of latest schema-ids -> schemas
    this.schemasByUri = {};
    // map of hash -> schema
    this.schemasByHash = {};

    this.schemaCounter = 0;

    // an array of hashes - used to create an internal schema id
    this.schemaIds = [];
};

SchemaRegistry.isSchema = function( schema ){
    return schema && schema.isSchema;
}

SchemaRegistry.create = function create( options ){
    var result = new SchemaRegistry();
    return result;
}

// function Schema(){
// }

var Schema = {
    iid: null,
    uri: null,
    hash: null,
    obj: null,
    isSchema: true
};

Schema.create = function( obj, uri, hash ){
    var result = _.extend({}, Schema); //Object.create( Schema );
    obj = _.extend({},obj);
    if( obj.isSchema || obj.uri || obj.obj ){
        result.uri = obj.uri;
        result.hash = obj.hash;
        result.obj = obj.obj;
        result.iid = obj.iid;
    } else {
        result.obj = obj;
        result.uri = uri;
        result.hash = hash;
    }
    return result;
}


_.extend(SchemaRegistry.prototype, Backbone.Events, {
    
    /**
    * Registers schemas from the presented data
    */
    register: function( schema, options={} ){
        var ii,len;
        var entry;
        var versioned;
        var hash;
        var obj;
        var objs;
        var subObjs;
        var uri;
        var result;
        var throwOnExists;
        
        throwOnExists = _.isUndefined(options.throwOnExists) ? true : options.throwOnExists;

        // extracts an array with every object with an id from the passed argument 
        objs = findSchemas( schema );

        result = [];
        for( ii=0,len=objs.length;ii<len;ii++ ){
            entry = objs[ii];

            // if the particular schema id already exists, then keep original
            if( this.schemasByHash[entry.hash] ){
                if( throwOnExists ){
                    throw new Error('schema ' + entry.uri + ' (' + entry.hash + ') already exists' );
                } else {
                    continue;
                }
            }

            // clone the object
            entry = Utils.deepExtend( {}, entry );
            this._registerSchema( entry );
        }

        // examine and decompose object refs for each found schema
        for( ii=0,len=objs.length;ii<len;ii++ ){
            entry = objs[ii];

            subObjs = replaceSubObjects( this.schemasByUri, entry.obj, entry.uri );
            
            result.push( subObjs );

            if( subObjs.hash === entry.hash )
                continue;

            // entry was replaced, so remove
            this._unregisterSchema( entry, null, null, {silent:true} );
            this._registerSchema( subObjs );
        }

        // resolve to actual objects so we get the internal iid
        for( ii=0,len=result.length;ii<len;ii++ ){
            result[ii] = this.schemasByHash[ result[ii].hash ];
        }

        return result;
    },

    _registerSchema: function( schema, uri, hash, options ){
        // log.debug('_registerSchema ' + JSON.stringify(schema) + ' ' + schema.isSchema );
        schema = Schema.create( schema );
        // log.debug('_registerSchema ' + JSON.stringify(schema) + ' ' + schema.uri );
        schema.iid = ++this.schemaCounter;
        this.schemasByHash[ schema.hash ] = schema;
        this.schemasByUri[ schema.uri ] = schema;
        this.schemaIds[schema.iid] = schema.hash;

        // log.debug('added schema ' + schema.uri + ' as ' + schema.iid + '/' + schema.hash );
        this.trigger('schema:add', schema.uri, schema.hash, schema );
        return schema;
    },


    _unregisterSchema: function( schema, uri, hash, options ){
        delete this.schemasByHash[ hash || schema.hash ];
        delete this.schemasByUri[ uri || schema.uri ];
        this.schemaIds[ schema.iid ] = undefined;
        this.trigger('schema:remove', schema.uri, schema.hash, schema );
        return schema;
    },

    unregister: function( schemaUri, schemaHash, options ){

    },

    /**
    *   Converts incoming schema identifiers into an array of
    *   internal ids
    */
    getIId: function( schemaIdentifiers, forceArray ){
        var ii, len;
        var iid, uri, val;
        var args = _.flatten( _.toArray(arguments) );
        var result = [];
        forceArray = false;

        if( args[ args.length-1 ] === true ){
            forceArray = true;
            args.pop();
        }
        for( ii=0,len=args.length;ii<len;ii++ ){
            uri = args[ii];
            iid = undefined;
            if( (val = this.schemasByHash[uri]) ){
                iid = val.iid;
            } else if( (val = this.schemasByUri[uri]) ){
                iid = val.iid;
            } else if( (val = this.schemaIds[ uri ]) ){
                iid = uri;
            } else {
                throw new Error('could not find schema ' + uri );
            }
            result.push( iid );
        }

        if( result.length === 1 && !forceArray){
            return result[0];
        }
        if( result.length === 0 && !forceArray ){
            return undefined;
        }

        return result;
    },

    /**
    *   Returns a schema by uri/hash/iid
    */
    get: function( schemaUri, schemaHash, options ){
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

        if( Utils.isInteger(schemaUri) ){
            // log.debug('passed numeric schema id ' + schemaUri );
            // printIns( this, 1 );
            result = this.schemaIds[ schemaUri ];
            // log.debug('came back with ' + Utils.stringify(result) );
            // printIns( this.schemasByHash[result] );
            if( result ){
                result = this.schemasByHash[result];
                if( isRootSchema && !returnFull ){
                    return result.obj;
                }
                return result;
            }

        }

        schemaUri = Utils.normalizeUri( schemaUri );


        // atempt to return by hash,,,
        result = this.schemasByHash[schemaUri];

        if( !result && schemaHash ){
            result = this.schemasByHash[schemaHash];
        }

        if( !result ){
            result = this.schemasByUri[schemaUri];
        }

        if( !result && _.isString(schemaUri) ){
            uri = Utils.parseUri( schemaUri );
            
            // log.debug('parsed ' + schemaUri );
            // printIns( this.schemasByUri );
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

    getAll: function(){
        return _.map( this.schemasByHash, function(schema){
            return _.omit( schema, 'create', 'isSchema');
        });
    },


    /**
    *   Returns the hash of a given schema
    */
    getHash: function( schemaUri, schemaHash, options ){
        var schema;
        options = _.extend({}, options, {full:true});
        schema = this.get(schemaUri, schemaHash, options );
        return schema.hash;
    },

    
});


function replaceSubObjects( schemas, obj, rootUri ){
    // var result = [];
    var result;
    var objects = [];
    var current = obj;
    var i, len, keys, prop, next;
    var resolveUri = '';
    var subUri;

    resolveUri = Utils.resolveUri( resolveUri, current.id );
    result = Schema.create( current, resolveUri );// {obj:current, uri:resolveUri};

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
                    objects.push( Schema.create( prop, resolveUri ) );// {obj:prop, uri:resolveUri} );
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
*   Returns an array of objects within the given
*   object which are identifiable as schemas
*/
function findSchemas( obj, resolveUri, replaceWithRef ){
    var result = [];
    var objects = [];
    var current;
    var currentId;
    var i, len, keys, prop, next;
    var hash;
    var store;
    var schema;

    current = obj;
    resolveUri = resolveUri || '';

    currentId = current.id;

    do {
        if( currentId ) {// _.has(current, 'id') && _.isString(current.id) ){
            resolveUri = Utils.resolveUri( resolveUri, currentId );
            
            store = current;
            store.id = resolveUri;

            hash = SchemaRegistry.hashSchema( store );
            schema = Schema.create( store, resolveUri, hash );
            // log.debug('adding ' + JSON.stringify(schema) );
            result.push( schema );
            // result.push( {obj:store, uri:resolveUri, hash:hash} );
        }

        keys = _.keys(current);
        for (i = 0, len = keys.length; i !== len; ++i) {
            prop = current[ keys[i] ];
            if (_.isObject(prop) && !_.isEmpty(prop)) {
                // log.debug('adding ' + keys[i] + ' ' + JSON.stringify(prop) + ' - ' + resolveUri );
                if( _.has(prop,'id') && _.isString(prop.id) ){
                    currentId = prop.id;
                } else if( _.has( prop, 'properties') ){
                    currentId = '#' + keys[i];
                } else {
                    currentId = null;
                }
                // hash = SchemaRegistry.hashSchema( prop );
                objects.push( {obj:prop, uri:resolveUri, id:currentId} );
            }
        }

        if( next = (objects.pop()) ){
            resolveUri = next.uri;
            current = next.obj;
            currentId = next.id;
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


// /**
//  * [ description]
//  * @param  {[type]} schema [description]
//  * @return {[type]}        [description]
//  */
// SchemaRegistry.titleFromSchema = function(schema){
//     var schemaUri = _.isString(schema) ? schema : null;
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
//     var schemaUri = '/component/' + slug;
//     var schema = this.getSchema( schemaUri );
//     if( schema )
//         return schema;
//     return null;
// };




SchemaRegistry.hashSchema = function( schema ){
    var schemaUri = Utils.normalizeUri( schema.id );
    var result = JSON.stringify(schema);
    result = Utils.hash( result, true );
    return result;
}

module.exports = SchemaRegistry;