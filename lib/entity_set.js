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

    initialize: function( attrs, options ){
        var self = this;
        options || (options = {});
        this.registry = options.registry;
        this._reset( true );

        // var entityStartId = options.entity_start_id || 0;
        // this._entityId = entityStartId;

        // this._componentId = 0;
    },

    _reset: function( initialize ){
        this.entities = new Backbone.Collection(); // TODO integrate this

        // this._entityIds = []; // an array of entity ids that maintain the order that they were added
        // this.entities = []; // an array of entity objects that maintain the order that they were added
        // this._entityObjs = {}; // an array of entity ids objs to entity objs
        // this._entityComponents = {}; // an array of entity ids to component arrays
        // this._componentsById = []; // an array of component ids to component instances
        this._cmdBuffer = {}; // a map of entityIds to arrays of commands TODO : replace with es6 Map

        // this._componentDefId = 1;
        // this._componentDefs = []; // array of component hashes
        // this._componentDefByHash = {}; // map of component hash to ?
    },

    destroy: function(){
        this.stopListening();
        // this._componentsById = null;
        // this._entityComponents = null;
        // this._entityObjs = null;
        // this._entityIds = null;
        this.entities = null;
        this.storage = null;
        this.registry = null;
        // this._componentDefs = null;
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
        return new Promise( function(resolve, reject){
            return resolve( this.entities.at(index) );
        })
    },

    // entityExists: function( entityId ){
    //     var entity = Entity.toEntity( entityId );
    //     if( this._entityObjs[ entityId ] ){
    //         return true;
    //     }
    //     return false;
    // },

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

    // TODO : move out of this class - should be an external function
    setEntityFilter: function( entityFilter, options ){
        var filterType;
        var componentIds;
        var args;
        var entityFilters;
        var self = this;

        if( _.isArray( entityFilter ) ){
            entityFilter = _.map( entityFilter, function(filter){
                if( EntityFilter.isEntityFilter(filter) ){
                    return filter;
                }

                filterType = filter[0];
                componentIds = self._registry.getIId.apply( self._registry, filter.slice(1) );
                // log.debug('creating from ' + JSON.stringify(filter) + ' ' + filterType + ' ' + JSON.stringify(componentIds) );
                return EntityFilter.create( filterType, componentIds );
            })

            this.entityFilters = entityFilter; //EntityFilter.create.apply( null, entityFilter );
            
        } else if( EntityFilter.isEntityFilter(entityFilter) ) {
            this.entityFilters = [ entityFilter ];
        } else {
            args = Array.prototype.slice.call( arguments );

            filterType = args[0];
            componentIds = this._registry.getIId.apply( this._registry, args.slice(1) );
            // log.debug(' EF components: ' + JSON.stringify( componentIds ) );
            this.entityFilters = [ EntityFilter.create( filterType, componentIds ) ];
        }
        

        // check that entities are still allowed to belong to this set
        this.evaluateEntities();

        return this.entityFilters;
    },


    /**
    *   Returns true if the given entity is of interest
    *   All of its components must be allowed by the set

    TODO: move out of here
    */
    isEntityOfInterest: function( entity, additionalComponentDefId, options ){
        var result;
        var i,len;

        if( !this.entityFilters ){
            return true;
        }
            
        options || (options = {});
        
        if( this.debug ){
            options.debug = true;
        }
        if( additionalComponentDefId ){
            options.extra = additionalComponentDefId;
        }

        for( i=0,len=this.entityFilters.length;i<len;i++ ){
            if( !this.entityFilters[i].accept( entity, options) ){
                if( this.debug ){
                    log.debug(this.cid + ' failed: ' + result + ' (' + this.entityFilters[i] + ')');
                    print_e(entity);
                }

                return false;
            }
        }

        return true;
    },


    /**
    *   TODO: move out of here
    */
    attachTo: function( otherEntitySet, options ){
        // load the start state from this entity set
        otherEntitySet.triggerResetTo( this );
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent );
    },

    /**
    *   Adds all the entities of this entity set to the other entity set
    *   TODO: move out of here
    */
    triggerResetTo: function(otherEntitySet){
        var i, len, data, component;

        // TODO - it would be nice to have us trigger a stream of events
        // that only the otherEntitySet receives
        otherEntitySet.reset();

        // NOTE - entities should be added with all components to the entityset, otherwise the component 
        // mask will not work properly
        for(i=0,len=this.entities.length;i<len;i++ ){
            entity = this.entities.at(i);
            otherEntitySet.addEntity( entity );
        }
    },

    /**
    *   TODO: move out of here
    */
    onEntitySetEvent: function( evt ){
        var options;
        var args = Array.prototype.slice.call(arguments, 1);
        // log.debug(this.cid + ' es.oESE ' + evt + ' ' + JSON.stringify(args));
        switch( evt ){
            // case 'entity:add':
                // return this.addEntity.apply( this, args );
            case 'component:add':
                args[1] = _.extend({}, args[1], {clone:true});
                return this.addComponent.apply(this, args);
            case 'component:remove':
                // args[1] = _.extend({}, args[1], {debug:true});
                return this.removeComponent.apply( this, args );
            // case 'entity:remove':
                // return this.removeEntity.apply( this, args );
            case 'reset':
                return this.reset.apply( this.args );
        }
        // result.listenTo(self, 'component:add', result.addComponent );
        // result.listenTo(self, 'component:remove', result.removeComponent );
        // result.listenTo(self, 'entity:remove', result.removeEntity );
        return this;
    },

    _executeCmdBuffer: function( cmdBuffer, options ){
        var i, len,entityId,cmds,cmd;
        var com, ocom, defId, isNew, cmdOptions;
        var entity, tEntity, component;
        var entitiesAdded;
        var entitiesRemoved;
        var componentsAdded;
        var componentsRemoved;
        var componentsUpdated;
        var removeEmptyEntity;

        var debug;// = this.debug || (options ? options.debug : false);
        var silent;// = options ? options.silent : false;

        if( options ){
            removeEmptyEntity = options.removeEmptyEntity;   
            debug = this.debug || options.debug;
            silent = options.silent;
        }


        // commands are associated with an entity
        for( entityId in cmdBuffer ){
            cmds = cmdBuffer[entityId];

            if( debug ){ log.debug('executing for entity ' + entityId + ' ' + JSON.stringify(cmds)); }

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            entity = this.getEntity( entityId );
            if( entity ){
                tEntity = this.cloneEntity( entity );
                // log.debug('cloning ' + entity.cid + ' ' + JSON.stringify(entity) + ' to ' + tEntity.cid + ' ' + JSON.stringify(tEntity) );
            } else {
                // log.debug('no entity passed in ? ' + entityId + ' ' + JSON.stringify(cmdBuffer) );
                // tEntity = entity;
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
                            // log.debug('creating entity!!! ' + entityId );
                            tEntity = this._createEntity( entityId );
                            // tEntity.setEntitySetId( this.id );
                            entitiesAdded || (entitiesAdded = [])
                            entitiesAdded.push( tEntity );
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
                        // log.debug('cmd: add com ' + com.id + ' ' + com.name + ' ' + JSON.stringify(cmd[2]) );
                        break;
                    case CMD_COMPONENT_REMOVE:
                        // no entity to remove from?
                        if( debug ){
                            log.debug('removing component ' + JSON.stringify(component) );
                        }
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
            if( this.entityFilters ){
                for( i=0,len=this.entityFilters.length;i<len;i++ ){
                    tEntity = this.entityFilters[i].transform( tEntity );
                    // the filter may return null if the entity is completely unacceptable
                    if( !tEntity ){
                        break;
                    }
                }
            }

            // if the incoming entity did not clear the filter, and there is no existing
            // entity, then just continue to next cmd
            if( !tEntity && !entity ){
                continue;
            }

            if( !tEntity && entity ){
                // if the incoming entity did not clear the filter, we should remove
                // the existing entity
                componentsRemoved = [];

                // remove all the entities components
                for( defId in entity.components ){
                    componentsRemoved.push( entity.components[defId] );
                }

                // remove the entity
                entitiesRemoved = [];

                entitiesRemoved.push( this._removeEntity(entity) );
                continue;
            }

            isNew = entity != null;
            if( !entity ){
                this._addEntity( tEntity );
            }
            else {
                componentsRemoved = [];
                entitiesRemoved || (entitiesRemoved = []);
                // determine which components need to be removed 
                for( defId in entity.components ){
                    // if( debug ) log.debug('b ' + defId );
                    if( !tEntity.components[defId] ){
                        if( debug ) log.debug('removing ' + defId );
                        com = entity.components[defId];
                        this.removeComponentFromEntity( com, entity );
                        componentsRemoved.push( com );
                    }
                }

                // if the entity has no more components, then remove it
                if( debug ){ log.debug('so removeEmptyEntity is ' + (removeEmptyEntity?'true':'false')); }
                if( (!this.allowEmptyEntities || removeEmptyEntity) && !this.doesEntityHaveComponents( entity ) ){
                    entitiesRemoved.push( this._removeEntity(entity) );
                }
            }
            
            componentsAdded = [];
            componentsUpdated = [];

            // apply this entity and its components to existing records
            for( defId in tEntity.components ){
                com = tEntity.components[defId];
                if( !entity ){
                    // because we have added the new entity, we only need to report what components
                    // were added
                    componentsAdded.push( com );
                }
                else if( !entity.components[defId] ){
                    // the existing entity does not have this component - add it
                    // log.debug('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
                    // entity.components[defId] = com;
                    // entity.addComponent( com );
                    this.addComponentToEntity( com, entity );
                    componentsAdded.push( com );
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
                        componentsUpdated.push( com );
                    }
                    
                }
            }
        }

        if( !silent ){
            if( componentsUpdated && componentsUpdated.length > 0 ){
                this.trigger('component:change', componentsUpdated.length <= 1 ? componentsUpdated[0] : componentsUpdated );
            }

            if( componentsRemoved && componentsRemoved.length > 0 ){
                this.trigger('component:remove', componentsRemoved.length <= 1 ? componentsRemoved[0] : componentsRemoved );
            }
            
            if( entitiesRemoved && entitiesRemoved.length > 0 ){
                this.trigger('entity:remove', entitiesRemoved.length <= 1 ? entitiesRemoved[0] : entitiesRemoved );
            }        

            if( componentsAdded && componentsAdded.length > 0 ){
                this.trigger('component:add', componentsAdded.length <= 1 ? componentsAdded[0] : componentsAdded );
            }

            if( entitiesAdded && entitiesAdded.length > 0 ){
                this.trigger('entity:add', entitiesAdded.length <= 1 ? entitiesAdded[0] : entitiesAdded );
            }    
        }
        
        cmdBuffer = Utils.clearMap( cmdBuffer );

        entitiesAdded = null;
        entitiesRemoved = null;
        componentsAdded = null;
        componentsRemoved = null;

        return cmdBuffer;
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options){
        var self = this, debug, batch, execute, silent, listenTo, entityId, entity, componentDef, componentArray, existingCom;
        var i, len;

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
            for( i in component ){
                this.addComponent( component[i], options );
            }
            
            if( execute ){
                this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, options );
                // this._cmdBuffer = [];
            }
            return this;
        }

        // determine whether we have this component registered already
        entityId = component.getEntityId();
        if( !entityId ){
            // do we have a entity add in the queue already?
            entityId = EntitySet.findEntityAddId( this._cmdBuffer );
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
            addCommand( this._cmdBuffer, CMD_ENTITY_ADD, entityId, options );
            addCommand( this._cmdBuffer, CMD_COMPONENT_ADD, component, options );
        }
        else {
            existingCom = this.getComponentFromEntity( component, entity );

            if( debug ){
                log.debug('existing ' + component.hash() );
            }

            // does the existing entity have this component?
            if( !existingCom ){
                addCommand( this._cmdBuffer, CMD_COMPONENT_ADD, component, options );
            } else {
                // is the existing component different?
                addCommand( this._cmdBuffer, CMD_COMPONENT_UPDATE, component, options );
            }
        }

        // execute any outstanding commands
        if( execute ){
            this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, options );
        }

        return this;
    },

    /**
    *
    */
    removeComponent: function( component, options ){
        var batch,execute, debug;
        
        options || (options = {});

        debug = options.debug;
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
            for( i in component ){
                this.removeComponent( component[i], options );
            }
            
            if( execute ){
                this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, options );
            }
            return this;
        }

        // log.debug('removing component from entity ' + component.getEntityId() );

        addCommand( this._cmdBuffer, CMD_COMPONENT_REMOVE, component, options );

        // execute any outstanding commands
        if( execute ){
            this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, options );
        }

        return this;
    },

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 

    */
    addEntity: function( entity, options){
        var self = this, isNew, entity, entityId, existingEntity, debug, silent, ignoreComponents;
        var eBf, exBf, i, len, comDefId, com;
        var addComponentOptions;
        var batch, execute;

        if( !entity ){
            return this;
        }

        options || (options = {});

        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;


        if( EntitySet.isEntitySet(entity) ){
            return this.addEntity( entity.entities.models );
        }

        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if( _.isArray(entity) ){
            if( _.isUndefined(options.batch) ){
                options.batch = true;
                options.execute = false;
                execute = true;   
            }
            for( i in entity ){
                this.addEntity( entity[i], options );
            }
            
            if( execute ){
                this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, options );
            }

            return this;
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

            addCommand( this._cmdBuffer, CMD_ENTITY_ADD, entityId, options );

            // no existing entity - just add all the components
            for( comDefId in entity.components ){
                addCommand( this._cmdBuffer, CMD_COMPONENT_ADD, entity.components[comDefId], options );
            }
        }
        else {
            // entity already exists, determine whether components should be updated
            for( comDefId in entity.components ){
                if( existingEntity.components[comDefId] )
                    addCommand( this._cmdBuffer, CMD_COMPONENT_UPDATE, entity.components[comDefId], options );
                else
                    addCommand( this._cmdBuffer, CMD_COMPONENT_ADD, entity.components[comDefId], options );
            }
        }

        // log.debug( this._cmdBuffer.length + ' cmds to execute');

        // execute any outstanding commands
        if( execute ){
            this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, options );
        }

        return this;
    },


    _createEntity: function( entityId, returnId ){
        var result;
        var entityId;

        entityId = entityId || this.getRegistry().createId();
        
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
        var entityId = Entity.toEntityId(entity);

        // if( !this._entityObjs[ entityId ] ){
        //     this._entityObjs[ entityId ] = entity;
            // this._entityIds.push( entityId );
            this.entities.add( entity );
        // }

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
    // hasEntity: function( entity ){
    //     var entityId = Entity.toEntityId(entity);
    //     return this.hasEntityId( entityId );
    // },

    // hasEntityId: function( entityId ){
    //     return this._entityObjs[ entityId ] != null;
    // },

    /**
    *
    */
    removeEntity: function(entity, options){
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
                this.removeEntity( entity[i], options );
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
            addCommand( this._cmdBuffer, CMD_COMPONENT_REMOVE, existingEntity.components[comDefId] );
        }

        // execute any outstanding commands
        if( execute ){
            this._cmdBuffer = this._executeCmdBuffer( this._cmdBuffer, executeOptions );
        }

        return this;
    },

    getEntity: function( entity, options ){
        var entityId, entity, existingEntity;
        entityId = Entity.toEntityId(entity);
        return this.entities.get( entity );

        // return existingEntity;
    },

    // toArray: function(){
    //     return this.entities;
    // },

    // getComponentEntity: function( component, options ){
    //     var result;
    //     var com = this.getComponentById( component.id );
    //     if( !com )
    //         throw new Error('no component found with id ' + component.id );
    //     var entityId = com.getEntityId();
    //     if( !entityId )
    //         throw new Error('no entity id for component');
    //     result = this._entityObjs[ entityId ];
    //     return result;
    // },

    /**
    *   Checks through all contained entities, ensuring that they
    *   are still valid members of this entitySet
    */
    evaluateEntities: function( options ){
        var self = this, i,len,entity;

        for( i=this.entities.length-1; i>=0; i-- ){
            entity = this.entities.at(i);
            if( entity && !this.isEntityOfInterest( entity ) ){
                this.removeEntity( entity );
            }
        }
    },

    /**
    *
    */
    reset: function(entities, options){
        options || (options = {});
        var opOptions = _.extend({silent: true},options);

        this.removeEntity( this.entities.models, opOptions );
        
        this._reset();
        
        if( entities ){
            this.addEntity( entities, opOptions );
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




/**
*   Adds a add/remove/update command to a buffer of commands
*/
function addCommand( cmdBuffer, type, arg/*entityId|component*/, options ){
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

    entityBuffer = cmdBuffer[ entityId ] || [];

    if( type == CMD_ENTITY_ADD ){
        // this command should always be the first in the list - check 
        if( entityBuffer.length > 0 && entityBuffer[0][0] == CMD_ENTITY_ADD )
            return;
        // add to top of list
        entityBuffer.unshift( [type,arg,options] );
    } else{
        entityBuffer.push( [type,arg,options] );
    }
    
    cmdBuffer[ entityId ] = entityBuffer;
    
    return cmdBuffer;
}
EntitySet.addCommand = addCommand;

EntitySet.findEntityAddId = function( cmdBuffer ){
    var cmds;
    var entityId;

    for( entityId in cmdBuffer ){
        cmds = cmdBuffer[entityId];
        if( cmds[0][0] == CMD_ENTITY_ADD )
            return entityId;
    }

    return -1;
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

// NOTE - should really use iterator rather than these
_.each( ['forEach', 'each', 'map', 'where', 'filter'], function(method){
    EntitySet.prototype[method] = function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift( this.entities.models );
        return _[method].apply( _, args );
    };
});

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
var CMD_COMPONENT_ADD = EntitySet.CMD_COMPONENT_ADD = 1;
var CMD_COMPONENT_REMOVE = EntitySet.CMD_COMPONENT_REMOVE = 2;
var CMD_COMPONENT_UPDATE = EntitySet.CMD_COMPONENT_UPDATE = 3;


module.exports = EntitySet;