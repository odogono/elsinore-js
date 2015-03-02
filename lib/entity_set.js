'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Promise = require('bluebird');


var BitField = require('./bit_field');
var Component = require('./component');
var Entity = require('./entity');
var EntityFilter = require('./entity_filter');
var Utils = require('./utils');




/**
 * An EntitySet is a container for entities
 */
var EntitySet = Backbone.Model.extend({
    defaults:{
        start: 0, // the starting index
        page: 1, // the current page index
        page_size: 10, // the number of items in each page
        entity_count: 0, // the total number of entities
        page_count: 0, // the number of 'pages'
    },

    isEntitySet: function(){
        return true;
    },

    initialize: function( attrs, options ){
        var self = this;
        options || (options = {});
        this.registry = options.registry;
        this._reset( true );
    },

    hash: function(){
        return Utils.hash( this.id + '', true );
    },

    _reset: function( initialize ){
        if( initialize) {
            this.entities = new Backbone.Collection(); // TODO integrate this
        } else {
            this.entities.reset();
        }
        this._cmdBuffer = EntitySet.createCmdBuffer();// {}; // a map of entityIds to arrays of commands TODO : replace with es6 Map
    },

    destroy: function(){
        this.stopListening();
        this.entities = null;
        this.storage = null;
        this.registry = null;
    },

    size: function(){
        return this.entities.length;
    },

    /**
    *   Synchronous version of at. Returns the entity at the given index
    */
    atSync: function(index) {
        return this.entities.at(index);
    },

    at: function(index){
        return this.entities.at(index);
    },

    iterator: function(options){
        var self = this;
        var nextIndex = 0;
        return {
            next: function(){
                return new Promise( function(resolve, reject){
                    if( nextIndex < self.entities.length ){
                        return resolve( self.entities.at(nextIndex++) );
                    }
                    return reject({done:true});
                });
            }
        };
    },

    iteratorSync: function(options){
        var self = this, nextIndex = 0;
        return {
            next: function(){
                return nextIndex < self.entities.length ?
                    { value: self.entities.at(nextIndex++), done:false }:
                    { done:true };
            }
        }
    },

    setRegistry: function( registry, options ){
        this._registry = registry;
    },

    getRegistry: function(){
        return this._registry;
    },


    /**
    *   TODO: move out of here
    */
    attachTo: function( otherEntitySet, options ){
        // load the start state from this entity set
        otherEntitySet.reset( this );
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent );
    },


    /**
    *   TODO: move out of here
    */
    onEntitySetEvent: function( evt ){
        var options;
        var args = Array.prototype.slice.call(arguments, 1);
        switch( evt ){
            // case 'entity:add':
                // return this.add.apply( this, args );
            case 'component:add':
                args[1] = _.extend({}, args[1], {clone:true});
                return this.addComponent.apply(this, args);
            case 'component:remove':
                return this.removeComponent.apply( this, args );
            // case 'entity:remove':
                // return this.remove.apply( this, args );
            case 'reset':
                return this.reset.apply( this.args );
        }
        return this;
    },

    _executeCmdBuffer: function( cmdBuffer, options ){
        var i, len,entityId,cmds,cmd;
        var com, ocom, defId, isNew, cmdOptions;
        var entity, tEntity, component;
        var removeEmptyEntity;

        var debug;// = this.debug || (options ? options.debug : false);
        var silent;// = options ? options.silent : false;

        if( options ){
            removeEmptyEntity = options.removeEmptyEntity;   
            debug = this.debug || options.debug;
            silent = options.silent;
        }

        // componentsAdded = [];
        // componentsUpdated = [];

        // commands are associated with an entity
        for( entityId in cmdBuffer.cmds ){
            cmds = cmdBuffer.cmds[entityId];

            // if( debug ){ log.debug('executing for entity ' + entityId + ' ' + JSON.stringify(cmds)); }

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            entity = this.getEntity( entityId );
            if( entity ){
                tEntity = this.cloneEntity( entity );
                // log.debug('cloning ' + entity.cid + ' ' + JSON.stringify(entity) + ' to ' + tEntity.cid + ' ' + JSON.stringify(tEntity) );
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
                            tEntity = this._createEntity( entityId );
                        }
                        break;
                    case CMD_COMPONENT_ADD:
                        if( cmdOptions && cmdOptions.clone ){
                            com = this.cloneComponent( com );
                        }
                        if( !com.id ){
                            com.id = this._createComponentId();
                            // log.debug('creating id for ' + com.id + ' ' + com.name );
                        }
                        this.addComponentToEntity( com, tEntity );
                        // log.debug('cmd: add com ' + com.id + ' ' + com.name + ' ' + JSON.stringify(cmd[2]) + ' to e:' + tEntity.id );
                        break;
                    case CMD_COMPONENT_REMOVE:
                        // no entity to remove from?
                        if( !entity ){
                            continue;
                        }
                        if( debug ){ 
                            log.debug('cmd: rem com ' + com.id + ' ' + JSON.stringify(cmd[2]) ); 
                        }
                        this.removeComponentFromEntity( com, tEntity );
                        break;
                    case CMD_COMPONENT_UPDATE:
                        // if( debug ) log.debug('cmd: update com ' + JSON.stringify( com ));
                        // if( debug ) print_e( tEntity );
                        // tEntity.addComponent( com );
                        this.addComponentToEntity( com, tEntity );
                        break;
                }
            }

            // once all commands have applied to this temp entity, transform
            // it through any filters. If there is still a valid result, commit
            // it to the entitySet
            if( this.entityFilter ){
                tEntity = this.entityFilter.transform( tEntity );
            }

            // if the incoming entity did not clear the filter, and there is no existing
            // entity, then just continue to next cmd
            if( !tEntity && !entity ){
                continue;
            }

            if( !tEntity && entity ){
                // if the incoming entity did not clear the filter, we should remove
                // the existing entity
                cmdBuffer.componentsRemoved = [];

                // remove all the entities components
                for( defId in entity.components ){
                    cmdBuffer.componentsRemoved.push( entity.components[defId] );
                }

                // remove the entity
                cmdBuffer.entitiesRemoved = [];

                cmdBuffer.entitiesRemoved.push( this._removeEntity(entity) );
                continue;
            }

            isNew = entity != null;
            if( !entity ){
                if( this.doesEntityHaveComponents(tEntity) ){ // (!this.allowEmptyEntities || removeEmptyEntity) ){
                    this._addEntity( tEntity );
                    // log.debug('add new entity ' + tEntity.id );
                    cmdBuffer.entitiesAdded.push( tEntity );
                } 
            }
            else {
                cmdBuffer.componentsRemoved = [];
                // entitiesRemoved || (entitiesRemoved = []);
                // determine which components need to be removed 
                for( defId in entity.components ){
                    // if( debug ) log.debug('b ' + defId );
                    if( !tEntity.components[defId] ){
                        if( debug ){ log.debug('removing ' + defId ); }
                        com = entity.components[defId];
                        this.removeComponentFromEntity( com, entity );
                        cmdBuffer.componentsRemoved.push( com );
                    }
                }

                // if the entity has no more components, then remove it
                if( debug ){ log.debug('so removeEmptyEntity is ' + (removeEmptyEntity?'true':'false')); }
                if( (!this.allowEmptyEntities || removeEmptyEntity) && !this.doesEntityHaveComponents( entity ) ){
                    cmdBuffer.entitiesRemoved.push( this._removeEntity(entity) );
                }
            }
            
            // apply this entity and its components to existing records
            for( defId in tEntity.components ){
                com = tEntity.components[defId];
                if( !entity ){
                    // because we have added the new entity, we only need to report what components
                    // were added
                    cmdBuffer.componentsAdded.push( com );
                }
                else if( !entity.components[defId] ){
                    // the existing entity does not have this component - add it
                    // log.debug('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
                    // entity.components[defId] = com;
                    // entity.addComponent( com );
                    this.addComponentToEntity( com, entity );
                    cmdBuffer.componentsAdded.push( com );
                }
                else if( entity ){
                    ocom = entity.components[defId];
                    // the entity already has this entity - update it
                    // TODO: we just replace the reference, but it should probably be checking for whether anything
                    // actually changed
                    if( debug ){ log.debug('checking updated component ' + com.hash() + ' ' + JSON.stringify(com) + ' ' + ocom.hash() + ' ' + JSON.stringify(ocom)); }

                    if( !com.isEqual(ocom) ){
                        if( debug ){ log.debug('updating component '+ com.id + ' on ' + entity.cid + ' ' + JSON.stringify(com) + ' vs ' + JSON.stringify(ocom) ); }
                        // entity.components[defId] = com;
                        // entity.addComponent( com );
                        this.addComponentToEntity( com, entity );
                        // cmdBuffer.componentsUpdated.push( com );
                        cmdBuffer.componentsUpdated[ com.cid ] = com;
                    }
                    
                }
            }
        }
        
        if( !silent ){
            cmdBuffer.triggerEvents( this );
        }
        
        return cmdBuffer;
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options){
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

            this._cmdBuffer.reset();

            for( i in component ){
                this.addComponent( component[i], options );
            }
            
            if( execute ){
                this._executeCmdBuffer( this._cmdBuffer, options );
                result = Utils.valueArray( this._cmdBuffer.componentsAdded );
            }

            return result;
        } else {
            if( execute ){
                this._cmdBuffer.reset();
            }
        }

        // determine whether we have this component registered already
        entityId = component.getEntityId();
        if( !entityId ){
            // do we have a entity add in the queue already?
            entityId = this._cmdBuffer.findEntityAddId();
            if( entityId == -1 ){
                entityId = this._createEntity(null, true);
                // log.debug('created new entity ' + entityId );
            } else {
                // log.debug('existing add entity ' + entityId );
            }
        } else {
            // does this entity exist in our es?
            entity = this.getEntity( entityId );
        }

        if( !entity ){
            this._cmdBuffer.addCommand( CMD_ENTITY_ADD, entityId, options );
            this._cmdBuffer.addCommand( CMD_COMPONENT_ADD, component, options );
        }
        else {
            existingCom = this.getComponentFromEntity( component, entity );

            if( debug ){
                log.debug('existing ' + component.hash() );
            }

            // does the existing entity have this component?
            if( !existingCom ){
                this._cmdBuffer.addCommand( CMD_COMPONENT_ADD, component, options );
            } else {
                // is the existing component different?
                this._cmdBuffer.addCommand( CMD_COMPONENT_UPDATE, component, options );
            }
        }

        // execute any outstanding commands
        if( execute ){
            this._executeCmdBuffer( this._cmdBuffer, options );
            result = Utils.valueArray( this._cmdBuffer.componentsAdded );
        }

        return result;
    },

    /**
    *
    */
    removeComponent: function( component, options ){
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

            this._cmdBuffer.reset();

            for( i in component ){
                this.removeComponent( component[i], options );
            }
            
            if( execute ){
                this._executeCmdBuffer( this._cmdBuffer, executeOptions );
                result = Utils.valueArray( this._cmdBuffer.componentsRemoved );
            }

            return result;
        } else {
            if( execute ){
                this._cmdBuffer.reset();
            }
        }

        this._cmdBuffer.addCommand( CMD_COMPONENT_REMOVE, component, options );

        // execute any outstanding commands
        if( execute ){
            this._executeCmdBuffer( this._cmdBuffer, executeOptions );
            result = Utils.valueArray( this._cmdBuffer.componentsRemoved );
        }

        return result;
    },

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    add: function( entity, options){
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


        if( EntitySet.isEntitySet(entity) ){
            entity = entity.entities.models;
        }

        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if( _.isArray(entity) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }

            this._cmdBuffer.reset();

            for( i in entity ){
                this.add( entity[i], options );
            }
            
            if( execute ){
                this._executeCmdBuffer( this._cmdBuffer, options );
                result = Utils.valueArray( this._cmdBuffer.entitiesAdded );
            }

            return result;
        } else {
            if( execute ){
                this._cmdBuffer.reset();
            }
        }

        

        // does this entity exist in our es?
        entity = Entity.toEntity( entity );
        entityId = Entity.toEntityId( entity );
        existingEntity = this.getEntity( entityId );

        if( !existingEntity ){
            // TODO : determine whether we should allow empty entities within the entity set
            if( !this.allowEmptyEntities && !this.doesEntityHaveComponents( entity ) ){
                return this;
            }

            this._cmdBuffer.addCommand( CMD_ENTITY_ADD, entityId, options );

            // no existing entity - just add all the components
            for( comDefId in entity.components ){
                this._cmdBuffer.addCommand( CMD_COMPONENT_ADD, entity.components[comDefId], options );
            }
        }
        else {
            // entity already exists, determine whether components should be updated
            for( comDefId in entity.components ){
                if( existingEntity.components[comDefId] )
                    this._cmdBuffer.addCommand( CMD_COMPONENT_UPDATE, entity.components[comDefId], options );
                else
                    this._cmdBuffer.addCommand( CMD_COMPONENT_ADD, entity.components[comDefId], options );
            }
        }

        // execute any outstanding commands
        if( execute ){
            this._executeCmdBuffer( this._cmdBuffer, options );
            result = Utils.valueArray( this._cmdBuffer.entitiesAdded );
        }

        return result;
    },


    _createEntity: function( entityId, returnId ){
        var result;
        var entityId;

        if( !entityId || entityId <= 0 ){
            entityId = this.getRegistry().createId();    
        }
        if( returnId ){
            return entityId;
        }

        result = Entity.toEntity( entityId );
        result.setEntitySet( this );
        return result;
    },

    _createComponentId: function( ){
        return this.getRegistry().createId();// this._componentId++;
    },

    _addEntity: function(entity){
        this.entities.add( entity );
        return entity;
    },

    _removeEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        // remove the entity from the set
        // delete this._entityObjs[ entityId ];

        // var index = _.indexOf( this._entityIds, entityId );

        // remove the entity reference from the array, so that
        // it continues to be sequential
        // if( index > -1 ){
        //     this._entityIds.splice( index, 1 );
        //     // this.entities.splice( index, 1 );
        // }

        this.entities.remove( entity );

        return entity;
    },

    /**
    *
    */
    remove: function(entity, options){
        var i, batch, comDefId, execute, existingEntity, entityId;
        var executeOptions;

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
            for( i in entity ){
                this.remove( entity[i], options );
            }
            
            if( execute ){
                this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, executeOptions );
            }

            return this;
        }

        // does this entity exist in our es?
        entityId = Entity.toEntityId( entity );
        existingEntity = this.getEntity( entityId );

        if( !existingEntity ){
            return this;
        }

        for( comDefId in existingEntity.components ){
            this._cmdBuffer.addCommand( CMD_COMPONENT_REMOVE, existingEntity.components[comDefId] );
        }

        // execute any outstanding commands
        if( execute ){
            this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, executeOptions );
        }

        return this;
    },

    getEntity: function( entity, options ){
        // var entityId, entity, existingEntity;
        // entityId = Entity.toEntityId(entity);
        return this.entities.get( entity );
    },

    /**
    *
    */
    reset: function(entities, options){
        options || (options = {});
        var opOptions = _.extend({silent: false, removeEmptyEntity:false},options);

        this.remove( this.entities.models, opOptions );
        this._reset();
        
        if( entities ){
            this.add( entities, opOptions );
        }

        if (!options.silent) {
            this.trigger('reset', this, options);
        }
    },

    /***
    *   
    */
    triggerEntityEvent: function( entity, name ){
        var args = Array.prototype.slice.call(arguments);
        args[0] = name;
        args[1] = entity;
        if( !this._entityEvents ){
            this._entityEvents = _.clone(Backbone.Events);
        }

        // log.debug('trigger ' + JSON.stringify(args));
        return this._entityEvents.trigger.apply( this._entityEvents, args );
    },

    listenToEntityEvent: function( entityOrFilter, name, callback, context ){
        if( !this._entityEvents ){
            this._entityEvents = _.clone(Backbone.Events);
            // this._entityEvents.on('all', function(){
            //     log.debug('eevt: ' + JSON.stringify(arguments) );
            // })
        }

        this._entityEvents.listenTo( this._entityEvents, name, callback );
    },


    addComponentToEntity: function( component, entity, options ){
        // var record = this.registerComponentDef( component );
        var bf = entity.getComponentBitfield();

        if( !entity.components ){
            entity.components = [];
        }

        var existing = entity.components[ component.schemaIId ];

        if( existing ){
            // release existing
            component.setEntityId( null );
        }

        // if( bf.get( record.id) ){
        //     log.debug('already registered ' + JSON.stringify(bf) );
        //     // already registered
        //     return this;
        // }

        bf.set( component.schemaIId, true );
        component.setEntityId( entity.getEntityId() );

        entity[ component.name ] = component;
        entity.components[ component.schemaIId ] = component;

        return this;
    },

    cloneEntity: function( entity, options ){
        var comClone;
        var result = Entity.create( entity.getEntityId(), this.id );
        // clone each of the attached components
        for( var comId in entity.components ){
            comClone = this.cloneComponent( entity.components[comId] );
            // log.debug('adding com ' + comClone.name + ' ' + comClone.id );
            this.addComponentToEntity( comClone, result );
        }
        result.registry = this.getRegistry();
        return result;
    },

    cloneComponent: function( component, options ){
        var result = new component.constructor(component.attributes);
        result.id = component.id;
        result.schemaHash = component.schemaHash;
        result.name = component.name;
        result.schemaIId = component.schemaIId;
        result.registry = this.getRegistry();
        return result;
    },


    doesEntityHaveComponent: function( entityId, componentId, options ){
        var entity;
        if( Utils.isInteger(entityId) ){
            entity = this.entities.at(entityId);
        }

        if( !entity ){
            throw new Error('entity not found: ' + entityId);
        }

        var bf = entity.getComponentBitfield();
        if( BitField.isBitField(componentId) ){
            return BitField.and( componentDef, bf );
        }
        // var componentDefId = ComponentDef.getId( componentDef );
        return bf.get( componentId );

        // return entity.hasComponent( componentId );
    },

    removeComponentFromEntity: function( component, entity, options ){
        // entity.removeComponent( component );
        // var record = this.registerComponentDef( component );
        var bf = entity.getComponentBitfield();

        bf.set( component.schemaIId, false );
        // log.debug('e ' + this.id + ' remC ' + component.defId + ' ' + component.name );

        delete entity[ component.name ];
        delete entity.components[ component.schemaIId ];

        this.getRegistry().destroyComponent( component );

        component.setEntityId( 0 );

        return this;
    },


    getComponentFromEntity: function( component, entity, options ){
        // var record = this.registerComponentDef( component );
        // if( !record )
            // return null;
        return entity.components[ component.schemaIId ];
    },


    doesEntityHaveComponents: function( entity, options ){
        var bf = entity.getComponentBitfield();
        if( bf.count() > 0 ){
            return true;
        }
        var size = _.keys(entity.components).length;
        return size > 0;
    }
});

