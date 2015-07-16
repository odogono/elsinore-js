'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var LevelUp = require('levelup');
// var Sublevel = require('level-sublevel');
var Path = require('path');
var PromiseQ = require('promise-queue');
var Sh = require('shelljs');

var Elsinore = require('../');
var LeveldbUtils = require('./utils');
var LU = require('./utils');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
let Query = Elsinore.Query;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;

var CmdBuffer = require('../cmd_buffer/async');



var SCHEMA_STORE = 'schema-store';
var META_STORE = 'meta-store';
var KEY_UUID = '_local_uuid';
var KEY_ENTITY_SET_ID = '_local_id';

var KEY_DELIMITER = LeveldbUtils.KEY_DELIMITER;
var KEY_START = LeveldbUtils.KEY_START;
var KEY_LAST = LeveldbUtils.KEY_LAST;

var KEY_COMPONENT_DEF_ID = '_cdef_id';
var KEY_ENTITY_ID = '_ent_id';
var KEY_COMPONENT_ID = '_com_id';
var KEY_COMPONENT_DATA = '_com_data';
var KEY_COMPONENT_DEF = '_com_def';

var KEY_ENTITY_COMPONENT = '_ent_com';
var KEY_ENTITY_BITFIELD = '_ent_bf';

var KEY_COMPONENT_DEF_URI = ['cdef', 'uri'].join(KEY_DELIMITER);
var KEY_COMPONENT_DEF_HASH = ['cdef', 'hash'].join(KEY_DELIMITER);
var KEY_COMPONENT_DEF_ID = ['cdef', 'id'].join(KEY_DELIMITER);


