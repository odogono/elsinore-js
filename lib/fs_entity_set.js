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


var TEMP_ENTITY_PREFIX = 'te';

var FileSystemEntitySet = EntitySet.extend({

    initialize: function( attrs, options ){
        this._cmdBuffer = [];
        this._componentCount = 0;
        this._entityCount = 0;
        this._entityArray = []; // entity population of this set - an array of entity ids
    },

    open: function(){
        var self = this;

        return new Promise( function(resolve,reject){
            var path = self.get('path');

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

    /**
    *   
    */
    addEntity: function( entity, options ){
        var self = this;
        var entityId;
        var batch;
        var execute;

        options || (options={});
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( EntitySet.isEntitySet(entity) ){
            return this.addEntity( entity.toArray() );
        }

        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if( _.isArray(entity) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;
            }

            return _.reduce( entity, function(current, ine){
                return current.then(function(){
                    return self.addEntity( ine );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self._executeCmdBuffer( self._cmdBuffer, options );
                    }
                    return self;
                });
        }

        // does this entity exist in our es?
        entity = Entity.toEntity( entity );
        entityId = Entity.toEntityId( entity );

        // retrieve the existing entity
        return self.getEntity( entityId )
            .then( function existingEntityFound(entity){
                log.debug('entity existing');

            }, function existingEntityNotfound(){
                var comDefId;
                EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_ENTITY_ADD, entityId, options );

                // no existing entity - just add all the components
                for( comDefId in entity.components ){
                    EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_COMPONENT_ADD, entity.components[comDefId], options );
                }
            })
            .then( function(){
                // execute any outstanding commands
                if( execute ){
                    return self._executeCmdBuffer( self._cmdBuffer, options );
                }
                
                return self;        
            });
    },

    removeEntity: function( entity, options ){
        var i, batch, execute, existingEntity, entityId;
        var executeOptions;
        var self = this;

        if( !entity ){
            return this;
        }

        options || (options = {});

        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;
        executeOptions = _.extend( {}, options, {removeEmptyEntity:true} );

        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if( _.isArray(entity) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;
            }

            return _.reduce( entity, function(current, ine){
                return current.then(function(){
                    return self.addEntity( ine );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self._executeCmdBuffer( self._cmdBuffer, options );
                    }
                    return self;
                });
        }

        // does this entity exist in our es?
        entity = Entity.toEntity( entity );
        entityId = Entity.toEntityId( entity );

        // retrieve the existing entity
        return self.getEntity( entityId )
            .then( function existingEntityFound(entity){
                var comDefId;

                for( comDefId in entity.components ){
                    EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_COMPONENT_REMOVE, entity.components[comDefId] );
                }
                return entity;
            }, function existingEntityNotfound(){
                throw new Error('entity ' + entityId + ' not found' );
            })
            .then( function(){
                if( execute ){
                    return self._executeCmdBuffer( self._cmdBuffer, options );
                } 
                return self;        
            });

    },

    getEntity: function( entity, options ){
        var entityId, entity;

        entityId = Entity.toEntityId(entity);
        return this._readEntityById( entityId );
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options){
        var self = this, debug, batch, execute, silent, listenTo, entityId, entity, existingCom;
        

        options || (options = {});
        debug = options.debug;
        silent = options.silent;
        entity = options.entity;
        listenTo = options.listen;
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component ){
            return;
        }

        // handle an array of components
        if( _.isArray(component) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }

            return _.reduce( component, function(current, com){
                return current.then(function(){
                    return self.addComponent( com, options );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self._executeCmdBuffer( self._cmdBuffer, options );
                    }
                    return self;
                });
        }

        return new Promise( function(resolve, reject){
            // determine whether we have this component registered already
            entityId = component.getEntityId();

            if( !entityId ){
                // do we have a entity add in the queue already?
                entityId = EntitySet.findEntityAddId( self._cmdBuffer );

                if( entityId == -1 ){
                    entityId = self._createEntity(true);
                    // log.debug('created new entity ' + entityId );
                } else {
                    // log.debug('found add entity id ' + entityId );
                }
                component.setEntityId( entityId );
                return resolve(null);
            } else {
                // log.debug('we have component.entityId ' + entityId );
                // does this entity exist in our es?
                return self.getEntity( entityId )
                    .then( function existingEntityFound(entity){
                        return resolve(entity);
                    }, function existingEntityNotfound(){
                        return resolve(null);
                    });
            }
        })
        .then( function(entity){
            if( !entity ){
                // log.debug('no entity, adding commands ENTITY_ADD-' + entityId );

                EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_ENTITY_ADD, entityId, options );
                EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_COMPONENT_ADD, component, options );
            } else {
                var existingComponent = self.getComponentFromEntity( component, entity );

                if( debug ){
                    log.debug('existing ' + component.hash() );
                }

                // does the existing entity have this component?
                if( !existingCom ){
                    EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_COMPONENT_ADD, component, options );
                } else {
                    // is the existing component different?
                    EntitySet.addCommand( self._cmdBuffer, EntitySet.CMD_COMPONENT_UPDATE, component, options );
                }
            }

            // execute any outstanding commands
            if( execute ){
                // if( debug ){ log.debug('executing cmd buffer'); }
                return self._executeCmdBuffer( self._cmdBuffer, options );
            }
            return self;
        })
    },

    removeComponent: function( component, options ){
        var batch,execute, debug;
        
        options || (options = {});

        debug = options.debug;
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component ){
            return this;
        }

        // handle an array of components
        if( _.isArray(component) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }

            return _.reduce( component, function(current, com){
                return current.then(function(){
                    return self.removeComponent( com, options );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self._executeCmdBuffer( self._cmdBuffer, options );
                    }
                    return self;
                });
        }

        if( debug ){ log.debug('removing component from entity ' + component.getEntityId() ); }
        EntitySet.addCommand( this._cmdBuffer, EntitySet.CMD_COMPONENT_REMOVE, component, options );

        // execute any outstanding commands
        if( execute ){
            return this._executeCmdBuffer( this._cmdBuffer, options );
        }

        return self;
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

        // // first job, look up the id of the entity at the given index
        // return new Promise( function(resolve, reject){

        //     self._readEntityIndex( function( err, entityIndex){
        //         var entityId = entityIndex[ index ];
        //         return self._readEntityById( entityId, null, function(err,entity){
        //             if( err ){
        //                 return reject(err);
        //             }
        //             return resolve( entity );
        //         });
        //     });
        // });
        

        // return Promise.reject(new Error('not implemented'));
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
        if( isTempId(entityId) ){
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

    _executeCmdBuffer: function( cmdBuffer, options ){
        var cmds, entityId;
        var self = this;
        var silent;
        var removeEmptyEntity;
        var debug;
        var entitiesAdded = {};
        var entitiesUpdated = {};
        var entitiesRemoved = {};
        var componentsAdded = {};
        var componentsRemoved = {}
        var componentsUpdated = {};

        if( options ){
            removeEmptyEntity = options.removeEmptyEntity;   
            debug = this.debug || options.debug;
            silent = options.silent;
        }

        return _.keys(cmdBuffer).reduce( function(sequence, entityId){
            var cmds = cmdBuffer[ entityId ];

            // resolve the incoming entity into an entity instance - either
            // existing or new
            return sequence.then( function(){
                // convert the entity id into an existing entity or a new one
                return self._entityIdToEntity( entityId );
            })
            .then( function(entity){
                var tempEntity = isTempId( entity.getEntityId() );
                if( debug ){ log.debug('executing cmds for entity ' + entity.getEntityId() + '/' + entity.cid + ' ' + (tempEntity?'temp':'') ); }

                // iterate through each cmd for the entity
                cmds.forEach( function(cmd){
                    var component = cmd[1];
                    var entityChanged = false;
                    switch( cmd[0] ){
                        case EntitySet.CMD_ENTITY_ADD:
                            entity.setEntityId( entityId );
                            entity.set({'fs_existingId':entityId});
                            entitiesAdded[ entity.cid ] = entity;
                            if( debug ){ log.debug('cmd: adding entity ' + entity.getEntityId() + '/' + entity.cid ); }
                            break;

                        case EntitySet.CMD_COMPONENT_ADD:
                            // does entity have component already?
                                // is the component different?
                            entity.addComponent( component );
                            componentsAdded[ component.cid ] = component;
                            if( !entitiesAdded[ entity.cid ] ) {
                                entityChanged = true;
                            }
                            if( debug ){ log.debug('cmd: add component ' + component.id + '/' + component.cid ); }

                            break;
                        case EntitySet.CMD_COMPONENT_REMOVE:
                            // no entity to remove from?
                            if( debug ){ log.debug('removing component ' + JSON.stringify(component) ); }
                            if( !entity ){
                                return;
                            }
                            if( debug ){  log.debug('cmd: rem com ' + component.id + '/' + component.cid + ' ' + JSON.stringify(cmd[2]) ); }
                            self.removeComponentFromEntity( component, entity );
                            componentsRemoved[ component.cid ] = component;

                            if( (!self.allowEmptyEntities || removeEmptyEntity) && !self.doesEntityHaveComponents( entity ) ){
                                entitiesRemoved[ entity.cid ] = entity;
                                // entitiesRemoved.push( self._removeEntity(entity) );
                            } else {
                                entitiesUpdated[ entity.cid ] = entity;    
                            }

                            
                            break;
                    }

                    if( entityChanged ){
                        if( entity.isNew() || entity.isTemp ){
                            // log.debug('added new entity ' + entity.cid );
                            entitiesAdded[ entity.cid ] = entity;
                        } else {
                            entitiesUpdated[ entity.cid ] = entity;
                        }
                    }
                });
            });

        }, Promise.resolve() )
        .then( function(){
            var i,len;
            var entity;

            if( debug ){
                log.debug('entities added: ' + JSON.stringify( _.keys(entitiesAdded) )); 
                log.debug('entities updated: ' + JSON.stringify( _.keys(entitiesUpdated) )); 
                log.debug('entities removed: ' + JSON.stringify( _.keys(entitiesRemoved) )); 

                log.debug('components added: ' + JSON.stringify( _.keys(componentsAdded) )); 
                log.debug('components updated: ' + JSON.stringify( _.keys(componentsUpdated) )); 
                log.debug('components removed: ' + JSON.stringify( _.keys(componentsRemoved) )); 
            }

            entitiesAdded = _.values( entitiesAdded );
            componentsAdded = _.values( componentsAdded );

            for( i=0,len=componentsAdded.length;i<len;i++ ){
                componentsAdded[i].set({id: self._createComponentId() });
            }

            // save the new entities
            return self._updateEntities( entitiesAdded )
                .then(function(){
                    return self._updateEntities( entitiesUpdated );
                })
                .then(function(){
                    return self.writeNewComponents( componentsAdded );
                })
                .then( function(){
                    return self._deleteComponents( componentsRemoved );
                })
                .then( function(){
                    return self._deleteEntities( entitiesRemoved );
                })
                .then( function(){
                    if( !silent ){
                        if( componentsUpdated && componentsUpdated.length > 0 ){
                            self.trigger('component:change', componentsUpdated.length <= 1 ? componentsUpdated[0] : componentsUpdated );
                        }

                        if( componentsRemoved && componentsRemoved.length > 0 ){
                            self.trigger('component:remove', componentsRemoved.length <= 1 ? componentsRemoved[0] : componentsRemoved );
                        }
                        
                        if( entitiesRemoved && entitiesRemoved.length > 0 ){
                            self.trigger('entity:remove', entitiesRemoved.length <= 1 ? entitiesRemoved[0] : entitiesRemoved );
                        }        

                        if( componentsAdded && componentsAdded.length > 0 ){
                            self.trigger('component:add', componentsAdded.length <= 1 ? componentsAdded[0] : componentsAdded );
                        }

                        if( entitiesAdded && entitiesAdded.length > 0 ){
                            self.trigger('entity:add', entitiesAdded.length <= 1 ? entitiesAdded[0] : entitiesAdded );
                        }    
                    }

                    cmdBuffer.length = 0;
                    entitiesAdded = null;
                    componentsAdded = null;
                    componentsRemoved = null;
                    return self;
                });
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
        var savePath = self.get('path');

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
        var savePath = self.get('path');

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
        var savePath = self.get('path');

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
        var path = Path.join( this.get('path'), 'com', schema.hash, 'schema.json' );

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
                component.set({id: this._createComponentId() });
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
        var path = Path.join( this.get('path'), 'c', schemaHash  );

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

                    // log.debug('creating component from ' + JSON.stringify(data) );
                    var com = registry.createComponent( data );
                    return resolve( com );
                });
            })
        });          
    },

    _deleteComponents: function( components ){
        var self = this;
        var savePath = this.get('path');

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

    // _deleteComponent: function( component, options ){
    //     var self = this;
    //     var schema = this.getRegistry().schemaRegistry.get( component.schemaUri, null, {full:true} );

    //     return new Promise( function(resolve, reject){
    //         var path = self._componentPath( component );
            
    //         Fs.exists( path, function(exists){
    //             if( !exists ){
    //                 return resolve( component );
    //             }

    //             return Fs.unlinkAsync( path )
    //                 .then( function(){
    //                     return component;
    //                 });
    //         });
    //     });
    // },


    // _retrieveEntity: function( entity, options ){
    //     var entity;
    //     var path;

    //     if( !entity || _.isString(entity) && entity.indexOf(TEMP_ENTITY_PREFIX) === 0 ){
    //         entity = Entity.create( (++this._entityCount), this.id );
    //     } else {
    //         entity = Entity.toEntity( entity );
    //         entity.setEntitySetId( this.id );
    //     }

    //     path = this._entityPath( entity );

    //     Sh.mkdir('-p', Path.dirname(path) );

    //     log.debug('writing entity to ' + path );
    //     return Fs.writeFileAsync( path, JSON.stringify( entity ) )
    //         .then( function(){
    //             log.debug('retrieved entity ' + entity.getEntityId() + ' ' + entity.getEntitySetId() ); 
    //             return entity;
    //         })
    // },

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
    _addComponent: function( component, options ){
    },


    _removeComponent: function( component, options ){
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
        var schema = this.getRegistry().schemaRegistry.get( component.schemaUri, null, {full:true} );
        var path = Path.join( this.get('path'), 'c', schema.hash  );
        return Path.join( path, component.id + '.json'  );
    },

    _entityPath: function( entityId ){
        entityId = Entity.isEntity(entityId) ? entityId.id : entityId;
        return Path.join( this.get('path'), 'e', entityId + '.json'  );
    },

    // returns the path to the entity index
    _entityIndexPath: function(){
        return Path.join( this.get('path'), 'e', 'index.json' );
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

function isTempId( entityId ){
    if( !entityId || (_.isString(entityId) && entityId.indexOf(TEMP_ENTITY_PREFIX) === 0) ){
        return true;
    }
    return false;
}


FileSystemEntitySet.isFileSystemEntitySet = function(es){
    return ( es && _.isObject(es) && es instanceof FileSystemEntitySet );
}

FileSystemEntitySet.create = function( options ){
    var result;
    var tmpDir = Sh.tempdir();

    options || (options={});

    options = _.extend( {
        path: Path.join( tmpDir, 'fsEs_' + options.id )
    }, options );

    result = new FileSystemEntitySet( options );
    
    // printVar( result );

    return result;
}

module.exports = FileSystemEntitySet;