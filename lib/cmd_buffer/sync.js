'use strict';

var _ = require('underscore');
var Backbone = require('backbone');

var BitField = require('../bit_field');
var Component = require('../component');
var Entity = require('../entity');
var EntityFilter = require('../entity_filter');
var Utils = require('../utils');

var CMD_ENTITY_ADD = CmdBuffer.CMD_ENTITY_ADD = 0;
var CMD_ENTITY_REMOVE = CmdBuffer.CMD_ENTITY_REMOVE = 1;
var CMD_COMPONENT_ADD = CmdBuffer.CMD_COMPONENT_ADD = 2;
var CMD_COMPONENT_REMOVE = CmdBuffer.CMD_COMPONENT_REMOVE = 3;
var CMD_COMPONENT_UPDATE = CmdBuffer.CMD_COMPONENT_UPDATE = 4;



function CmdBuffer(){
}


var functions = {

    /**
    * Adds a component to this set
    */
    addComponent: function( entitySet, component, options){
        var self = this, debug, batch, execute, silent, listenTo, entityId, entity, componentDef, componentArray, existingCom;
        var i, len;
        var result;

        options || (options = {});
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

            for( i in component ){
                this.addComponent( entitySet, component[i], options );
            }
            
            if( execute ){
                this.execute( entitySet, options );
                result = Utils.valueArray( this.componentsAdded );
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
            } else {
                // log.debug('existing add entity ' + entityId );
            }
        } else {
            // does this entity exist in our es?
            entity = entitySet.getEntity( entityId );
        }

        // log.debug( 'adding component with entity ' + JSON.stringify(entity) );
        // printIns( entity );

        if( !entity ){
            this.addCommand( CMD_ENTITY_ADD, entityId, options );
            this.addCommand( CMD_COMPONENT_ADD, component, options );
        }
        else {
            existingCom = entitySet.getComponentFromEntity( component, entity );

            if( debug ){
                log.debug('existing ' + component.hash() );
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
            result = Utils.valueArray( this.componentsAdded );
        }

        return result;
    },

    /**
    *
    */
    removeComponent: function( entitySet, component, options ){
        var i, batch,execute, debug;
        var executeOptions;
        var result;
        
        options || (options = {});

        debug = options.debug;
        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;
        executeOptions = _.extend( {}, options, {removeEmptyEntity:true} );

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

            for( i in component ){
                this.removeComponent( entitySet, component[i], options );
            }
            
            if( execute ){
                this.execute( entitySet, executeOptions );
                result = Utils.valueArray( this.componentsRemoved );
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
            result = Utils.valueArray( this.componentsRemoved );
        }

        return result;
    },


    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity: function( entitySet, entity, options){
        var self = this, isNew, entity, entityId, existingEntity, debug, silent, ignoreComponents;
        var eBf, exBf, i, len, comDefId, com;
        var addComponentOptions;
        var batch, execute;
        var result;

        if( !entity ){
            return null;
        }

        options || (options = {});

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

            for( i in entity ){
                this.addEntity( entitySet, entity[i], options );
            }
            
            if( execute ){
                this.execute( entitySet, options );
                result = Utils.valueArray( this.entitiesAdded );
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
            if( options.debug ) { log.debug('no existing entity add ' + entityId ); }
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
            result = Utils.valueArray( this.entitiesAdded );
        }

        return result;
    },

    /**
    *
    */
    removeEntity: function( entitySet, entity, options){
        var i, batch, comDefId, execute, existingEntity, entityId;
        var executeOptions;
        var result;

        if( !entity ){
            return null;
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
            
            this.reset();

            for( i in entity ){
                this.removeEntity( entitySet, entity[i], options );
            }
            
            if( execute ){
                this.execute( entitySet, executeOptions );
                result = Utils.valueArray( this.entitiesRemoved );
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
            result = Utils.valueArray( this.entitiesRemoved );
        }

        return result;
    },

    execute: function( entitySet, options ){
        var i, len,entityId,cmds,cmd;
        var com, ocom, defId, isNew, cmdOptions;
        var entity, tEntity, component, registry;
        var removeEmptyEntity;
        var debug;
        var silent;

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
            for( i=0,len=cmds.length;i<len;i++ ){
                cmd = cmds[i];
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
                            com = registry.cloneComponent( com );
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
                        if( debug ){ 
                            // if( debug ){ printE(entity);printE(tEntity); }
                            log.debug('cmd: rem com ' + com.id + ' ' + JSON.stringify(com) ); 
                        }
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
            if( entitySet.entityFilter ){
                tEntity = entitySet.entityFilter.execute( tEntity );
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
                    this.componentsRemoved.push( entity.components[defId] );
                }
                this.entitiesRemoved.push( entitySet._removeEntity(entity) );
                continue;
            }

            isNew = entity != null;
            if( !entity ){
                if( entitySet.doesEntityHaveComponents(tEntity) ){
                    entitySet._addEntity( tEntity );
                    // log.debug('add new entity ' + tEntity.id );
                    this.entitiesAdded.push( tEntity );
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
                        this.componentsRemoved.push( com );
                        // printE( entity );
                    }
                }

                // if the entity has no more components, then remove it
                // if( debug ){ log.debug('so removeEmptyEntity is ' + (removeEmptyEntity?'true':'false')); }
                if( (!this.allowEmptyEntities || removeEmptyEntity) && !entitySet.doesEntityHaveComponents( entity ) ){
                    if( debug ){ log.debug('removing entity ' + entity.getEntityId() + '/' + entity.cid ); }
                    this.entitiesRemoved.push( entitySet._removeEntity(entity) );
                }
            }
            
            // apply this entity and its components to existing records
            for( defId in tEntity.components ){
                com = tEntity.components[defId];
                if( !entity ){
                    // because we have added the new entity, we only need to report what components
                    // were added
                    this.componentsAdded.push( com );
                }
                else if( !entity.components[defId] ){
                    // the existing entity does not have this component - add it
                    // log.debug('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
                    entity.addComponent( com );
                    this.componentsAdded.push( com );
                }
                else if( entity ){
                    ocom = entity.components[defId];
                    // the entity already has this entity - update it
                    // TODO: we just replace the reference, but it should probably be checking for whether anything
                    // actually changed
                    // if( debug ){ log.debug('checking updated component ' + com.hash() + ' ' + JSON.stringify(com) + ' ' + ocom.hash() + ' ' + JSON.stringify(ocom)); }

                    if( !com.isEqual(ocom) ){
                        // if( debug ){ log.debug('updating component '+ com.id + ' on ' + entity.cid + ' ' + JSON.stringify(com) + ' vs ' + JSON.stringify(ocom) ); }
                        entity.addComponent( com );
                        // this.componentsUpdated.push( com );
                        this.componentsUpdated[ com.cid ] = com;
                    }
                    
                }
            }
        }
        
        if( debug ){
            this.debugLog();
        }

        if( !silent ){
            this.triggerEvents( entitySet );
        }
    },



    reset: function(){
        this.cmds = Utils.clearMap( this.cmds );

        this.entitiesAdded = Utils.clearArray( this.entitiesAdded );
        this.entitiesUpdated = Utils.clearMap( this.entitiesUpdated );
        this.entitiesRemoved = Utils.clearArray( this.entitiesRemoved );
        this.componentsAdded = Utils.clearArray( this.componentsAdded );
        this.componentsRemoved = Utils.clearArray( this.componentsRemoved );
        this.componentsUpdated = Utils.clearMap( this.componentsUpdated );
    },

    /**
    *   Adds a add/remove/update command to a buffer of commands
    */
    addCommand: function addCommand( type, arg/*entityId|component*/, options ){
        var entityId;
        var entityBuffer;

        options || (options={});

        switch( type ){
            case CMD_ENTITY_ADD:
                entityId = arg;
                // log.debug('addCommand.ENTITY ' + entityId );
                break;
            case CMD_COMPONENT_ADD:
            case CMD_COMPONENT_REMOVE:
            case CMD_COMPONENT_UPDATE:
                // log.debug('addCommand.COMPONENT ' + entityId + ' ' + Component.isComponent(arg) );
                entityId = arg.getEntityId();
                
                break;
            default:
                // NO-OP
                return;
        }

        entityBuffer = this.cmds[ entityId ] || [];

        if( type == CMD_ENTITY_ADD ){
            // this command should always be the first in the list - check 
            if( entityBuffer.length > 0 && entityBuffer[0][0] == CMD_ENTITY_ADD )
                return;
            // add to top of list
            entityBuffer.unshift( [type,arg,options] );
        } else{
            entityBuffer.push( [type,arg,options] );
        }
        
        this.cmds[ entityId ] = entityBuffer;
        
        return this;
    },

    findEntityAddId: function(){
        var cmds;
        var entityId;

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
        log.debug('entities added: ' + JSON.stringify( _.values(this.entitiesAdded) )); 
        log.debug('entities updated: ' + JSON.stringify( _.keys(this.entitiesUpdated) )); 
        log.debug('entities removed: ' + JSON.stringify( _.keys(this.entitiesRemoved) )); 

        log.debug('components added: ' + JSON.stringify( _.values(this.componentsAdded) )); 
        log.debug('components updated: ' + JSON.stringify( _.keys(this.componentsUpdated) )); 
        log.debug('components removed: ' + JSON.stringify( _.values(this.componentsRemoved) ));
    },

    triggerEvents: function( source ){
        if( _.size(this.componentsUpdated) > 0 ){
            source.trigger('component:change', _.values(this.componentsUpdated) );
        }

        if( this.componentsRemoved.length > 0 ){
            source.trigger('component:remove', this.componentsRemoved );
        }
        
        if( this.entitiesRemoved.length > 0 ){
            source.trigger('entity:remove', this.entitiesRemoved );
        }        

        if( this.componentsAdded.length > 0 ){
            source.trigger('component:add', this.componentsAdded );
        }

        if( _.size(this.entitiesUpdated) > 0 ){
            source.trigger('entity:change', _.values(this.entitiesUpdated) );
        }

        if( this.entitiesAdded.length > 0 ){
            // log.debug('triggering add entities ' + Utils.stringify(this.entitiesAdded) );
            source.trigger('entity:add', this.entitiesAdded );
        }   
    }

};

_.extend( CmdBuffer.prototype, functions );

CmdBuffer.create = function(){
    var result = new CmdBuffer();
    result.reset();
    return result;
}

module.exports = CmdBuffer;