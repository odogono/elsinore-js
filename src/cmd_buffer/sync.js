import _ from 'underscore';
import Backbone from 'backbone';

import BitField  from 'odgn-bitfield';
import Component from '../component';
import Entity from '../entity';
import EntityFilter from '../entity_filter';
import * as Utils from '../util';
import {copyComponent} from '../util/copy';

export const CMD_ENTITY_ADD = 0;
export const CMD_ENTITY_REMOVE = 1;
export const CMD_ENTITY_UPDATE = 2;
export const CMD_COMPONENT_ADD = 3;
export const CMD_COMPONENT_REMOVE = 4;
export const CMD_COMPONENT_UPDATE = 5;


// the entity id is valid, but the entity does not yet exist
export const OP_CREATE_FROM_EXISTING_ID = 1;
// a new entity is being created
export const OP_CREATE_NEW = 2;
// an existing entity is being updated
export const OP_UPDATE_EXISTING = 3;



function CmdBuffer(){}


let functions = {

    /**
    * Adds a component to this set
    */
    addComponent: function( entitySet, component, options={}){
        let debug, batch, execute, silent, listenTo, entityId, entity, componentDef, componentArray, existingCom;
        let ii, len;
        let result;

        debug = options.debug;
        silent = options.silent;
        entity = options.entity;
        listenTo = options.listen;

        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component ){
            return this;
        }

        // if we have been passed an array, then batch all those commands together
        if( _.isArray(component) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }

            this.reset();

            for( ii in component ){
                this.addComponent( entitySet, component[ii], options );
            }
            
            if( execute ){
                this.execute( entitySet, options );
                result = Utils.valueArray( this.componentsAdded.models );
            }

            return result;
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Component.isComponent(component) ){
            throw new Error('argument is not component instance' );
        }
        
        // determine whether we have this component registered already
        entityId = Entity.getEntityId( component );

        // log.debug( 'adding component with entity ' + Entity.toEntityId(entityId) );

        if( !entityId ){
            // do we have a entity add in the queue already?
            entityId = this.findEntityAddId();
            if( entityId === -1 ){
                entityId = entitySet._createEntity(null, true);
                // log.debug( 'adding component with entity ' + entityId );
            }
        } else {
            // does this entity exist in our es?
            entity = entitySet.getEntity( entityId );
        }

        if( !entity ){
            this.addCommand( CMD_ENTITY_ADD, entityId, options );
            this.addCommand( CMD_COMPONENT_ADD, component, options );
        }
        else {
            existingCom = entitySet.getComponentFromEntity( component, entity );

            if( debug ){
                log.debug('existing ' + existingCom.hash() + ' vs new ' + component.hash() );
                log.debug('existing: ' + Utils.stringify(existingCom));
                log.debug('new: ' + Utils.stringify(component));
            }

            // does the existing entity have this component?
            if( !existingCom ){
                this.addCommand( CMD_COMPONENT_ADD, component, options );
            } else {
                // is the existing component different?
                this.addCommand( CMD_COMPONENT_UPDATE, component, options );
            }
        }

        // execute any outstanding commands
        if( execute ){
            this.execute( entitySet, options );
            result = Utils.valueArray( this.componentsAdded.models );
        }

        return result;
    },

    /**
    *
    */
    removeComponent: function( entitySet, component, options={} ){
        let batch,execute, debug;
        let executeOptions;
        let ii, result;
        
        debug = options.debug;
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;
        executeOptions = _.extend( {}, options, {removeEmptyEntity:true} );

        if( !component ){
            return [];
        }


        // if we have been passed an array, then batch all those commands together
        if( _.isArray(component) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }

            this.reset();

            for( ii in component ){
                this.removeComponent( entitySet, component[ii], options );
            }
            
            if( execute ){
                this.execute( entitySet, executeOptions );
                result = Utils.valueArray( this.componentsRemoved.models );
            }

            return result;
        } else {
            if( execute ){
                this.reset();
            }
        }

        this.addCommand( CMD_COMPONENT_REMOVE, component, options );

        // execute any outstanding commands
        if( execute ){
            this.execute( entitySet, executeOptions );
            result = Utils.valueArray( this.componentsRemoved.models );
        }

        return result;
    },


    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity: function( entitySet, entity, options={}){
        let isNew, entityId, existingEntity, debug, silent, ignoreComponents;
        let eBf, exBf, ii, len, comDefId, com;
        let addComponentOptions;
        let batch, execute;
        let result;
        
        if( !entity ){
            return null;
        }

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

            for( ii in entity ){
                this.addEntity( entitySet, entity[ii], options );
            }
            
            if( execute ){
                this.execute( entitySet, options );
                result = Utils.valueArray( this.entitiesAdded.models );
            }

            return result;
        } else {
            if( execute ){
                this.reset();
            }
        }

        if( !Entity.isEntity(entity) ){
            throw new Error('entity instance not passed');
        }

        // does this entity exist in our es?
        // entity = Entity.toEntity( entity );
        // entityId = Entity.toEntityId( entity );
        entityId = entity.getEntityId();
        existingEntity = entitySet.getEntity( entityId );

        
        if( !existingEntity ){
            // if( options.debug ) { log.debug('no existing entity add ' + entityId ); }
            // TODO : determine whether we should allow empty entities within the entity set
            if( !entitySet.allowEmptyEntities && !entitySet.doesEntityHaveComponents( entity ) ){
                return this;
            }

            this.addCommand( CMD_ENTITY_ADD, entityId, options );

            // no existing entity - just add all the components
            for( comDefId in entity.components ){
                this.addCommand( CMD_COMPONENT_ADD, entity.components[comDefId], options );
            }
        }
        else {
            if( options.debug ) { log.debug('existing entity adding'); }
            // entity already exists, determine whether components should be updated
            for( comDefId in entity.components ){
                if( existingEntity.components[comDefId] )
                    this.addCommand( CMD_COMPONENT_UPDATE, entity.components[comDefId], options );
                else
                    this.addCommand( CMD_COMPONENT_ADD, entity.components[comDefId], options );
            }
        }
        
        // execute any outstanding commands
        if( execute ){
            this.execute( entitySet, options );
            result = Utils.valueArray( this.entitiesAdded.models );
        }
        
        return result;
    },

    /**
    *
    */
    removeEntity: function( entitySet, entity, options={}){
        let ii, batch, comDefId, execute, existingEntity, entityId;
        let executeOptions;
        let result;

        if( !entity ){
            return null;
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

            for( ii in entity ){
                this.removeEntity( entitySet, entity[ii], options );
            }
            
            if( execute ){
                this.execute( entitySet, executeOptions );
                result = Utils.valueArray( this.entitiesRemoved.models );
            }

            return result;
        } else {
            if( execute ){
                this.reset();
            }
        }

        // does this entity exist in our es?
        entityId = Entity.toEntityId( entity );
        existingEntity = entitySet.getEntity( entityId );

        if( !existingEntity ){
            return null;
        }

        for( comDefId in existingEntity.components ){
            this.addCommand( CMD_COMPONENT_REMOVE, existingEntity.components[comDefId] );
        }

        // execute any outstanding commands
        if( execute ){
            this.execute( entitySet, executeOptions );
            result = Utils.valueArray( this.entitiesRemoved.models );
        }

        return result;
    },

    execute: function( entitySet, options ){
        let ii, len,entityId,cmds,cmd;
        let com, ocom, defId, isNew, cmdOptions, query;
        let entity, tEntity, component, registry;
        let removeEmptyEntity;
        let debug;
        let silent;

        if( options ){
            removeEmptyEntity = options.removeEmptyEntity;   
            debug = this.debug || options.debug;
            silent = options.silent;
        }
        
        registry = entitySet.getRegistry();
        
        // commands are associated with an entity
        for( entityId in this.cmds ){
            cmds = this.cmds[entityId];

            // if( debug ){ log.debug('executing for entity ' + entityId + ' ' + JSON.stringify(cmds)); }

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            entity = entitySet.getEntity( entityId );
            if( entity ){
                tEntity = registry.cloneEntity( entity );
                tEntity.setEntitySetId( entitySet.getEntitySetId() );
            }

            // go through the incoming commands
            for( ii=0,len=cmds.length;ii<len;ii++ ){
                cmd = cmds[ii];
                com = cmd[1];
                cmdOptions = cmd[2];

                switch( cmd[0] ){
                    // add an entity
                    case CMD_ENTITY_ADD:
                        if( !entity ){
                            // log.debug('create entity with ' + JSON.stringify(entityId) );
                            tEntity = entitySet._createEntity( entityId );
                        }
                        break;
                    case CMD_COMPONENT_ADD:
                        if( cmdOptions && cmdOptions.clone ){
                            com = copyComponent( registry, com );
                        }
                        if( !com.id ){
                            com.id = entitySet._createComponentId();
                            // log.debug('creating id for ' + com.id + ' ' + com.name );
                        }
                        tEntity.addComponent( com );
                        // log.debug('cmd: add com ' + com.id + ' ' + com.name + ' ' + JSON.stringify(cmd[2]) + ' to e:' + tEntity.id );
                        break;
                    case CMD_COMPONENT_REMOVE:
                        // no entity to remove from?
                        if( !entity ){
                            continue;
                        }
                        // if( true || debug ){ 
                            // log.debug('cmd: rem com ' + com.id + ' ' + JSON.stringify(com) ); 
                            // if( true ){ printE(tEntity); }
                        // }
                        entitySet.removeComponentFromEntity( com, tEntity );
                        break;
                    case CMD_COMPONENT_UPDATE:
                        // if( debug ){ log.debug('cmd: update com ' + JSON.stringify( com )); }
                        tEntity.addComponent( com );
                        break;
                }
            }


            // once all commands have applied to this temp entity, transform
            // it through any filters. If there is still a valid result, commit
            // it to the entitySet
            if( (query = entitySet.getQuery()) ){
                if( debug ) { log.debug('executing against filter ' + JSON.stringify(query) ); }
                tEntity = query.execute( tEntity );
                // printE( tEntity );
            }

            if( !tEntity ){
                // if the incoming entity did not clear the filter, and there is no existing
                // entity, then just continue to next cmd
                if( !entity ){
                    continue;
                }

                // if the incoming entity did not clear the filter, we should remove
                // the existing entity
                // remove all the entities components
                for( defId in entity.components ){
                    this.componentsRemoved.add( entity.components[defId] );
                }
                this.entitiesRemoved.add( entitySet._removeEntity(entity) );
                continue;
            }

            isNew = entity != null;
            if( !entity ){
                if( entitySet.doesEntityHaveComponents(tEntity) ){
                    entitySet._addEntity( tEntity );
                    // log.debug('add new entity ' + tEntity.id );
                    this.entitiesAdded.add( tEntity );
                } 
            }
            else {
                // determine which components need to be removed 
                for( defId in entity.components ){
                    // if( debug ) log.debug('b ' + defId );
                    if( !tEntity.components[defId] ){
                        com = entity.components[defId];
                        if( debug ){ log.debug('removing ' + defId + ' ' + JSON.stringify(com) ); }
                        entitySet.removeComponentFromEntity( com, entity );
                        this.componentsRemoved.add( com );
                        // printE( entity );
                    }
                }

                // if the entity has no more components, then remove it
                // if( debug ){ log.debug('so removeEmptyEntity is ' + (removeEmptyEntity?'true':'false')); }
                if( (!this.allowEmptyEntities || removeEmptyEntity) && !entitySet.doesEntityHaveComponents( entity ) ){
                    if( debug ){ log.debug('removing entity ' + entity.getEntityId() + '/' + entity.cid ); }
                    this.entitiesRemoved.add( entitySet._removeEntity(entity) );
                }
            }
            
            // apply this entity and its components to existing records
            for( defId in tEntity.components ){
                com = tEntity.components[defId];
                if( !entity ){
                    // because we have added the new entity, we only need to report what components
                    // were added
                    this.componentsAdded.add( com );
                }
                else if( !entity.components[defId] ){
                    // the existing entity does not have this component - add it
                    // log.debug('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
                    entity.addComponent( com );
                    this.componentsAdded.add( com );
                }
                else if( entity ){
                    ocom = entity.components[defId];
                    // the entity already has this entity - update it
                    if( !com.isEqual(ocom) ){
                        entity.addComponent( com );
                        this.componentsUpdated.add( com );
                    }
                    
                }
            }
        }
        
        if( debug ){
            this.debugLog();
        }

        if( !silent ){
            this.triggerEvents( entitySet, options );
        }

    },



    reset: function(){
        this.cmds = Utils.clearMap( this.cmds );
        this.entitiesAdded = Utils.clearCollection( this.entitiesAdded );
        this.entitiesUpdated = Utils.clearCollection( this.entitiesUpdated );
        this.entitiesRemoved = Utils.clearCollection( this.entitiesRemoved );

        this.componentsAdded = Utils.clearCollection( this.componentsAdded );
        this.componentsUpdated = Utils.clearCollection( this.componentsUpdated );
        this.componentsRemoved = Utils.clearCollection( this.componentsRemoved );
    },

    /**
    *   Adds a add/remove/update command to a buffer of commands
    */
    addCommand: function addCommand( type, arg/*entityId|component*/, options ){
        let entityId;
        let entityBuffer;

        options || (options={});

        switch( type ){
            case CMD_ENTITY_ADD:
                entityId = arg;
                // log.debug('addCommand.ENTITY ' + entityId + ' ' + JSON.stringify(options));
                break;
            case CMD_COMPONENT_ADD:
            case CMD_COMPONENT_REMOVE:
            case CMD_COMPONENT_UPDATE:
                entityId = options.id || arg.getEntityId();
                // log.debug('addCommand.COMPONENT (' + type + ') ' + entityId + ' ' + JSON.stringify(options) );
                break;
            default:
                // NO-OP
                return;
        }

        entityBuffer = this.cmds[ entityId ] || [];

        if( type == CMD_ENTITY_ADD ){
            // this command should always be the first in the list - check 
            if( entityBuffer.length > 0 && entityBuffer[0][0] == CMD_ENTITY_ADD ){
                return;
            }
            // add to top of list
            entityBuffer.unshift( [type,arg,options] );
        } else{
            entityBuffer.push( [type,arg,options] );
        }
        
        this.cmds[ entityId ] = entityBuffer;
        
        return this;
    },

    findEntityAddId: function(){
        let cmds;
        let entityId;

        for( entityId in this.cmds ){
            cmds = this.cmds[entityId];
            if( cmds[0][0] == CMD_ENTITY_ADD )
                return entityId;
        }

        return -1;
    },

    debugLog: function( logFn ){
        if( !logFn ){
            logFn = log.debug;
        }
        log.debug('entities added: ' + JSON.stringify( this.entitiesAdded.pluck('id') )); 
        log.debug('entities updated: ' + JSON.stringify( this.entitiesUpdated.pluck('id') )); 
        log.debug('entities removed: ' + JSON.stringify( this.entitiesRemoved.pluck('id') )); 

        log.debug('components added: ' + JSON.stringify( this.componentsAdded.pluck('id') )); 
        log.debug('components updated: ' + JSON.stringify( this.componentsUpdated.pluck('id') )); 
        log.debug('components removed: ' + JSON.stringify( this.componentsRemoved.pluck('id') ));
    },

    triggerEvents: function( source, options ){
        options = options || {};
        triggerEvent( source, 'component:change', this.componentsUpdated );
        triggerEvent( source, 'component:remove', this.componentsRemoved );
        triggerEvent( source, 'entity:remove', this.entitiesRemoved );
        triggerEvent( source, 'component:add', this.componentsAdded );
        triggerEvent( source, 'entity:change', this.entitiesUpdated );
        triggerEvent( source, 'entity:add', this.entitiesAdded );

    },

};

function triggerEvent(source,name,col){
    if( col.length > 0 ){
        source.trigger(name, col.models );
    }
}

_.extend( CmdBuffer.prototype, functions );

export function create (){
    let result = new CmdBuffer();
    result.reset();
    return result;
}

export default CmdBuffer;