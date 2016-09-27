'use strict';

import _ from 'underscore';
import BitField from 'odgn-bitfield';
import {Collection} from 'odgn-backbone-model';
let Component = require('../component');
import Entity from '../entity';
let EntityFilter = require('../entity_filter');
let Errors = require('../error');

import {entityToString} from '../util/to_string';
import * as Utils from '../util';
import SyncCmdBuffer from './sync';
import {
    CMD_ENTITY_ADD,
    CMD_ENTITY_REMOVE,
    CMD_ENTITY_UPDATE,
    CMD_COMPONENT_ADD,
    CMD_COMPONENT_REMOVE,
    CMD_COMPONENT_UPDATE,
    OP_CREATE_FROM_EXISTING_ID,
    OP_CREATE_NEW,
    OP_UPDATE_EXISTING,
} from './sync';


export default class AsyncCmdBuffer extends SyncCmdBuffer {
    constructor(...args){
        super(args);
    }
    
    reset(){
        super.reset();
        // store references to entities that exist during operations
        this._entityCache = new Collection();
    }

    /**
    * Adds a component to this set
    */
    addComponent( entitySet, component, options = {}){
        let debug, batch, execute, silent, listenTo, entityId, entity, existingCom;
        
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

            return _.reduce( component, (current, com) => {
                return current.then( () => this.addComponent(entitySet, com, options) );
            }, Promise.resolve() )
                .then( () => {
                    if( !execute ){ return this; }
                    return this.execute( entitySet, options )
                        .then( () => Utils.valueArray(this.componentsAdded.models) );
                });
        } else {
            if( execute ){ this.reset(); }
        }

        // log.debug('consider component ' + JSON.stringify(component) );

        // determine whether we have this component registered already
        entityId = component.getEntityId();

        let initial;