var cmdBufferProto = {
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
        log.debug('entities added: ' + JSON.stringify( _.keys(this.entitiesAdded) )); 
        log.debug('entities updated: ' + JSON.stringify( _.keys(this.entitiesUpdated) )); 
        log.debug('entities removed: ' + JSON.stringify( _.keys(this.entitiesRemoved) )); 

        log.debug('components added: ' + JSON.stringify( _.keys(this.componentsAdded) )); 
        log.debug('components updated: ' + JSON.stringify( _.keys(this.componentsUpdated) )); 
        log.debug('components removed: ' + JSON.stringify( _.keys(this.componentsRemoved) ));
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
            source.trigger('entity:add', this.entitiesAdded );
        }   
    }
}

EntitySet.createCmdBuffer = function(){
    var result = Object.create( cmdBufferProto );
    result.entitiesAdded = [];
    result.entitiesUpdated = {};
    result.entitiesRemoved = [];
    result.componentsAdded = [];
    result.componentsRemoved = [];
    result.componentsUpdated = [];
    result.cmds = {};
    return result;
}



// EntitySet.prototype[Symbol.iterator] = function() {
//     let entities = this.entities;
//     return {
//         index: 0,
//         next: function(){
//             if( this.index < entities.length ){
//                 return { value: entities[this.index++], done:false };
//             }
//             return {done:true};
//         }
//     }
// };

