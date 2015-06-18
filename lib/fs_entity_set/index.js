'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Fs = require('fs');
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



    getEntity: function( entity, options ){
        var entityId;
        entityId = Entity.toEntityId(entity);
        return this._readEntityById( entityId );
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

    iterator: function(options){
        var es = this;
        return {
            _nextIndex: 0,
            next: function(){
                var self = this;
                if( !this._entityIndex ){
                    return es._readEntityIndex()
                        .then( function(entityIndex){
                            self._entityIndex = entityIndex;
                            return self.next();
                        }, function(err){
                            return {done:true, err:err};
                        });
                }
                return new Promise( function(resolve, reject){
                    var entityId;
                    if( self._nextIndex < self._entityIndex.length ){
                        entityId = self._entityIndex[self._nextIndex++];
                        return es._readEntityById( entityId )
                            .then( function(e){
                                return resolve( {done:false,value:e} );        
                            });
                    }
                    return reject({done:true});
                });
            }
        };
    },

    /**
    *   Selects a number of entities from the entityset
    */
    where: function( entityFilter, attrs, options ){
        var result = EntitySet.create();
        var registry = this.getRegistry();
        var filters;
        var componentUri;

        options || (options={});

        result.setRegistry( registry );
        result.id = registry.createId();

        if( !entityFilter ){
        } else if( _.isString(entityFilter) ){
            componentUri = registry.getIId( entityFilter );
            if( attrs ){
                entityFilter = EntityFilter.create( EntityFilter.ATTRIBUTES, componentUri, attrs );
            } else {
                entityFilter = EntityFilter.create( EntityFilter.ALL, componentUri );
            }
        }
        
        // if( options.view ){
        //     result.type = 'EntitySetView';
        //     result.isEntitySetView = true;

        //     // make <result> listenTo <entitySet> using <entityFilter>
        //     EntitySet.listenToEntitySet( result, this, entityFilter, options );

        //     // store the view
        //     this.views || (this.views={});
        //     this.views[ EntityFilter.hash( entityFilter ) ] = result;
        //     this.trigger('view:create', result);
        // } else {
            result = FileSystemEntitySet.map( this, entityFilter, result );
        // }
        
        return result;
    },

    _readEntityById: function( entityId, options, cb ){
        var self = this;
        var path = this._entityPath( entityId );

        return new Promise( function(resolve, reject){
            Fs.exists( path, function(exists){
                if( !exists ){
                    return reject( new Error( 'entity not found: ' + entityId ) );
                }

                Fs.readFile( path, {encoding:'utf8'}, function(err,data){
                    if( err ){
                        return reject( err );
                    }
                    // log.debug('loaded ' + data);
                    // log.debug('  from ' + path );
                    return resolve( self._entityFromData(data) );
                });
            });
        });
    },



    _entityFromData: function( entityData, options, cb ){
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
        return new Promise( function(resolve, reject){
            Fs.readFile( self._entityIndexPath(), function(err,data){
                // log.debug('read file data ' + err);
                // if( err ){ throw new Error(err); }
                if( err ){ return reject(err); }
                return resolve( JSON.parse(data) );
            });
        });
    },

    _writeEntityIndex: function( entityIndex, cb ){
        var self = this;
        return new Promise( function(resolve, reject){
            var data = JSON.stringify( entityIndex );
            var path = self._entityIndexPath();
            Sh.mkdir('-p', Path.dirname(path) );

            Fs.writeFile( path, data, function(err){
                // log.debug('wrote entity index to ' + path + ' ' + err);
                if( err ){ return reject(err); }

                return resolve(self);
            });
        });
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
        var count = 0;
        return _.reduce( entities, function(current,entity){
            return current.then( function(){
                return new Promise( function(resolve, reject){
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
                    // log.debug('saving ' + data );
                    
                    Fs.writeFile( path, data, function(err){
                        if( err ){ return reject(err); }
                        // log.debug('saved ' + data );
                        // log.debug('  to ' + path);
                        return resolve(true);
                    });
                });
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

    /**
    *
    */
    _updateComponents: function( components ){
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
        return new Promise( function(resolve, reject){
            if( Fs.existsSync( path ) ){
                return resolve(true);
            }

            Sh.mkdir( '-p', Path.dirname(path) );

            Fs.writeFile( path, JSON.stringify(schema), function(err){
                if( err ){ return reject(err); }
                return resolve(true); 
            } );
        });
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
                    return reject('could not find component id ' 
                        + componentId + ' hash ' + schemaHash + ' at ' + path);
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


/**
*   Transfers entities from src to dst whilst applying the filter
*   The entityFilter is then set on the dstEntitySet
*/
FileSystemEntitySet.map = function( srcEntitySet, entityFilter, dstEntitySet, options ){
    var e,i,elen,len,it;
    var entity;
    options || (options = {});
    
    dstEntitySet.reset();

    if( entityFilter ){
        EntitySet.setQuery( dstEntitySet, entityFilter );
    }

    it = srcEntitySet.iterator();

    return Utils.reduceIterator( it, function(memo,item){
            memo.push( item );
        }, [])
        .then( function( entities ){
            dstEntitySet.addEntity( entities );
            return dstEntitySet;
        });
};


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
    // if( !entity.components || entity.components.length <= 0 ){
        data.none = true;
    // }

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
    result.cid = _.uniqueId('es');
    
    return result;
}

module.exports = FileSystemEntitySet;