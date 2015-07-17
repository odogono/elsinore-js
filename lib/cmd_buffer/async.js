'use strict';

var _ = require('underscore');
var Backbone = require('backbone');

var BitField = require('../bit_field');
var Component = require('../component');
var Entity = require('../entity');
var EntityFilter = require('../entity_filter');
var Errors = require('../error');
var Utils = require('../utils');

var SyncCmdBuffer = require('./sync');


function CmdBuffer(){
}

var superReset = SyncCmdBuffer.prototype.reset;

_.extend( CmdBuffer.prototype, SyncCmdBuffer.prototype, {

    reset: function(){
        superReset.apply(this,arguments);
        // store references to entities that exist during operations
        this._entityCache = new Backbone.Collection(); //Utils.clearMap( this._entityCache );
    },

    /**
    * Adds a component to this set
    */
    addComponent: function( entitySet, component, options){
        var self = this, debug, batch, execute, silent, listenTo, entityId, entity, existingCom;
        
        options = (options || {});
        debug = options.debug;
        silent = options.silent;
        entity = options.entity;
        listenTo = options.listen;
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component ){
            return [];
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
                    return self.addComponent( entitySet, com, options );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( !execute ){ return self; }
                    return self.execute( entitySet, options )
                        .then( function(){
                            return Utils.valueArray( self.componentsAdded.models );
                        });
                });
        } else {
            if( execute ){ this.reset(); }
        }

        // log.debug('consider component ' + JSON.stringify(component) );

        // determine whether we have this component registered already
        entityId = component.getEntityId();

        var initial;

        // first create or retrieve an entity container for the component
        return self._packageEntityId( entitySet, entityId )
            .then( function(entity){
                var commandOptions = _.extend( {}, options, {entity:entity, id:entity.id, mode:entity._mode} );
                if( entity._mode === SyncCmdBuffer.OP_CREATE_NEW ||
                    entity._mode === SyncCmdBuffer.OP_CREATE_FROM_EXISTING_ID ){
                    self.addCommand( SyncCmdBuffer.CMD_ENTITY_ADD, entity.id, commandOptions );
                }

                if( entity.hasComponent(component) ){
                    self.addCommand( SyncCmdBuffer.CMD_COMPONENT_UPDATE, component, commandOptions );
                } else {
                    self.addCommand( SyncCmdBuffer.CMD_COMPONENT_ADD, component, commandOptions );
                }
                entity.addComponent( component );
            })
            .then(function(){
                // execute any outstanding commands
                if( execute ){
                    return self.execute( entitySet, options )
                        .then( function(){
                            return Utils.valueArray( 
                                self.componentsAdded.models.concat(self.componentsUpdated.models) );
                        })
                }
                return [];
            })

    },


    /**
    *   Returns an entity wrapper for the given entity id which will be
    * passed
    */
    _packageEntityId: function( entitySet, entityId ){
        var entity;
        var self = this;
        var getEntityOptions = { componentBitFieldOnly: true };

        // no entity id was provided
        if( !entityId ){
            entity = this._entityCache.get(0);
            if( !entity ){
                entity = self._createHolderEntity( 0, SyncCmdBuffer.OP_CREATE_NEW );
            }
            return Promise.resolve( entity );
        }

        if( Utils.getEntitySetIdFromId(entityId) === entitySet.id ){
            if( (entity = this._entityCache.get(entityId)) ){
                // cached entity found previously
                return Promise.resolve(entity);
            }
            
            return entitySet.getEntity( entityId, getEntityOptions )
                .then( function(entity){
                    var bf = entity.getComponentBitfield();
                    // dupe the entity bitfield, so we have an idea of it's original state
                    entity._mode = SyncCmdBuffer.OP_UPDATE_EXISTING;
                    entity._ocomBf = BitField.create(bf);
                    // entity found, store in cache for successive queries
                    self._entityCache.add(entity);
                    return entity;
                })
                .catch( function(err){
                    // entity does not exist, create holder entity
                    // with id
                    entity = self._createHolderEntity( entityId, SyncCmdBuffer.OP_CREATE_FROM_EXISTING_ID, entityId );
                    return entity;
                });
        } else {
            // log.debug('here ' + entityId + ' ' + entitySet.id );
            // entity does not belong to this ES - create new entity with a new id
            entity = self._createHolderEntity( entityId, SyncCmdBuffer.OP_CREATE_NEW );
            return Promise.resolve( entity );
        }
    },




    /**
    *   addEntityId - the id that should be used to add to this entityset
    */
    _createHolderEntity: function( existingId, mode, addEntityId ){
        var entityId = _.isUndefined(existingId) ? 0 : existingId;
        var entity = Entity.create( entityId );
        entity._addId = _.isUndefined(addEntityId) ? 0 : addEntityId;
        entity._mode = mode;
        // entity.set({mode:mode,addId:addEntityId});
        this._entityCache.add(entity);
        return entity;
    },


    /**
    *
    */
    removeComponent: function( entitySet, component, options ){
        var batch,execute, debug, entityId;
        var self = this;
        var getEntityOptions = { componentBitFieldOnly: true };
        options || (options = {});

        debug = options.debug;
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component ){ return this; }

        // handle an array of components
        if( _.isArray(component) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }

            this.reset();

            return _.reduce( component, function(current, com){
                return current.then(function(){
                    return self.removeComponent( entitySet, com, options );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options );
                    }
                    return self;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        entityId = component.getEntityId();

        if( !entityId || Utils.getEntitySetIdFromId(entityId) !== entitySet.id ){
            log.debug('entity ' + entityId + ' does not exist in es ' + entitySet.id + ' (' + Utils.getEntitySetIdFromId(entityId) + ')' );
            return Promise.resolve([]);
        }

        // log.debug('removing ' + JSON.stringify(component) + ' ' + component.getEntityId() );

        return entitySet.getEntity( entityId, getEntityOptions )
            .then( function(entity){
                // log.debug('ok got entity ' + entityId + ' ' + entity.id );
                var commandOptions = _.extend( {}, options, {entity:entity, id:entity.id, mode:0} );
                self.addCommand( SyncCmdBuffer.CMD_COMPONENT_REMOVE, component, commandOptions );
                if( !execute ){
                    return self;
                }
                
                return self.execute( entitySet, options )
                    .then( function(){
                        return Utils.valueArray( self.componentsRemoved.models );
                    });
            })
            .catch( function(err){
                log.debug('removing notfound ' + Utils.getEntitySetIdFromId(entityId) + ' ' + entityId + ' ' + err );
                // entity doesn't exist
                return execute ? [] : self;
            })

        // if( debug ){ log.debug('removing component from entity ' + component.getEntityId() ); }
        // this.addCommand( SyncCmdBuffer.CMD_COMPONENT_REMOVE, component, options );

        // // execute any outstanding commands
        // if( execute ){
        //     return self.execute( entitySet, options )
        //         .then( function(){
        //             return Utils.valueArray( self.componentsRemoved.models );
        //         });
        // }

        // return self;
    },


    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity: function( entitySet, entity, options){
        var self = this;
        var entityId, entitySetId;
        var batch;
        var execute;
        var addOptions = {batch: true, execute: false};

        options || (options={});
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;


        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if( _.isArray(entity) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;
            }

            this.reset();

            return _.reduce( entity, function(current, ine){
                return current.then(function(){
                    return self.addEntity( entitySet, ine );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options )
                            .then( function(){
                                return Utils.valueArray( self.entitiesAdded.models );
                            })
                    }
                    return self;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Entity.isEntity(entity) ){
            throw new Errors.InvalidEntity('entity instance not passed');
        }

        // does this entity exist in our es?
        // entity = Entity.toEntity( entity );
        // entityId = entity.id;// entity.getEntityId(); //Entity.toEntityId( entity );
        // entitySetId = entity.getEntitySetId();
        // log.debug('addEntity ' + entity.getEntityId() + '/' + entity.getEntitySetId() + '/' + entityId );
        // retrieve the existing entity

        return self.addComponent( entitySet, entity.getComponents(), _.extend({},options,addOptions) )
            .then( function(){
                // execute any outstanding commands
                if( execute ){
                    return self.execute( entitySet, options )
                        .then( function(){
                            // printIns( self.entitiesUpdated );
                            return Utils.valueArray( 
                                self.entitiesAdded.models.concat( self.entitiesUpdated.models ) );
                        });
                }
                return self;        
            });

        // return _.reduce( entity.getComponents(), function(current,com){
        //     return current.then(function(){
        //         return self.addComponent(com);
        //     });
        // }, Promise.resolve() )
        // .then( function(){

        // })

        // return entitySet.getEntity( entityId )
        //     .then( 
        //         function existingEntityFound(entity){
        //             log.debug('entity existing');
        //         }, 
        //         function existingEntityNotfound(){
        //             var comDefId;
                    
        //             self.addCommand( SyncCmdBuffer.CMD_ENTITY_ADD, entityId, options );
        //             // no existing entity - just add all the components
        //             for( comDefId in entity.components ){
        //                 self.addCommand( SyncCmdBuffer.CMD_COMPONENT_ADD, entity.components[comDefId], options );
        //             }
        //         })
        //     .then( function(){
        //         // execute any outstanding commands
        //         if( execute ){
        //             // log.debug('>-- ' + execute)
        //             return self.execute( entitySet, options )
        //                 .then( function(){
        //                     // printIns( self.entitiesUpdated );
        //                     return Utils.valueArray( 
        //                         _.values(self.entitiesAdded).concat( _.values(self.entitiesUpdated) ) );
        //                 });
        //         }
                
        //         return self;        
        //     });
    },

    /**
    *
    */
    removeEntity: function( entitySet, entity, options){
        var i, batch, execute, existingEntity, entityId;
        var executeOptions;
        var self = this;
        var removeOptions = {batch: true, execute: false};

        if( !entity ){
            return this;
        }

        options = (options || {});

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

            this.reset();

            return _.reduce( entity, function(current, ine){
                return current.then(function(){
                    return self.removeEntity( entitySet, ine );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options );
                    }
                    return self;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Entity.isEntity(entity) ){
            throw new Errors.InvalidEntity('entity instance not passed');
        }


        return self.removeComponent( entitySet, entity.getComponents(), _.extend({},options,removeOptions) )
            .then( function(){
                // execute any outstanding commands
                if( execute ){
                    return self.execute( entitySet, options )
                        .then( function(){
                            return Utils.valueArray( self.entitiesRemoved.models );
                        });
                }
                return self;        
            });


        // // does this entity exist in our es?
        // entity = Entity.toEntity( entity );
        // entityId = entity.id;

        // // retrieve the existing entity
        // return entitySet.getEntity( entityId )
        //     .then( function existingEntityFound(entity){
        //         var comDefId;

        //         for( comDefId in entity.components ){
        //             self.addCommand( SyncCmdBuffer.CMD_COMPONENT_REMOVE, entity.components[comDefId] );
        //         }
        //         return entity;
        //     }, function existingEntityNotfound(){
        //         throw new Error('entity ' + entityId + ' not found' );
        //     })
        //     .then( function(){
        //         if( execute ){
        //             return self.execute( entitySet, options );
        //         } 
        //         return self;        
        //     });
    },

    execute: function( entitySet, options ){
        var cmds, entityId;
        var self = this;
        var silent;
        var removeEmptyEntity;
        var debug;
        
        removeEmptyEntity = options.removeEmptyEntity;   
        debug = this.debug || options.debug;
        silent = options.silent === undefined ? false : options.silent;
        
        // log.debug('>>EXECUTING CMDS');// throw new Error('STOP');
        // printIns( this.cmds );
        // log.debug('go keys ' + _.keys(this.cmds) );
        return _.keys(this.cmds).reduce( function(sequence, entityId){
            var cmds = self.cmds[ entityId ];
            
            return sequence.then( function(){
                // var addedEntities = new Backbone.Collection();
                
                // iterate through each cmd for the entity
                cmds.forEach( function(cmd){

                    var component = cmd[1];
                    var cmdOptions = cmd[2];
                    var entity = cmdOptions.entity;
                    var mode = cmdOptions.mode;
                    var entityChanged = false;
                    
                    // log.debug('here? ' + JSON.stringify(cmdOptions) );

                    // if( true || debug ){ log.debug('executing cmd for entity ' + entity.getEntityId() + '/' + entity.cid + '/' + entity.id ); }
                    // log.debug('exec cmd ' + entity.id + ' ' + entity.getComponentBitfield().toString());

                    switch( cmd[0] ){
                        case SyncCmdBuffer.CMD_ENTITY_ADD:
                            self.entitiesAdded.add( entity );
                            
                            if( debug ){ 
                                log.debug('cmd: adding entity ' + 
                                    entity.getEntityId() + '/' + entity.cid + '/' + entity.getEntitySetId() ); 
                            }
                            break;

                        case SyncCmdBuffer.CMD_COMPONENT_ADD:
                            entity.addComponent( component );
                            
                            if( !self.entitiesAdded.get(entity.cid) ){
                                self.entitiesUpdated.add(entity);
                            }
                            
                            self.componentsAdded.add( component );
                            break;

                        case SyncCmdBuffer.CMD_COMPONENT_UPDATE:
                            entity.addComponent( component );
                            if( !self.entitiesAdded.get(entity.cid) ){
                                self.entitiesUpdated.add(entity);
                            }
                            self.componentsUpdated.add(component);
                            break;

                        case SyncCmdBuffer.CMD_COMPONENT_REMOVE:
                            // no entity to remove from?
                            if( debug ){ log.debug('removing component ' + JSON.stringify(component) ); }
                            if( !entity ){
                                return;
                            }

                            self.componentsRemoved.add( component );
                            entity.removeComponent( component );
                            // log.debug('remove com ' + entity.hasComponents() + ' ' + entity.getComponentBitfield().toString() );

                            if( (!entitySet.allowEmptyEntities || removeEmptyEntity) && !entity.hasComponents() ){
                                self.entitiesRemoved.add(entity);
                                self.entitiesUpdated.remove( entity );
                            } else {
                                self.entitiesUpdated.add(entity);
                            }
                            break;
                    }
                });
            });

        }, Promise.resolve() )
        .then( function(){
            var i,len;
            var entity;

            if( debug ){
                self.debugLog();
            }

            // save the new entities
            return entitySet.update( 
                self.entitiesAdded.models, 
                self.entitiesUpdated.models, 
                self.entitiesRemoved.models, 
                self.componentsAdded.models,
                self.componentsUpdated.models,
                self.componentsRemoved.models )
                .then( function(){
                    // log.debug('trigger events? ' + silent)
                    // self.debugLog();
                    if( !silent ){
                        self.triggerEvents( entitySet );
                    }
                    return self;
                });
        });
    },

    isTempId: function( entityId ){
        if( !entityId || (_.isString(entityId) && entityId.indexOf(TEMP_ENTITY_PREFIX) === 0) ){
            return true;
        }
        return false;
    }


});

CmdBuffer.create = function(){
    var result = new CmdBuffer();
    result.reset();
    return result;
}

module.exports = CmdBuffer;