// // NOTE - should really use iterator rather than these
// _.each( ['forEach', 'each', /*'map',*/ 'where', 'filter'], function(method){
//     EntitySet.prototype[method] = function(){
//         var args = Array.prototype.slice.call(arguments);
//         args.unshift( this.entities.models );
//         return _[method].apply( _, args );
//     };
// });

/**
*   Transfers entities from src to dst whilst applying the filter
*   The entityFilter is then set on the dstEntitySet
*/
EntitySet.map = function( srcEntitySet, entityFilter, dstEntitySet, options ){
    var e,i,elen,len;
    var entity;
    options || (options = {});
    
    dstEntitySet.reset();

    EntitySet.setEntityFilter( dstEntitySet, entityFilter );

    dstEntitySet.add( srcEntitySet );

    return dstEntitySet;
};


EntitySet.setEntityFilter = function( entitySet, entityFilter, options ){
    var filterType;
    var componentIds;
    var args;
    var registry;

    var args = Array.prototype.slice.call(arguments, 1);

    registry = entitySet.getRegistry();

    entityFilter = registry.createEntityFilter.apply( registry, args );

    if( !entityFilter ){
        return null;
    }

    entitySet.entityFilter = entityFilter;
    
    // check that entities are still allowed to belong to this set
    EntitySet.evaluateEntities( entitySet, entityFilter );

    return entityFilter;
};



