'use strict';

var Promise = require('bluebird');

var _ = require('underscore');
var Backbone = require('backbone');
var Fs = Promise.promisifyAll( require('fs') );
var Path = require('path');

var Sh = require('shelljs');

var BitField = require('./bit_field');
var Component = require('./component');
var Entity = require('./entity');
var EntityFilter = require('./entity_filter');
var EntitySet = require('./entity_set');
var Utils = require('./utils');

var CmdBuffer = require('./cmd_buffer/async');

var TEMP_ENTITY_PREFIX = 'te';

var FileSystemEntitySet = EntitySet.extend({
    type: 'FileSystemEntitySet',
    isFileSystemEntitySet: true,
    isAsync: true,

    initialize: function( entities, options ){
        this._cmdBuffer = CmdBuffer.create();
        this._componentCount = 0;
        this._entityCount = 0;
        this._entityArray = [];
        this.length = 0;
        this._path = options.path || '';
    },

    open: function(){
        var self = this;

        return new Promise( function(resolve,reject){
            var path = self.getPath();

            if( !path ){
                throw new Error('no path specified');
            }

            Sh.mkdir('-p', path);

            return resolve( self );
        });
    },

    close: function(){
        var self = this;
        return new Promise( function(resolve,reject){
            return resolve(self);
        });
    },

    size: function(){
        return this._entityArray.length;
    },

    getPath: function(){
        return this._path;
    },

    /**
    *   
    */
    addEntity: function( entity, options ){
        if( EntitySet.isEntitySet(entity) ){
            return this.addEntity( entity.toArray() );
        }

        return this._cmdBuffer.addEntity( this, entity, options );
    },

    removeEntity: function( entity, options ){
        return this._cmdBuffer.removeEntity( this, entity, options );
    },

    getEntity: function( entity, options ){
        var entityId;
        entityId = Entity.toEntityId(entity);
        return this._readEntityById( entityId );
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options){
        return this._cmdBuffer.addComponent( this, component, options );
    },

    removeComponent: function( component, options ){
        return this._cmdBuffer.removeComponent( this, component, options );
    },

    /**
    *   Returns the entity at a given index.
    *   the entityset has an order of entities
    */
    at: function(index) {
        var self = this;

        return self._readEntityIndex()
            .then( function(entityIndex){
                var entityId = entityIndex[ index ];
                return self._readEntityById( entityId );
            });
    },

    _readEntityById: function( entityId, options, cb ){
        var self = this;
        var path = this._entityPath( entityId );

        return new Promise( function(resolve, reject){
            Fs.exists( path, function(exists){
                if( !exists ){
                    return reject( new Error( 'entity not found: ' + entityId ) );
                }

                return Fs.readFileAsync( path, {encoding:'utf8'} )
                    .then( function(data){
                        return resolve( self.entityFromData( data ) );
                    })
                    .catch( function(e){
                        return reject( e );
                    });
            });
        });
    },



    entityFromData: function( entityData, options, cb ){
        var i,len;
        var data = JSON.parse( entityData );
        var result = Entity.create( data.id );
        var self = this;

        // read each of the listed components in turn
        return _.reduce( data._components, function(current,com){
            return current.then(function(){
                return self._readComponent( com.id, com.schemaHash )
                    .then( function(com){
                        result.addComponent( com );
                    });
            });
        }, Promise.resolve() )
            .then( function(com){
                return result;
            })
    },

    _readEntityIndex: function(){
        var self = this;
        return Fs.readFileAsync( self._entityIndexPath() )
            .then( function(data){
                return JSON.parse(data);
            }, function(err){
                return null;
            });
    },

    _writeEntityIndex: function( entityIndex, cb ){
        var self = this;
        var data = JSON.stringify( entityIndex );
        var path = self._entityIndexPath();
        Sh.mkdir('-p', Path.dirname(path) );
        return Fs.writeFileAsync( path, data );
    },

    atSync: function(index){
        throw new Error('not supported');
    },


    _addEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        return Promise.reject(new Error('not implemented'));
    },


    _removeEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        return Promise.reject(new Error('not implemented'));
    },

    _entityIdToEntity: function( entityId ){
        var self = this;

        entityId = parseInt( entityId, 10 );

        if( self._cmdBuffer.isTempId(entityId) ){
            return new Promise( function(resolve){
                return createTempEntity();
            });
        }
        return self.getEntity( entityId )
            .then( function found(entity){
                return entity;
            }, function notFound(){
                var result = Entity.toEntity( entityId );
                // log.debug('didnt find existing entity ' + entityId + ' so created temp ' + result.getEntityId() + '/' + result.cid );
                return result;
            });
    },

    

    _createEntityId: function(){
        if( !this.entityIndex ){
            this.entityIndex = 1;
        }

        return this.entityIndex++;
    },

    _createComponentId: function(){
        if( !this.componentIndex ){
            this.componentIndex = 1;
        }

        return this.componentIndex++;
    },

    _updateEntities: function( entities ){
        var self = this;
        var savePath = self.getPath();

        return _.reduce( entities, function(current,entity){
            return current.then( function(){
                var data;
                var path;

                if( entity.isNew() || entity.isTemp ){
                    entity.set('id', self._createEntityId());
                }

                path = self._entityPath( entity );
                
                Sh.mkdir('-p', Path.dirname(path) );
                if( _.indexOf( self._entityArray, entity.id ) === -1 ){
                    self._entityArray.push( entity.id );
                    self.length = self._entityArray.length;
                }
                
                data = entityToData( entity );
                return Fs.writeFileAsync( path, data );
            });
        }, Promise.resolve() )
            .then( function(){
                return self._writeEntityIndex( self._entityArray );
            });
    },

    _deleteEntities: function( entities ){
        var self = this;
        var savePath = self.getPath();

        return _.reduce( entities, function(current,entity){
            return current.then( function(){
                return self._deleteComponents( entityComponents(entity) );
            })
            .then( function(){
                return new Promise( function(resolve, reject){
                    var path = self._entityPath( entity );

                    var index = _.indexOf( self._entityArray, entity.id );
                    if( index !== -1 ){
                        self._entityArray.splice( index, 1);
                        self.length = self._entityArray.length;
                    }
                    // if( _.indexOf( self._entityArray, entity.id ) === -1 ){
                    //     self._entityArray.push( entity.id );
                    // }

                    Fs.exists( path, function(exists){
                        if( !exists ){
                            return resolve( entity );
                        }
                        return Fs.unlink( path, function(){
                            return resolve( entity );
                        });
                    });
                });
            });

        }, Promise.resolve() )
            .then( function(){
                return self._writeEntityIndex( self._entityArray );
            })
    },

    writeNewComponents: function( components ){
        var self = this;
        var savePath = self.getPath();

        // write each of the components in turn
        return _.reduce( components, function(current,com){
            return current.then(function(){
                return self._writeComponent( com );
            });
        }, Promise.resolve() );
    },

    

    /**
        adding new component devolves into:
            - registering the component schema
                - create a folder for the component schema hash
                - write a schema.json file
                - update the component def index with the new schema
                - use the newly generated def id and assign to the incoming component
            - creating a new entity
                - create a new entity id/index
                - write a new file with the entity json
                - update the entity index file
            - creating a new component
                - generate a new (internal) id for the component
                - write the component JSON to a file named <id>.json within the componentDef folder

    */

    _registerComponentDef: function( component, options ){
        var schema = this.getRegistry().schemaRegistry.get( component.schemaUri, null, {full:true} );
        var path = Path.join( this.getPath(), 'com', schema.hash, 'schema.json' );

        // check whether we have already registered
        if( Fs.existsSync( path ) ){
            return true;
        }

        Sh.mkdir( '-p', Path.dirname(path) );

        Fs.writeFileSync( path, JSON.stringify(schema) );

        return true;
    },

    _writeComponent: function( component, options ){
        var path;
        var self = this;
        var schema = this.getRegistry().schemaRegistry.get( component.schemaUri, null, {full:true} );

        return new Promise( function(resolve, reject){
            if( component.isNew() ){
                log.debug('assigning new id to component');
                component.set({id: self._createComponentId() });
            }

            path = self._componentPath( component );
            Sh.mkdir('-p', Path.dirname(path) );

            var data = component.toJSON();
            data._s = schema.hash;

            data = JSON.stringify( data );
            Fs.writeFile( path, data, function(err){
                if( err ){
                    throw new Error('could not write component to ' + path );
                }
                return resolve(component);
            });
        });

        
    },

    _readComponent: function( componentId, schemaHash, options ){
        var registry = this.getRegistry();
        var path = Path.join( this.getPath(), 'c', schemaHash  );

        path = Path.join( path, componentId + '.json'  );

        return new Promise( function(resolve, reject){
            Fs.exists( path, function(exists){
                if( !exists ){
                    return reject('could not find component id ' + componentId + ' hash ' + schemaHash );
                }
                Fs.readFile( path, {encoding:'utf8'}, function(err,data){
                    if( err ){
                        return reject( err );
                    }
                    try{
                        data = JSON.parse( data );
                    } catch( parseError ){
                        log.error('error parsing component ' + componentId + ' ' + schemaHash );
                    }

                    var com = registry.createComponent( data, null, {schemaKey:'_s'} );
                    return resolve( com );
                });
            })
        });          
    },

    _deleteComponents: function( components ){
        var self = this;
        var savePath = this.getPath();

        return _.reduce( components, function(current,com){
            return current.then( function(){
                return new Promise( function(resolve, reject){
                    var path = self._componentPath( com );

                    Fs.exists( path, function(exists){
                        if( !exists ){
                            return resolve( component );
                        }
                        return Fs.unlink( path, function(){
                            return resolve( com );
                        });
                    });
                });
                

            });
        }, Promise.resolve() );
    },

    /**
    *   Returns true if the entity exists within this set
    */
    entityExists: function( entity, options ){
        var path;

        if( !entity || _.isString(entity) && entity.indexOf(TEMP_ENTITY_PREFIX) === 0 ){
            return false;
        }

        entity = Entity.toEntity( entity );
        entity.setEntitySetId( this.id );

        path = this._entityPath( entity );

        return Fs.existsAsync( path );
    },


    /**
    *
    */
    hasEntity: function( entity ){
    },

    _isComponentRegistered: function( component ){
        return false;
    },

    _componentPath: function( component ){
        var path, schema;
        
        schema = this.getRegistry().schemaRegistry.get( component.schemaUri, null, {full:true} );
        if( !schema ){
            log.debug('no schema for ' + JSON.stringify(component) );
            // printIns( component );
        }
        path = Path.join( this.getPath(), 'c', schema.hash  );
        
        return Path.join( path, component.id + '.json'  );
    },

    _entityPath: function( entityId ){
        entityId = Entity.isEntity(entityId) ? entityId.id : entityId;
        return Path.join( this.getPath(), 'e', entityId + '.json'  );
    },

    // returns the path to the entity index
    _entityIndexPath: function(){
        return Path.join( this.getPath(), 'e', 'index.json' );
    },
});



function componentFromData( componentData ){
    var data = JSON.parse( componentData );

    var result = Component.create();
    result.set( result.parse(data) );

    return result;
}

function entityToData( entity ){
    var component;
    var componentIId;
    var result;
    var data = entity.toJSON();

    // serialise the entities component references
    data._components = [];

    for( componentIId in entity.components ){
        component = entity.components[ componentIId ];
        data._components.push( {id:component.id, schemaHash:component.schemaHash} );
    }

    result = JSON.stringify( data );
    return result;
}

/**
*   Returns an array of the components contained on the entity
*/
function entityComponents( entity ){
}

function createTempEntity( existingId ){
    var result = Entity.create();
    result.cid = _.uniqueId( TEMP_ENTITY_PREFIX );
    result.isTemp = true;
    return result;
}


FileSystemEntitySet.create = function( options ){
    var result;
    var tmpDir = Sh.tempdir();

    options || (options={});

    options = _.extend( {
        path: Path.join( tmpDir, 'fsEs_' + options.id )
    }, options );

    result = new FileSystemEntitySet( null, options );
    
    // printVar( result );

    return result;
}

module.exports = FileSystemEntitySet;