/**
*   Lots of clues take from:
*       https://github.com/pouchdb/pouchdb/blob/master/lib/adapters/leveldb/index.js
*
*   NOTE: sublevel currently breaks closing, so we can't use it
*/
var LevelEntitySet = EntitySet.extend({
    type: 'LevelEntitySet',
    isLevelEntitySet: true,
    isMemoryEntitySet: false,
    isAsync: true,


    initialize: function( entities, options ){
        this._cmdBuffer = CmdBuffer.create();
        this.options = options;
        this._pQ = new PromiseQ(1);
    },

    open: function( options ){
        var self = this;
        var levelOptions, defaultComponentDefId, defaultEntityId, defaultComponentId;
        if( this.isOpen() ){
            return Promise.resolve(this);
        }
        var path = this.options.path;
        self.log('opening ' + this.cid + ' with options ' + JSON.stringify(options) );
        
        levelOptions = _.extend({}, options.leveldb, {
            valueEncoding: 'json'
        });

        this.id = _.isUndefined(options.esId) ? 1 : options.esId;
        defaultComponentDefId = _.isUndefined(options.componentDefId) ? 100 : options.componentDefId;
        defaultEntityId = _.isUndefined(options.entityIdSeed) ? 50 : options.entityIdSeed;
        defaultComponentId = _.isUndefined(options.componentId) ? 200 : options.componentId;

        return LU.openDb( levelOptions )
            .then( function(db){
                self._db = db;
                // sets the UUID of this db
                return LU.getSet( self._db, null, KEY_UUID, Utils.uuid() )
            })
            .then( function(){
                return LU.getSet( self._db, null, KEY_ENTITY_SET_ID, self.id )
                    .then( function(id){
                        self.id = id;
                    });
            })
            .then( function(){
                // set up an id for component defs
                return LU.createReuseableId(self._db, self._pQ, KEY_COMPONENT_DEF_ID, defaultComponentDefId)
                    .then( function(ruid) {
                        self._cdefId = ruid;
                    });
            })
            .then( function(){
                return LU.createReuseableId(self._db, self._pQ, KEY_ENTITY_ID, defaultEntityId )
                    .then( function(ruid){
                        self._entityId = ruid;
                    });
            })
            .then( function(){
                return LU.createReuseableId(self._db, self._pQ, KEY_COMPONENT_ID, defaultComponentId )
                    .then( function(ruid){
                        self._componentId = ruid;
                    });
            })
            .then( function(){
                // load existing component defs into memory and then notify the registry about them
                return self.getComponentDefs( {notifyRegistry:true} )
                    .then( function(){ 
                        self.log('opened @ ' + self._db.location );
                        return self; 
                    });
            })
    },

    /**
    *   Returns a promise for a new component def id
    */
    _createComponentDefId: function(c){
        return this._cdefId.get();
    },


    _releaseComponentDefId: function( id ){
        return this._cdefId.release( id );
    },

    _readValue: function( key ){
        var self = this;
        return new Promise( function(resolve, reject){
            self._db.get(key, function(err,val){
                if( err ){ return reject(err); }
                return resolve( val );
            });
        });
    },


    /**
    *
    */
    close: function(){
        return LU.closeDb( this._db );
    },

    /**
    *   Clears all data from the EntitySet, by getting all the keys and then deleting them
    */
    clear: function(){
        var self = this;
        // printIns( this,1 );
        return LU.readStream( this._db, {
            values: false,
            gte: KEY_START,
            lte: KEY_LAST
        }).then( function(keys){
            var ops = _.map( keys, function(key){
                // log.debug('clearing ' + key);
                return { type:'del', key:key }
            });
            return LU.batch( self._db, self._pQ, ops );
        })
        .then( function(){
            return self;
        });
    },

    /**
    *   Returns a promise for the number of entities in this entityset
    */
    size: function(){
        return LU.readStream( this._db, {
            values: false,
            gte: KEY_ENTITY_BITFIELD + KEY_START,
            lte: KEY_ENTITY_BITFIELD + KEY_LAST
        }).then( function(keys){
            return keys.length;
        });
    },

    /**
    *
    */
    isOpen: function(){
        return this._db && this._db.isOpen();
    },

    /**
    *   Registers a component def.
    *   Returns a promise eventually resolving to this.
        - do we already
    */
    registerComponentDef: function( data, options ){
        var self = this;
        var store = self._db;
        var initial;

        options = (options || {});

        // self.log('registering schema ' + JSON.stringify(data) + ' ' + JSON.stringify(options) );

        // if this hasn't been called from the registry, then we forward the request
        // on to the registry, which takes care of decomposing the incoming schemas
        // and then notifying each of the entitySets about the new component defs
        if( !options.fromRegistry ){
            return this.getRegistry().registerComponent( data, {fromES:self} )
                .then( function(){
                    return self;
                })
        }

        return this.getComponentDefByHash( data.hash )
            .then( function(existing){
                if( existing ){
                    return existing;
                }
                // self.log('no existing cdef ' + data.hash );
                return self._registerComponentDef( data );
            });
    },

    _registerComponentDef: function (cdef, options){
        var self = this;
        // var registry = self.getRegistry();

        return Promise.resolve(cdef)
            .then( function(schema ){
                schema = Utils.deepClone( _.pick(schema, 'uri', 'hash', 'obj', 'iid') );
                schema.registered_at = Date.now();
                // get an internal id for this new component def
                return self._cdefId.get()
                    .then( function(id){
                        if( id === undefined ){ throw new Error('no cdef esid generated'); }
                        // self.log('generated new cdef id ' + id);
                        schema.esid = id;
                        // map from the registry id to es id and vice versa
                        self._cdefRIdToEsId = self._cdefRIdToEsId || [];
                        self._cdefEsIdToRId = self._cdefEsIdToRId || [];
                        self._cdefUriToSchema = self._cdefUriToSchema || {};

                        self._cdefRIdToEsId[ schema.iid ] = schema.esid;
                        self._cdefEsIdToRId[ schema.esid ] = schema.iid;
                        self._cdefUriToSchema[ schema.uri ] = schema;
                        
                        // self.log('registered schema ' + JSON.stringify(schema) );
                        return schema;        
                    });
            })
            .then( function(schema){
                return LU.batch( self._db, self._pQ, [
                    { type:'put', key:[KEY_COMPONENT_DEF_ID,schema.esid].join(KEY_DELIMITER), value: schema},
                    { type:'put', key:[KEY_COMPONENT_DEF_HASH,schema.hash].join(KEY_DELIMITER), value:schema},
                    { type:'put', key:[KEY_COMPONENT_DEF_URI,schema.uri].join(KEY_DELIMITER), value:schema}
                ]).then( function(){ return schema; });
            })
            .then( function(schema){
                self.log('registering cdef ' + schema.uri + ' ' + schema.hash + ' iid ' + schema.iid + ' esid ' + schema.esid );
                self.trigger('cdef:register', schema);
                return self;
            });
    },

    /**
    *   Returns a component def by its hash
    */
    getComponentDefByHash: function( hash ){
        return LU.get( 
            this._db, 
            null,
            [KEY_COMPONENT_DEF_HASH,hash].join(KEY_DELIMITER),
            null );
    },

    /**
    *   Returns a component def by its id/uri
    */
    getComponentDef: function( schemaId ){
        return LU.get( 
            this._db, 
            null,
            [KEY_COMPONENT_DEF_URI,schemaId].join(KEY_DELIMITER),
            null );
    },


    /**
    *   Reads component defs into local structures
    *   Returns a promise for an array of registered schemas
    */
    getComponentDefs: function( options ){
        var self = this;
        var store = self._db;

        options = (options || {});

        return LU.readStream( store,{
            keys: false,
            gte: KEY_COMPONENT_DEF_URI + KEY_START,
            lte: KEY_COMPONENT_DEF_URI + KEY_LAST
        })
        .then( function(schemas){
            // printIns( schemas );
            // _.each( schemas, function(s){
            //     self.log('read schema ' + s.uri + ' ' + s.hash );
            // })
            
            if( options.notifyRegistry ){
                var registry = self.getRegistry();
                return Promise.all(
                    _.map( schemas, function(schema){
                        return registry.registerComponent( schema );
                    }))
                    .then( function(){
                        return schemas;
                    }); 
            }
            return schemas;
        })
    },

    getEntity: function( entity, options ){
        var entityId;
        entityId = Entity.toEntityId( entity );
        if( options && options.componentBitFieldOnly ){
            return this._readEntityBitField( entityId );
        }
        return this._readEntityById( entityId );
    },


    /**
    *
    */
    _readEntityById: function( entityId ){
        var registry = this.getRegistry();
        var key = LU.key( KEY_ENTITY_COMPONENT, entityId );
        var store = this._db;

        return LU.readStream( store,{
            keys: false,
            gte: key + KEY_START,
            lte: key + KEY_LAST
        })
        .then( function(components){
            if( _.size(components) === 0 ){
                // log.debug('could not find entity ' + entityId );
                throw new Error('NotFound');
            }
            var entity = registry.createEntity(null,{id:entityId});
            _.each( components, function(data){
                var schemaUri = data._sh;
                data = _.omit( data, '_s', '_sh', '_e' );
                var component = registry.createComponent( schemaUri, data );
                // printIns( component );
                entity.addComponent( component );
            });
            return entity;
        });
    },

    /**
    *   Returns an entity instance for the given id with only its
    *   bitfield set, but no components retrieved
    */
    _readEntityBitField: function( entityId ){
        var registry = this.getRegistry();
        var key = LU.key( KEY_ENTITY_BITFIELD, entityId );
        var store = this._db;

        return LU.get( this._db, null, key, null )
            .then( function(data){
                var entity;
                if( !data ){
                    throw new Error('NotFound');
                }
                entity = Entity.create( entityId );
                entity.set('comBf', BitField.create(data) );
                return entity;
            })
    },


    /**
    *
    */
    update: function( entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsRemoved ){
        var self = this;
        var commands = [];
        printIns( arguments, 1 );
        // _.each( componentsAdded, function(com){
        //     log.debug('adding component ' + com.getEntityId() );
        // });

        // create entity ids for each of the entities
        return self._entityId.getMultiple( entitiesAdded.length )
            .then( function( entityIds ){
                // assign the entity ids to the entities
                _.each( entitiesAdded, function(entity,ii){
                    // set the new id on the entity (and its components)
                    self._setEntityId( entity, entityIds[ii] );
                    commands = self._updateEntity( entity, commands );
                    log.debug('ldbes> added e ' + entity.id + '-' + entity.getEntityId() + '/' + entity.getEntitySetId() );
                });
                return commands;
            })
            .then( function(){
                _.each( entitiesUpdated, function(entity){
                    log.debug('ldbes> updated e ' + entity.id + '-' + entity.getEntityId() + '/' + entity.getEntitySetId() );
                    commands = self._updateEntity( entity, commands );
                });
            })
            .then( function(){
                // create component ids for each of the components
                return self._componentId.getMultiple( componentsAdded.length )
                    .then( function(componentIds){
                        _.each( componentsAdded, function(com,ii){
                            com.set({id:componentIds[ii]});
                            // log.debug('set com id to  ' + com.id );
                            commands = self._updateComponent( com, commands );
                        });
                        return commands;
                    });
            })
            .then( function(){
                // log.debug('err ' + componentsRemoved.length);
                // deal with removing components
                _.each( componentsRemoved, function(component){
                    commands = self._removeComponent( component, commands );
                });

                // printIns( commands );
            })
            .then( function(){
                // deal with removing entities
                _.each( entitiesRemoved, function(entity){
                    commands = self._removeEntity( entity, commands );
                    log.debug('removed e ' + entity.id + '-' + entity.getEntityId() + '/' + entity.getEntitySetId() );
                });
            })
            .then( function(){

                return LU.batch( self._db, self._pQ, commands );
            })
    },

    /**
    *   Sets an id on an entity and also updates the components
    */
    _setEntityId: function( entity, entityId ){
        var components = entity.getComponents();
        entity.setEntityId( entityId );
        entity.setEntitySetId( this.id );

        _.each( components, function(component){
            component.setEntityId( entityId );
        });
    },

    _updateEntity: function( entity, commands ){
        // entity id -> component bitfield
        commands.push({
            type:'put',
            key: LU.key(KEY_ENTITY_BITFIELD, entity.getEntityId()),
            value: entity.getComponentBitfield().toString()
        });

        // this.trigger('ent:up ' + entity.getEntityId() );
        // self.log('update entity ' + 

        return commands;
    },

    /**
    *   deletes an array of entities
    */
    _removeEntity: function( entity, commands ){
        commands.push({
            type: 'del',
            key: LU.key(KEY_ENTITY_BITFIELD, entity.getEntityId())
        });

        return commands;
    },

    /**
    *
    */
    _updateComponent: function( component, commands ){
        var componentData = component.toJSON();
        var schema = this._cdefUriToSchema[ component.schemaUri ];
        componentData._s = schema.uri;
        componentData._sh = schema.hash;
        componentData._e = component.getEntityId();

        // entity id / component id -> component
        commands.push({
            type:'put', 
            key: LU.key( KEY_ENTITY_COMPONENT, component.getEntityId(), component.id ),
            value:componentData
        });

        // component id -> component JSON
        commands.push({
            type: 'put',
            key: LU.key( KEY_COMPONENT_DATA, component.id ),
            value: componentData
        });

        // component def hash -> component JSON
        commands.push({
            type: 'put',
            key: LU.key( KEY_COMPONENT_DEF, schema.hash, component.id ),
            value: componentData
        });

        return commands;
    },

    /**
    *   deletes an array of components
    */
    _removeComponent: function( component, commands ){
        var schema = this._cdefUriToSchema[ component.schemaUri ];
        if( !schema ){
            throw new Error('schema not found for ' + JSON.stringify(component) );
        }

        commands.push({
            type: 'del',
            key: LU.key( KEY_ENTITY_COMPONENT, component.getEntityId(), component.id ),
        });

        commands.push({
            type: 'del',
            key: LU.key( KEY_COMPONENT_DATA, component.id ),
        });

        commands.push({
            type: 'del',
            key: LU.key( KEY_COMPONENT_DEF, schema.hash, component.id ),
        });

        return commands;
    },

    /**
    *   upserts an array of entities
    */
    _updateEntities: function( entities ){
        
        // throw new Error('NotFound');
    },

    

    /**
    *   upserts an array of components
    */
    _updateComponents: function( components ){

    },

    

});


function formatSeq(n) {
    return ('0000000000000000' + n).slice(-16);
}

function parseSeq(s) {
    return parseInt(s, 10);
}


LevelEntitySet.create = function( options ){
    var result;

    options || (options={});

    // if( options.leveldb ){
    //     printIns( options.leveldb, 1 );
    // }
    options = _.extend( {
        path: Path.join( Sh.tempdir(), 'lvlEs_' + options.id )
    }, options.leveldb, options );

    result = new LevelEntitySet( null, options );
    result.log = function(msg){
        if( options.debug ){
            log.debug('lvldb.'+result.cid+'> ' + msg);
        }
    }
    // result.cid = _.uniqueId('es');
    
    return result;
}

module.exports = LevelEntitySet;