/**
*   Checks through all contained entities, ensuring that they
*   are still valid members of this entitySet
*/
EntitySet.evaluateEntities = function( entitySet, options ){
    var i,len,entity;
    var entities;

    entities = entitySet.entities || entitySet;

    for( i=entities.length-1; i>=0; i-- ){
        entity = entities.at(i);
        if( entity && !EntitySet.isEntityOfInterest( entitySet, entity ) ){
            entitySet.remove( entity );
        }
    }
};


/**
*   Returns true if the given entity is of interest
*   All of its components must be allowed by the set

TODO: move out of here
*/
EntitySet.isEntityOfInterest = function( entitySet, entity, additionalComponentDefId, options ){
    var result;
    var i,len;

    if( !entitySet.entityFilter ){
        return true;
    }
        
    options || (options = {});
    
    if( additionalComponentDefId ){
        options.extra = additionalComponentDefId;
    }

    return entitySet.entityFilter.accept( entity, options );
}



/**
*   An EntityCollection is a simple collection of entities derived from
*   an entityset. It is intended as read-only.
*/
var EntityCollection = Backbone.Collection.extend({
    isEntityCollection: function(){
        return true;
    },

    setEntitySet: function(entitySet){
        this.entitySet = entitySet;
        this.listenTo( entitySet, 'entity:add', this.onEvent );
        this.listenTo( entitySet, 'entity:remove', this.onEvent );
        this.listenTo( entitySet, 'component:add', this.onEvent );
        this.listenTo( entitySet, 'component:remove', this.onEvent );
        this.update();
    },

    onEvent: function(){
        this.isModified = true;
        if( this.updateOnEvent ){
            this.update();
        }
    },
    
    onEntityAdd: function(entity){
        var i,len;
        if( EntitySet.isEntityOfInterest(this,entity) ){
            this.add( entity );
        }
    },
    
    onEntityRemove: function(entity){
        // log.debug('entity remove ' + entity.getEntityId() );
        this.remove( entity );
    },

    onComponentAdd: function( components ){
        // _.each( components, function(component){
        //     log.debug('component ' + component.schemaUri + ' added to entity ' + component.getEntityId() );
        // } );
    },

    onComponentRemove: function(components){

    },
    
    /**
    *   Resets the list of entities from the origin entitySet
    */
    update: function(){
        var e, elen, i, len, entity, accept;
        var models = this.entitySet.entities.models;
        // log.debug('updating collection ' + this.hash() + ' from ' + models.length + ' entities');
        if( !this.entityFilter ){
            this.reset( models, {} );
            return this;
        }
        var added = 0;
        this.reset( null, {silent:true} );
        for( e=0,elen=models.length;e<elen;e++ ){
            if( EntitySet.isEntityOfInterest(this,models[e]) ){
                this.add( models[e] );
                added++;
            }
        }
    },

    hash: function(){
        // start with the entitysets hash
        var hash = _.result( this.entitySet, 'hash' );

        if( this.entityFilter ){
            hash += this.entityFilter.hash();
        }

        return Utils.hash( hash, true );
    }
});


