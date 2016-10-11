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
    CMD_EX,
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
        // entityId = component.getEntityId();

        this.addCommandX( CMD_COMPONENT_ADD, component.getEntityId(), component );

        // execute any outstanding commands
        if( execute ){
            return this.execute( entitySet, options )
                .then( () => Utils.valueArray( 
                        this.componentsAdded.models.concat(this.componentsUpdated.models) ) )
        }
        return [];

        
        // let initial;

        // // first create or retrieve an entity container for the component
        // return this._packageEntityId( entitySet, entityId )
        //     .then( entity => {
        //         let commandOptions = _.extend( {}, options, {entity:entity, id:entity.id, mode:entity._mode} );
        //         if( entity._mode === OP_CREATE_NEW ||
        //             entity._mode === OP_CREATE_FROM_EXISTING_ID ){
        //                 this.addCommand( CMD_ENTITY_ADD, entity.id, commandOptions );
        //         }

        //         if( entity.hasComponent(component) ){
        //             this.addCommand( CMD_COMPONENT_UPDATE, component, commandOptions );
        //         } else {
        //             this.addCommand( CMD_COMPONENT_ADD, component, commandOptions );
        //         }
        //         entity.addComponent( component );
        //     })
        //     .then( () => {
        //         // execute any outstanding commands
        //         if( execute ){
        //             return this.execute( entitySet, options )
        //                 .then( () => Utils.valueArray( 
        //                         this.componentsAdded.models.concat(this.componentsUpdated.models) ) )
        //         }
        //         return [];
        //     })

    }


    // /**
    // *   Returns an entity wrapper for the given entity id which will be
    // * passed
    // */
    // _packageEntityId( entitySet, entityId ){
    //     let entity;
    //     let getEntityOptions = { componentBitFieldOnly: true };
    //     const registry = entitySet.getRegistry();

        
    //     // no entity id was provided
    //     if( !entityId ){
    //         // this._entityCache.each( c => console.log('ecache',c.cid));
    //         entity = this._entityCache.get(0);
    //         if( !entity ){
    //             // console.log('no existing cache entity found for');
    //             entity = this._createHolderEntity( registry, 0, OP_CREATE_NEW );
    //         }
    //         return Promise.resolve( entity );
    //     }

    //     // console.log('get es id', entitySet.id, 'from', entityId, Utils.getEntitySetIdFromId(entityId));
    //     if( Utils.getEntitySetIdFromId(entityId) === entitySet.id ){
    //         if( (entity = this._entityCache.get(entityId)) ){
    //             // cached entity found previously
    //             return Promise.resolve(entity);
    //         }
            
    //         return entitySet.getEntityBitField( entityId )
    //             .then( comBf => {
    //                 const entity = registry.createEntityWithId(entityId, 0, {comBf});
    //                 // let bf = entity.getComponentBitfield();
    //                 // dupe the entity bitfield, so we have an idea of it's original state
    //                 entity._mode = OP_UPDATE_EXISTING;
    //                 // entity._ocomBf = BitField.create(bf);
    //                 // entity found, store in cache for successive queries
    //                 this._entityCache.add(entity);
    //                 return entity;
    //             })
    //             .catch( err => {
    //                 // entity does not exist, create holder entity
    //                 // with id
    //                 entity = this._createHolderEntity( registry, entityId, OP_CREATE_FROM_EXISTING_ID, entityId );
    //                 return entity;
    //             });
        
    //     } else {
    //         if( (entity = this._entityCache.get(entityId)) ){
    //             return Promise.resolve(entity);
    //         }
    //         // entity does not belong to this ES - create new entity with a new id
    //         entity = this._createHolderEntity( registry, entityId, OP_CREATE_NEW );
    //         this._entityCache.add(entity);
    //         return Promise.resolve( entity );
    //     }
    // }




    // /**
    // *   addEntityId - the id that should be used to add to this entityset
    // */
    // _createHolderEntity( registry, existingId, mode, addEntityId ){
    //     const entityId = _.isUndefined(existingId) ? 0 : existingId;
    //     const entity = registry.createEntityWithId( entityId );
    //     entity._addId = _.isUndefined(addEntityId) ? 0 : addEntityId;
    //     entity._mode = mode;
    //     // entity.set({mode:mode,addId:addEntityId});
    //     this._entityCache.add(entity);
    //     return entity;
    // }


    /**
    *
    */
    removeComponent( entitySet, component, options={} ){
        let batch,execute, debug, entityId;
        const getEntityOptions = { componentBitFieldOnly: true };
        
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

            return Promise.all(_.map(component, c => this.removeComponent(entitySet, c, options)))
                .then( () => {
                    if( execute ){
                        return this.execute(entitySet,options);
                    }
                    return this;
                });
            // return _.reduce( component,
            //     (current,com) => current.then(() => this.removeComponent(entitySet, com, options))
            // , Promise.resolve() )
            //     .then( () => {
            //         if( execute ){
            //             return this.execute( entitySet, options );
            //         }
            //         return this;
            //     });
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

        // this should be a quick check - without retrieving the full es
        // if( !entitySet.hasEntity(entityId) ){
        //     log.error(`entity ${entityId} not found`);
        //     return execute ? [] : this;
        // }

        // console.log('HERE remove', component.id, _.isArray(component.id) );
        this.addCommandX( CMD_COMPONENT_REMOVE, entityId, component);

        return (!execute) ? this : 
            this.execute(entitySet,options)
            .then( () => Utils.valueArray(this.componentsRemoved.models));

        // return entitySet.getEntity( entityId, getEntityOptions )
        //     .then( entity => {
        //         console.log('so adding REM', entity);
        //         const commandOptions = _.extend( {}, options, {entity:entity, id:entity.id, mode:0} );
        //         this.addCommand( CMD_COMPONENT_REMOVE, component, commandOptions );
        //         if( !execute ){
        //             return this;
        //         }
                
        //         return this.execute( entitySet, options )
        //             .then( () => Utils.valueArray(this.componentsRemoved.models) );
        //     })
        //     .catch( err => {
        //         log.error('err removing notfound ' + Utils.getEntitySetIdFromId(entityId) + ' ' + entityId + ' ' + err );
        //         log.error( err.stack );
        //         // entity doesn't exist
        //         return execute ? [] : this;
        //     });
    }


    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity( entitySet, entity, options={}){
        let entityId, entitySetId;
        let batch;
        let execute;
        let addOptions = {batch: true, execute: false};

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

    /**
     * 
     */
    _executeEntityCommand( entity, componentBitfield, cmdType, component, options={} ){
        const debug = this.debug || options.debug;
        // console.log('executing', entity.id, componentBitfield.toJSON(), cmdType, entity.isNew() );

        const componentDefId = component.getDefId();
        const entityHasComponent = !!componentBitfield.get(componentDefId);

        switch( cmdType ){
            case CMD_ENTITY_ADD:
                this.entitiesAdded.add( entity );
                
                // if( true ){ 
                //     console.log('cmd: adding entity ' + 
                //         entity.getEntityId() + '/' + entity.cid + '/' + entity.getEntitySetId() ); 
                // }
                break;
            case CMD_COMPONENT_ADD:
                // console.log('add component', componentDefId,'to', entity.id, component.getEntityId() );
                if( entityHasComponent ){
                    this.componentsUpdated.add(component);
                    this.entitiesUpdated.add(entity);
                } else {
                    entity.addComponent( component );
                    if( !this.entitiesAdded.get(entity) ){
                        this.entitiesUpdated.add(entity);
                        // console.log('entity', entity.id,'was not added, updating');
                    }
                    this.componentsAdded.add( component );
                }
                break;

            case CMD_COMPONENT_REMOVE:
                // console.log('component remove', componentDefId,'from',entity.id, entityHasComponent);
                if( !entityHasComponent ){ break; }
                
                this.componentsRemoved.add( component );

                // update the bitfield to remove the component
                componentBitfield.set( componentDefId, false );

                // if the bitfield is now empty, then we can remove the entity
                if( componentBitfield.count() <= 0 ){
                    this.entitiesRemoved.add(entity,{silent:true});
                    this.entitiesUpdated.remove(entity,{silent:true});
                    // console.log('add component to remove', JSON.stringify(component));
                } else {
                    this.entitiesUpdated.add(entity);
                }

                break;
        }
    }

    /**
     * 
     * execute resolves a list of cmds into more concrete instructions
     * 
     */
    execute( entitySet, options ){
        let cmds, entityId;
        let ii,len;

        const debug = this.debug || options.debug;
        let silent = _.isUndefined(options.silent) ? false : options.silent;

        // console.log('executing entities', _.keys(this.cmds), options );
        // _.each( this.cmds, cmd => console.log( cmd ) )

        // convert the incoming entity ids into entity instances which
        // have their bitfields resolved from the database, so that we
        // can easily test for component membership
        return entitySet.getEntitySignatures( _.keys(this.cmds) )
            .then( entities => {
                // console.log('we created entities', Utils.toString(entities));

                _.each( entities, entity => {
                    const bf = entity.getComponentBitfield();
                    let cmds = this.cmds[ entity.id ];
                    
                    if( entity.isNew() ){
                        this.entitiesAdded.add( entity );
                    }
                    else if( entity.getEntitySetId() != entitySet.id ){
                        this.entitiesAdded.add( entity );
                        if(debug){console.log('entity', entity.id,'does not exist in es', entitySet.id);}
                    }
                    else {
                        if(debug){console.log('entity', entity.id,'exists in es', entitySet.id);}
                    }

                    // console.log('executing cmds against new', entity.isNew(), entity.id );

                    for( ii=0,len=cmds.length;ii<len;ii++ ){
                        let cmd = cmds[ii];
                        let commandType = cmd[0];
                        let component = cmd[1];
                        let cmdOptions = cmd[2];

                        if( commandType == CMD_EX ){
                            commandType = cmd[1];
                            component = cmd[3];
                            cmdOptions = cmd[4];
                        }
                        this._executeEntityCommand( entity, bf, commandType, component, cmdOptions,options );
                    }
                });
                
                return entitySet.update( 
                    this.entitiesAdded.models, 
                    this.entitiesUpdated.models, 
                    this.entitiesRemoved.models, 
                    this.componentsAdded.models,
                    this.componentsUpdated.models,
                    this.componentsRemoved.models, options )
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

            })

        
        return _.keys(this.cmds).reduce( (sequence, entityId) => {
            let cmds = this.cmds[ entityId ];
            
            return sequence.then( () => {
                
                // iterate through each cmd for the entity
                cmds.forEach( cmd => {
                    let commandType = cmd[0];
                    let component = cmd[1];
                    let cmdOptions = cmd[2];
                    let entity = cmdOptions.entity;
                    let entityId = entity ? entity.id : 0;
                    let mode = cmdOptions.mode;
                    let entityChanged = false;

                    if( commandType == CMD_EX ){
                        cmd = _.rest(cmd); // remove first
                        commandType = cmd[0];
                        entityId = cmd[1];
                        component = cmd[2];
                        cmdOptions = cmd[3];
                        if(debug){console.log('cmdX', commandType, cmd[1], component, cmdOptions)}
                    }

                    switch( commandType ){
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
                            if(debug ){ log.debug('removing component ' + JSON.stringify(component),'from',entityId ); }
                            if( !entity ){
                                return;
                            }

                            // 1. the component will be removed from the entityset CMD_COMPONENT_REMOVE(cid)
                            // 2. the component will be removed from the entity CMD_COMPONENT_REMOVE_FROM_ENTITY(eid,cid)
                            // 3. if the entity has no more components, the entity is removed CMD_ENTITY_REMOVE(eid)
                            
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