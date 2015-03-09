'use strict';

var _ = require('underscore');
var Backbone = require('backbone');

var BitField = require('../bit_field');
var Component = require('../component');
var Entity = require('../entity');
var EntityFilter = require('../entity_filter');
var Utils = require('../utils');

var SyncCmdBuffer = require('./sync');


function CmdBuffer(){
}


_.extend( CmdBuffer.prototype, SyncCmdBuffer.prototype, {

    /**
    * Adds a component to this set
    */
    addComponent: function( entitySet, component, options){
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
                    return self.addComponent( entitySet, com, options );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options )
                            .then( function(){
                                return Utils.valueArray( self.componentsAdded );
                            })
                    }
                    return self;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        return new Promise( function(resolve, reject){
            // determine whether we have this component registered already
            entityId = component.getEntityId();

            if( !entityId ){
                // do we have a entity add in the queue already?
                entityId = self.findEntityAddId();

                if( entityId === -1 ){
                    entityId = entitySet._createEntityId(true);
                }
                component.setEntityId( entityId );
                return resolve(null);
            } else {
                // does this entity exist in our es?
                return entitySet.getEntity( entityId )
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

                self.addCommand( SyncCmdBuffer.CMD_ENTITY_ADD, entityId, options );
                self.addCommand( SyncCmdBuffer.CMD_COMPONENT_ADD, component, options );
            } else {
                var existingComponent = entitySet.getComponentFromEntity( component, entity );

                if( debug ){
                    log.debug('existing ' + component.hash() );
                }

                // does the existing entity have this component?
                if( !existingCom ){
                    self.addCommand( SyncCmdBuffer.CMD_COMPONENT_ADD, component, options );
                } else {
                    // is the existing component different?
                    self.addCommand( SyncCmdBuffer.CMD_COMPONENT_UPDATE, component, options );
                }
            }

            // execute any outstanding commands
            if( execute ){
                // if( debug ){ log.debug('executing cmd buffer'); }
                return self.execute( entitySet, options )
                    .then( function(){
                        return Utils.valueArray( self.componentsAdded );
                    })
            }
            return self;
        })
    },

    /**
    *
    */
    removeComponent: function( entitySet, component, options ){
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
                    return self.removeComponent( entitySet, com, options );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options );
                    }
                    return self;
                });
        }

        if( debug ){ log.debug('removing component from entity ' + component.getEntityId() ); }
        this.addCommand( SyncCmdBuffer.CMD_COMPONENT_REMOVE, component, options );

        // execute any outstanding commands
        if( execute ){
            return this.execute( entitySet, options );
        }

        return self;
    },


    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity: function( entitySet, entity, options){
        var self = this;
        var entityId;
        var batch;
        var execute;

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

            return _.reduce( entity, function(current, ine){
                return current.then(function(){
                    return self.addEntity( entitySet, ine );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options )
                            .then( function(){
                                return Utils.valueArray( self.entitiesAdded );
                            })
                    }
                    return self;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        // does this entity exist in our es?
        entity = Entity.toEntity( entity );
        entityId = Entity.toEntityId( entity );

        // retrieve the existing entity
        return entitySet.getEntity( entityId )
            .then( 
                function existingEntityFound(entity){
                    log.debug('entity existing');
                }, 
                function existingEntityNotfound(){
                    var comDefId;
                    self.addCommand( SyncCmdBuffer.CMD_ENTITY_ADD, entityId, options );
                    // no existing entity - just add all the components
                    for( comDefId in entity.components ){
                        self.addCommand( SyncCmdBuffer.CMD_COMPONENT_ADD, entity.components[comDefId], options );
                    }
                })
            .then( function(){
                // execute any outstanding commands
                if( execute ){
                    return self.execute( entitySet, options )
                        .then( function(){
                            return Utils.valueArray( self.entitiesAdded );
                        });
                }
                
                return self;        
            });
    },

    /**
    *
    */
    removeEntity: function( entitySet, entity, options){
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
                    return self.removeEntity( entitySet, ine );
                });
            }, Promise.resolve() )
                .then( function(){
                    if( execute ){
                        return self.execute( entitySet, options );
                    }
                    return self;
                });
        }

        // does this entity exist in our es?
        entity = Entity.toEntity( entity );
        entityId = Entity.toEntityId( entity );

        // retrieve the existing entity
        return entitySet.getEntity( entityId )
            .then( function existingEntityFound(entity){
                var comDefId;

                for( comDefId in entity.components ){
                    self.addCommand( SyncCmdBuffer.CMD_COMPONENT_REMOVE, entity.components[comDefId] );
                }
                return entity;
            }, function existingEntityNotfound(){
                throw new Error('entity ' + entityId + ' not found' );
            })
            .then( function(){
                if( execute ){
                    return self.execute( options );
                } 
                return self;        
            });
    },

    execute: function( entitySet, options ){
    // _executeCmdBuffer: function( cmdBuffer, options ){
        var cmds, entityId;
        var self = this;
        var silent;
        var removeEmptyEntity;
        var debug;

        if( options ){
            removeEmptyEntity = options.removeEmptyEntity;   
            debug = this.debug || options.debug;
            silent = options.silent;
        }

        return _.keys(this.cmds).reduce( function(sequence, entityId){
            var cmds = self.cmds[ entityId ];

            // resolve the incoming entity into an entity instance - either
            // existing or new
            return sequence.then( function(){
                // convert the entity id into an existing entity or a new one
                return entitySet._entityIdToEntity( entityId );
            })
            .then( function(entity){
                var entityId = entity.getEntityId();
                var tempEntity = self.isTempId( entityId );
                var addedEntities = {};
                if( debug ){ log.debug('executing cmds for entity ' + entity.getEntityId() + '/' + entity.cid + ' ' + (tempEntity?'temp':'') ); }

                // iterate through each cmd for the entity
                cmds.forEach( function(cmd){
                    var component = cmd[1];
                    var entityChanged = false;
                    switch( cmd[0] ){
                        case SyncCmdBuffer.CMD_ENTITY_ADD:
                            entity.setEntityId( entityId );
                            entity.set({'fs_existingId':entityId});
                            
                            self.entitiesAdded.push( entity ); //[ entity.cid ] = entity;
                            addedEntities[ entity.cid ] = entity;

                            if( debug ){ log.debug('cmd: adding entity ' + entity.getEntityId() + '/' + entity.cid ); }
                            break;

                        case SyncCmdBuffer.CMD_COMPONENT_ADD:
                            component.set({id: entitySet._createComponentId() });
                            // does entity have component already?
                            // is the component different?
                            entity.addComponent( component );
                            
                            self.componentsAdded.push( component );

                            if( !addedEntities[entity.cid] ){
                                if( entity.isNew() || entity.isTemp ){
                                    self.entitiesAdded.push( entity );
                                } else {
                                    self.entitiesUpdated[ entity.cid ] = entity;
                                }
                            }
                            if( debug ){ log.debug('cmd: add component ' + component.id + '/' + component.cid ); }
                            break;

                        case SyncCmdBuffer.CMD_COMPONENT_REMOVE:
                            // no entity to remove from?
                            if( debug ){ log.debug('removing component ' + JSON.stringify(component) ); }
                            if( !entity ){
                                return;
                            }
                            if( debug ){  log.debug('cmd: rem com ' + component.id + '/' + component.cid + ' ' + JSON.stringify(cmd[2]) ); }
                            entitySet.removeComponentFromEntity( component, entity );
                            self.componentsRemoved[ component.cid ] = component;

                            if( (!entitySet.allowEmptyEntities || removeEmptyEntity) && !entitySet.doesEntityHaveComponents( entity ) ){
                                self.entitiesRemoved[ entity.cid ] = entity;
                            } else {
                                self.entitiesUpdated[ entity.cid ] = entity;
                            }
                            break;
                    }
                });

                addedEntities = null;
            });

        }, Promise.resolve() )
        .then( function(){
            var i,len;
            var entity;

            if( debug ){
                self.debugLog();
            }
            
            // new components needs ids assigning at this point

            // save the new entities
            return entitySet._updateEntities( self.entitiesAdded )
                .then(function(){
                    return entitySet._updateEntities( self.entitiesUpdated );
                })
                .then(function(){
                    return entitySet.writeNewComponents( self.componentsAdded );
                })
                .then( function(){
                    return entitySet._deleteComponents( self.componentsRemoved );
                })
                .then( function(){
                    return entitySet._deleteEntities( self.entitiesRemoved );
                })
                .then( function(){
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