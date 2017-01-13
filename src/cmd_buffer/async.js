'use strict';

import _ from 'underscore';
import BitField from 'odgn-bitfield';
import {Collection} from 'odgn-backbone-model';
import Component from '../component';
import Entity from '../entity';
import EntityFilter  from '../entity_filter';
import {
    InvalidEntityError
} from '../error';

import { getEntitySetIdFromId,
    valueArray} from '../util';
import {toString as entityToString} from '../util/to_string';


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
        execute = options.execute === void 0 ? true : options.execute;

        if( !component ){
            return [];
        }

        // handle an array of components
        if( Array.isArray(component) ){
            if( options.batch === void 0 ){
                options.batch = true;
                options.execute = false;
                if( execute !== false ){ execute = true; }
            }

            return Promise.all(_.map(component, c => this.addComponent(entitySet, c, options)))
                .then( () => {
                    if( !execute ){ return this; }
 
                    return this.execute( entitySet, options )
                        .then( () => valueArray( 
                                this.componentsAdded.models.concat(this.componentsUpdated.models) ) )
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
                .then( () => valueArray( 
                        this.componentsAdded.models.concat(this.componentsUpdated.models) ) )
        }
        return [];
    }



    /**
    *
    */
    removeComponent( entitySet, component, options={} ){
        let batch,execute, debug, entityId;
        const getEntityOptions = { componentBitFieldOnly: true };
        
        debug = options.debug;
        batch = options.batch; // cmds get batched together and then executed
        execute = options.execute === void 0 ? true : options.execute;

        if( !component ){ return this; }

        // handle an array of components
        if( Array.isArray(component) ){
            if( options.batch === void 0 ){
                options.batch = true;
                options.execute = false;
                if( execute !== false ){ execute = true; }
            }

            this.reset();

            return Promise.all(_.map(component, c => this.removeComponent(entitySet, c, options)))
                .then( () => {
                    if( execute ){
                        return this.execute(entitySet,options);
                    }
                    return this;
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        entityId = component.getEntityId();

        if( !entityId || getEntitySetIdFromId(entityId) !== entitySet.id ){
            log.debug('entity ' + entityId + ' does not exist in es ' + entitySet.id + ' (' + getEntitySetIdFromId(entityId) + ')' );
            return Promise.resolve([]);
        }

        this.addCommandX( CMD_COMPONENT_REMOVE, entityId, component);

        return (!execute) ? this : 
            this.execute(entitySet,options)
            .then( () => valueArray(this.componentsRemoved.models));
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
        execute = options.execute === void 0 ? true : options.execute;

        if( Array.isArray(entity) ){
            if( options.batch === void 0 ){
                options.batch = true;
                options.execute = false;
                if( execute !== false ){ execute = true; }
            }

            if( execute !== false ){ this.reset(); }

            return _.reduce( entity,
                (current,ine) => current.then( () => this.addEntity(entitySet, ine, options) )
            , Promise.resolve() )
                .then( () => {
                    if( !execute ){ return this; }
                    return this.execute( entitySet, options )
                        .then(() => valueArray(this.entitiesAdded.models));
                });
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Entity.isEntity(entity) ){
            throw new InvalidEntityError('entity instance not passed');
        }

        return this.addComponent( entitySet, entity.getComponents(), _.extend({},options,addOptions) )
            .then( () => {
                if( !execute ){ return this; }

                // execute any outstanding commands
                return this.execute( entitySet, options )
                    .then( () => {
                        return valueArray( 
                            this.entitiesAdded.models.concat( this.entitiesUpdated.models ) );
                    });
            });
    }

    /**
     * Executes any outstanding add/remove commands
     */
    flush( entitySet, options={} ){
        return this.execute( entitySet, options )
            .then( () => {
                this.reset();
                return this 
            });
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
        execute = options.execute === void 0 ? true : options.execute;
        executeOptions = _.extend( {}, options, {removeEmptyEntity:true} );

        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if( Array.isArray(entity) ){
            if( options.batch === void 0 ){
                options.batch = true;
                options.execute = false;
                if( execute !== false ){ execute = true; }
            }

            if( execute !== false ){ this.reset(); }

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
            throw new InvalidEntityError('entity instance not passed');
        }


        return this.removeComponent( entitySet, entity.getComponents(), _.extend({},options,removeOptions) )
            .then( () => {
                // execute any outstanding commands
                if( execute ){
                    return this.execute( entitySet, options )
                        .then( () => valueArray(this.entitiesRemoved.models) );
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
                // console.log('add entity', entity.id );
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
        let silent = options.silent === void 0 ? false : options.silent;

        // console.log('executing entities', _.keys(this.cmds), options );
        // _.each( this.cmds, cmd => console.log( cmd ) )

        // convert the incoming entity ids into entity instances which
        // have their bitfields resolved from the database, so that we
        // can easily test for component membership
        return entitySet.getEntitySignatures( _.keys(this.cmds) )
            .then( entities => {
                // console.log('we created entities', toString(entities));

                _.each( entities, entity => {
                    const bf = entity.getComponentBitfield();
                    let cmds = this.cmds[ entity.id ];
                    
                    if( entity.isNew() ){
                        this.entitiesAdded.add( entity );
                    }
                    else if( entity.getEntitySetId() != entitySet.id ){
                        this.entitiesAdded.add( entity );
                        // if(true){console.log('entity', entity.id,'does not exist in es', entitySet.id);}
                    }
                    else {
                        // if(debug){console.log('entity', entity.id,'exists in es', entitySet.id);}
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
                        if( updateResult && updateResult.silent !== void 0 ){
                            silent = updateResult.silent;
                        }

                        if( !silent ){
                            this.triggerEvents( entitySet );
                        }
                        return this;
                    }); 

            })

    }
}

AsyncCmdBuffer.prototype.type = 'AsyncCmdBuffer';
AsyncCmdBuffer.prototype.isAsyncCmdBuffer = true;

AsyncCmdBuffer.create = function(){
    let result = new AsyncCmdBuffer();
    result.reset();
    return result;
}