EntitySet.createCollection = function( entitySet, entityFilter, options ){
    var result;
    var registry = entitySet.getRegistry();
    var models = entitySet.entities.models;

    options || (options={});

    result = new EntityCollection();
    result.id = registry.createId();

    result.updateOnEvent = options.updateOnEvent;

    // to allow a common interface with EntitySet to reach the collection
    result.entities = result;
    result.entityFilter = entityFilter;
    result.setEntitySet( entitySet );

    return result;
}


EntitySet.isEntitySet = function(es){
    return ( es && _.isObject(es) && es instanceof EntitySet );
}

EntitySet.create = function(options){
    var result;
    options || (options = {});
    result = new EntitySet();
    
    if( !_.isUndefined(options.allowEmptyEntities) ){
        result.allowEmptyEntities = options.allowEmptyEntities;
    } else {
        result.allowEmptyEntities = true;
    }
    
    result.set( options );

    return result;
};


var CMD_ENTITY_ADD = EntitySet.CMD_ENTITY_ADD = 0;
var CMD_ENTITY_REMOVE = EntitySet.CMD_ENTITY_REMOVE = 1;
var CMD_COMPONENT_ADD = EntitySet.CMD_COMPONENT_ADD = 2;
var CMD_COMPONENT_REMOVE = EntitySet.CMD_COMPONENT_REMOVE = 3;
var CMD_COMPONENT_UPDATE = EntitySet.CMD_COMPONENT_UPDATE = 4;


module.exports = EntitySet;