        // first create or retrieve an entity container for the component
        return this._packageEntityId( entitySet, entityId )
            .then( entity => {
                let commandOptions = _.extend( {}, options, {entity:entity, id:entity.id, mode:entity._mode} );
                if( entity._mode === OP_CREATE_NEW ||
                    entity._mode === OP_CREATE_FROM_EXISTING_ID ){
                        this.addCommand( CMD_ENTITY_ADD, entity.id, commandOptions );
                }

                if( entity.hasComponent(component) ){
                    this.addCommand( CMD_COMPONENT_UPDATE, component, commandOptions );
                } else {
                    this.addCommand( CMD_COMPONENT_ADD, component, commandOptions );
                }
                entity.addComponent( component );
            })
            .then( () => {
                // execute any outstanding commands
                if( execute ){
                    return this.execute( entitySet, options )
                        .then( () => Utils.valueArray( 
                                this.componentsAdded.models.concat(this.componentsUpdated.models) ) )
                }
                return [];
            })

    }


    /**
    *   Returns an entity wrapper for the given entity id which will be
    * passed
    */
    _packageEntityId( entitySet, entityId ){
        let entity;
        let getEntityOptions = { componentBitFieldOnly: true };
        const registry = entitySet.getRegistry();

        // no entity id was provided
        if( !entityId ){
            entity = this._entityCache.get(0);
            if( !entity ){
                entity = this._createHolderEntity( registry, 0, OP_CREATE_NEW );
            }
            return Promise.resolve( entity );
        }

        // console.log('get es id', entitySet.id, 'from', entityId, Utils.getEntitySetIdFromId(entityId));
        if( Utils.getEntitySetIdFromId(entityId) === entitySet.id ){
            if( (entity = this._entityCache.get(entityId)) ){
                // cached entity found previously
                return Promise.resolve(entity);
            }
            
            return entitySet.getEntity( entityId, getEntityOptions )
                .then( (entity) => {
                    let bf = entity.getComponentBitfield();
                    // dupe the entity bitfield, so we have an idea of it's original state
                    entity._mode = OP_UPDATE_EXISTING;
                    entity._ocomBf = BitField.create(bf);
                    // entity found, store in cache for successive queries
                    this._entityCache.add(entity);
                    return entity;
                })
                .catch( (err) => {
                    // entity does not exist, create holder entity
                    // with id
                    entity = this._createHolderEntity( registry, entityId, OP_CREATE_FROM_EXISTING_ID, entityId );
                    return entity;
                });
        } else {
            if( (entity = this._entityCache.get(entityId)) ){
                return Promise.resolve(entity);
            }
            // entity does not belong to this ES - create new entity with a new id
            entity = this._createHolderEntity( registry, entityId, OP_CREATE_NEW );
            this._entityCache.add(entity);
            return Promise.resolve( entity );
        }
    }




    /**
    *   addEntityId - the id that should be used to add to this entityset
    */
    _createHolderEntity( registry, existingId, mode, addEntityId ){
        let entityId = _.isUndefined(existingId) ? 0 : existingId;
        let entity = registry.createEntityWithId( entityId );
        entity._addId = _.isUndefined(addEntityId) ? 0 : addEntityId;
        entity._mode = mode;
        // entity.set({mode:mode,addId:addEntityId});
        this._entityCache.add(entity);
        return entity;
    }


    /**
    *
    */
    removeComponent( entitySet, component, options ){
        let batch,execute, debug, entityId;
        let getEntityOptions = { componentBitFieldOnly: true };
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

            return _.reduce( component,
                (current,com) => current.then(() => this.removeComponent(entitySet, com, options))
            , Promise.resolve() )
                .then( () => {
                    if( execute ){
                        return this.execute( entitySet, options );
                    }
                    return this;
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

        return entitySet.getEntity( entityId, getEntityOptions )
            .then( entity => {
                let commandOptions = _.extend( {}, options, {entity:entity, id:entity.id, mode:0} );
                this.addCommand( CMD_COMPONENT_REMOVE, component, commandOptions );
                if( !execute ){
                    return this;
                }
                
                return this.execute( entitySet, options )
                    .then( () => Utils.valueArray(this.componentsRemoved.models) );
            })
            .catch( err => {
                log.error('err removing notfound ' + Utils.getEntitySetIdFromId(entityId) + ' ' + entityId + ' ' + err );
                log.error( err.stack );
                // entity doesn't exist
                return execute ? [] : this;
            })

        // if( debug ){ log.debug('removing component from entity ' + component.getEntityId() ); }
        // this.addCommand( CMD_COMPONENT_REMOVE, component, options );

        // // execute any outstanding commands
        // if( execute ){
        //     return this.execute( entitySet, options )
        //         .then( function(){
        //             return Utils.valueArray( this.componentsRemoved.models );
        //         });
        // }

        // return this;
    }


    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity( entitySet, entity, options){
        let entityId, entitySetId;
        let batch;
        let execute;
        let addOptions = {batch: true, execute: false};

        options || (options={});
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;


        if( _.isArray(entity) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;
            }

            this.reset();

            return _.reduce( entity,
                (current,ine) => current.then( () => this.addEntity(entitySet, ine, options) )
            , Promise.resolve() )
                .then( () => {
                    if( !execute ){ return this; }

                    return this.execute( entitySet, options )
                        .then(() => Utils.valueArray(this.entitiesAdded.models));
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Entity.isEntity(entity) ){
            throw new Errors.InvalidEntityError('entity instance not passed');
        }

        return this.addComponent( entitySet, entity.getComponents(), _.extend({},options,addOptions) )
            .then( () => {
                if( !execute ){
                    // log.debug('completed e addC');
                    // printE( entity );
                    return this;
                }

                // execute any outstanding commands
                return this.execute( entitySet, options )
                    .then( () => {
                        // printIns( this.entitiesUpdated );
                        return Utils.valueArray( 
                            this.entitiesAdded.models.concat( this.entitiesUpdated.models ) );
                    });
            });
    }

    flush( entitySet, options={} ){
        return this.execute( entitySet, options )
            .then( () => this );
    }

    /**
    *
    */
    removeEntity( entitySet, entity, options={}){
        let ii, batch, execute, existingEntity, entityId;
        let executeOptions;
        let removeOptions = {batch: true, execute: false};

        if( !entity ){
            return this;
        }

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

            return _.reduce( entity, (current, ine) => {
                return current.then( () => self.removeEntity(entitySet, ine) )
            }, Promise.resolve() )
                .then( () => {
                    if( execute ){
                        return this.execute( entitySet, options );
                    }
                    return this;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Entity.isEntity(entity) ){
            throw new Errors.InvalidEntity('entity instance not passed');
        }


        return this.removeComponent( entitySet, entity.getComponents(), _.extend({},options,removeOptions) )
            .then( () => {
                // execute any outstanding commands
                if( execute ){
                    return this.execute( entitySet, options )
                        .then( () => Utils.valueArray(this.entitiesRemoved.models) );
                }
                return this;        
            });
    }

    execute( entitySet, options ){
        let cmds, entityId;
        let silent;
        let debug;

        debug = this.debug || options.debug;
        silent = options.silent === undefined ? false : options.silent;
        
        return _.keys(this.cmds).reduce( (sequence, entityId) => {
            let cmds = this.cmds[ entityId ];
            
            return sequence.then( () => {
                
                // iterate through each cmd for the entity
                cmds.forEach( (cmd) => {

                    let component = cmd[1];
                    let cmdOptions = cmd[2];
                    let entity = cmdOptions.entity;
                    let mode = cmdOptions.mode;
                    let entityChanged = false;

                    switch( cmd[0] ){
                        case CMD_ENTITY_ADD:
                            this.entitiesAdded.add( entity );
                            
                            if( debug ){ 
                                log.debug('cmd: adding entity ' + 
                                    entity.getEntityId() + '/' + entity.cid + '/' + entity.getEntitySetId() ); 
                            }
                            break;

                        case CMD_COMPONENT_ADD:
                            entity.addComponent( component );
                            if( !this.entitiesAdded.get(entity) ){
                                this.entitiesUpdated.add(entity);
                            }
                            
                            this.componentsAdded.add( component );
                            break;

                        case CMD_COMPONENT_UPDATE:
                            entity.addComponent( component );
                            if( !this.entitiesAdded.get(entity) ){
                                this.entitiesUpdated.add(entity);
                            }
                            this.componentsUpdated.add(component);
                            break;

                        case CMD_COMPONENT_REMOVE:
                            // no entity to remove from?
                            // if(debug ){ log.debug('removing component ' + JSON.stringify(component) ); }
                            if( !entity ){
                                return;
                            }

                            this.componentsRemoved.add( component );
                            // log.debug('remove com ' + entity.hasComponents() + ' ' + entity.getComponentBitfield().toString() );
                            entity.removeComponent( component );
                            // if( (!entitySet.allowEmptyEntities || removeEmptyEntity) && !entity.hasComponents() ){
                            if( !entity.hasComponents() ){
                                this.entitiesRemoved.add(entity);
                                this.entitiesUpdated.remove( entity );
                            } else {
                                this.entitiesUpdated.add(entity);
                            }
                            break;
                    }
                });
            });

        }, Promise.resolve() )
        .then( () => {
            let entity;

            if( debug ){
                this.debugLog();
            }

            // save the new entities
            return entitySet.update( 
                this.entitiesAdded.models, 
                this.entitiesUpdated.models, 
                this.entitiesRemoved.models, 
                this.componentsAdded.models,
                this.componentsUpdated.models,
                this.componentsRemoved.models )
                .then( updateResult => {
                    if( updateResult.entitiesAdded ){
                        this.entitiesAdded.set( updateResult.entitiesAdded ); }
                    if( updateResult.entitiesUpdated ){
                        this.entitiesUpdated.set( updateResult.entitiesUpdated ); }
                    if( updateResult.entitiesRemoved ){
                        this.entitiesRemoved.set( updateResult.entitiesRemoved ); }
                    if( updateResult.componentsAdded ){ 
                        this.componentsAdded.set( updateResult.componentsAdded ); }
                    if( updateResult.componentsUpdated ){ 
                        this.componentsUpdated.set( updateResult.componentsUpdated ); }
                    if( updateResult.componentsRemoved ){ 
                        this.componentsRemoved.set( updateResult.componentsRemoved ); }
                    if( updateResult && !_.isUndefined(updateResult.silent) ){
                        silent = updateResult.silent;
                    }

                    if( !silent ){
                        this.triggerEvents( entitySet );
                    }
                    return this;
                });
        });
    }

    isTempId( entityId ){
        if( !entityId || (_.isString(entityId) && entityId.indexOf(TEMP_ENTITY_PREFIX) === 0) ){
            return true;
        }
        return false;
    }


}

// CmdBuffer.create = function(){
//     let result = new CmdBuffer();
//     result.reset();
//     return result;
// }

// module.exports = CmdBuffer;