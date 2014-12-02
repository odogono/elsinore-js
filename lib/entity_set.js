'use strict';

var Entity = require('./entity');
var _ = require('underscore');
var Backbone = require('backbone');
// var BitArray = require('bit-array');
var BitField = require('./bit_field');
var ComponentDef = require('./component_def');
var Component = require('./component');
var EntityFilter = require('./entity_filter');
var Utils = require('./utils');

var CMD_ENTITY_ADD = 0;
var CMD_COMPONENT_ADD = 1;
var CMD_COMPONENT_REMOVE = 2;
var CMD_COMPONENT_UPDATE = 3;





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

        var entityStartId = options.entity_start_id || 0;
        this._entityId = entityStartId;

        this._componentId = 0;
    },

    _reset: function( initialize ){
        // this.entityFilter = null;
        this._entityIds = []; // an array of entity ids that maintain the order that they were added
        this.entities = []; // an array of entity objects that maintain the order that they were added
        this._entityObjs = {}; // an array of entity ids objs to entity objs
        this._entityComponents = {}; // an array of entity ids to component arrays
        this._componentsByType = {}; // an array of componentDef ids mapped to arrays of entities
        this._componentsById = []; // an array of component ids to component instances
        this._cmdBuffer = [];

        this._componentDefId = 1;
        this._componentDefs = []; // array of component hashes
        this._componentDefByHash = {}; // map of component hash to ?
    },

    destroy: function(){
        this.stopListening();
        this._componentsByType = null;
        this._componentsById = null;
        this._entityComponents = null;
        this._entityObjs = null;
        this._entityIds = null;
        this.entities = null;
        this.storage = null;
        this.registry = null;
        this._componentDefs = null;
    },

    at: function(index) {
        return this.entities[index];
    },

    setRegistry: function( registry, options ){
        this._registry = registry;
    },

    getRegistry: function(){
        return this._registry;
    },

    /**
    *   Ensures that this component is registered with the entityset
    */
    registerComponentDef: function( component ){
        var defId;
        var name;
        var record;
        if( !component.schemaHash )
            throw new Error('no hash found on component');
        
        record = this._componentDefByHash[ component.schemaHash ];

        if( record ){
            component.defId = record.id;
            return record;
        }

        // assign a name for the component, which appear on entities
        name = this._registry.componentNameFromSchema( component.schemaHash );
        // assign an id for this type of component
        defId = this._componentDefId++;
        // create a record describing the component
        record = {id:defId, name:name, schemaHash:component.schemaHash, schemaId:component.schemaId };

        this._componentDefByHash[ component.schemaHash ] = record;
        this._componentDefs[ defId ] = record;

        component.defId = defId;

        this.trigger('component:register', defId, record.schemaId, record.schemaHash, record.name );

        return record;
    },

    unregisterComponentDef: function( component ){
        var record;
        if( !component.schemaHash ){
            throw new Error('no hash found for component');
        }
        record = this._componentDefByHash[ component.schemaHash ];
        if( !record ){
            throw new Error('component ' + component.schemaHash + ' not registered');
        }

        delete this._componentDefs[ record.id ];
        delete this._componentDefByHash[ record.schemaHash ];

        this.trigger('component:unregister', record.id, record.schemaId, record.schemaHash, record.name );

        return record;
    },

    setEntityFilter: function( entityFilter, options ){
        var args = Array.prototype.slice.call( arguments );

        if( EntityFilter.isEntityFilter( args[0] ) ){
            this.entityFilter = args[0];
        } else {
            this.entityFilter = EntityFilter.create.apply( this, arguments );
        }

        // if( Utils.isInteger(entityFilter) ){
        //     this.entityFilter = EntityFilter.create( entityFilter, options );
        // } else {
        //     this.entityFilter = entityFilter;
        // }
        // check that entities are still allowed to belong to this set
        this.evaluateEntities();

        return this.entityFilter;
    },


    /**
    *   Returns true if the given entity is of interest
    *   All of its components must be allowed by the set
    */
    isEntityOfInterest: function( entity, additionalComponentDefId, options ){
        if( this.entityFilter ){
            options || (options = {});
            if( this.debug )
                options.debug = true;
            if( additionalComponentDefId )
                options.extra = additionalComponentDefId;
            var result = this.entityFilter.accept( entity, options );
            if( this.debug ){
                log.debug(this.cid + ' accepted: ' + result + ' (' + this.entityFilter + ')');
                print_e(entity);
            }
            return result;
        }

        return true;
    },


    /**
    *
    */
    attachTo: function( otherEntitySet, options ){
        // load the start state from this entity set
        otherEntitySet.triggerResetTo( this );
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent );
    },

    /**
    *   Adds all the entities of this entity set to the other entity set
    */
    triggerResetTo: function(otherEntitySet){
        var i, len, data, component;

        // TODO - it would be nice to have us trigger a stream of events
        // that only the otherEntitySet receives
        otherEntitySet.reset();

        // NOTE - entities should be added with all components to the entityset, otherwise the component 
        // mask will not work properly
        for(i=0,len=this.entities.length;i<len;i++ ){
            entity = this.entities[i];
            otherEntitySet.addEntity( entity );
        }
    },

    /**
    *
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

        var debug = this.debug || (options ? options.debug : false);
        var silent = options ? options.silent : false;

        for( entityId in cmdBuffer ){
            cmds = cmdBuffer[entityId];

            if( debug ) log.debug('executing for entity ' + entityId + ' ' + JSON.stringify(cmds));

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            entity = this.getEntity( entityId );
            if( entity ){
                tEntity = this.cloneEntity( entity );
                // log.debug('cloning ' + entity.cid + ' ' + JSON.stringify(entity) + ' to ' + tEntity.cid + ' ' + JSON.stringify(tEntity) );
                // printIns( entity.components );
                // printIns( tEntity.components );
            } else {
                // log.debug('no entity passed in ? ' + entityId + ' ' + JSON.stringify(cmdBuffer) );
                // tEntity = entity;
            }

            for( i=0,len=cmds.length;i<len;i++ ){
                cmd = cmds[i];
                com = cmd[1];
                cmdOptions = cmd[2];

                switch( cmd[0] ){
                    case CMD_ENTITY_ADD:
                        // log.debug('cmd: add entity ' + cmd[1] );
                        if( !entity ){
                            tEntity = Entity.create( entityId );
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
                        if( !entity )
                            continue;
                        if( debug ) log.debug('cmd: rem com ' + com.id + ' ' + JSON.stringify(cmd[2]) );
                        this.removeComponentFromEntity( com, tEntity );
                        // printIns( tEntity );
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
            if( !tEntity && !entity )
                continue;

            if( !tEntity && entity ){
                // if the incoming entity did not clear the filter, we should remove
                // the existing entity
                componentsRemoved = [];

                // remove all the entities components
                for( defId in entity.components ){
                    componentsRemoved.push( this._removeComponent(entity.components[defId]) );
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
                // printIns( entity.components );
                // determine which components need to be removed 
                for( defId in entity.components ){
                    // if( debug ) log.debug('b ' + defId );
                    // printIns( entity.components );
                    if( !tEntity.components[defId] ){
                        if( debug ) log.debug('removing ' + defId );
                        com = entity.components[defId];
                        this.removeComponentFromEntity( com, entity );
                        componentsRemoved.push( this._removeComponent( com ) );
                    }
                }

                // if the entity has no more components, then remove it
                if( !this.doesEntityHaveComponents( entity ) ){
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
                    componentsAdded.push( this._addComponent(com) );
                }
                else if( !entity.components[defId] ){
                    // the existing entity does not have this component - add it
                    // log.debug('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
                    // entity.components[defId] = com;
                    // entity.addComponent( com );
                    this.addComponentToEntity( com, entity );
                    componentsAdded.push( this._addComponent(com) );
                }
                else if( entity ){
                    ocom = entity.components[defId];
                    // the entity already has this entity - update it
                    // TODO: we just replace the reference, but it should probably be checking for whether anything
                    // actually changed
                    if( !com.isEqual(ocom) ){
                        if( debug ) log.debug('updating component '+ com.id + ' on ' + entity.cid + ' ' + JSON.stringify(com) + ' vs ' + JSON.stringify(ocom) );
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
        
        cmdBuffer.length = 0;
        entitiesAdded = null;
        entitiesRemoved = null;
        componentsAdded = null;
        componentsRemoved = null;
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options){
        var self = this, batch, execute, silent, listenTo, entityId, entity, componentDef, componentArray, existingCom;
        var skipFilter, i, len;
        var ignoreComponentOptions = { ignoreComponents:true };

        options || (options = {});
        silent = options.silent;
        entity = options.entity;
        listenTo = options.listen;
        skipFilter = options.skipFilter;

        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component )
            return this;

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
                this._executeCmdBuffer( this._cmdBuffer );
            }
            return this;
        }

        // determine whether we have this component registered already
        // component.defId = this.registerComponentDef( component );

        entityId = component.getEntityId();

        if( !entityId ){
            // do we have a entity add in the queue already?
            entityId = findEntityAddId( this._cmdBuffer );
            if( entityId == -1 )
                entityId = this._createEntity(true);
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
            this._executeCmdBuffer( this._cmdBuffer, options );
        }

        return this;
    },


    getComponentById: function( id ){
        return this._componentsById[ id ];
    },

    getComponents: function(){
        return _.compact( this._componentsById );
    },

    getComponentsByComponentDef: function( def ){
        return this._componentsByType[ def.id ];
    },


    removeComponentsByComponentDef: function( def, options ){
        var i,len,components = this._componentsByType[ def.id ];
        for( i=0,len=components.length;i<len;i++ ){
            this.removeComponent( components[i], options );
        }
    },

    /**
    *
    */
    removeComponent: function( component, options ){
        var batch,execute;
        options || (options = {});

        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        if( !component )
            return this;

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
                this._executeCmdBuffer( this._cmdBuffer );
            }
            return this;
        }


        addCommand( this._cmdBuffer, CMD_COMPONENT_REMOVE, component, options );

        // execute any outstanding commands
        if( execute ){
            this._executeCmdBuffer( this._cmdBuffer );
        }

        return this;
    },

    /**
    *   Adds an entity with its components to the entityset

    - reject if has no components
    - reject if filters do not pass
    - 

    */
    addEntity: function( entity, options){
        var self = this, isNew, entity, entityId, existingEntity, debug, silent, ignoreComponents;
        var eBf, exBf, i, len, comDefId, com;
        var addComponentOptions;
        var batch, execute;

        if( !entity )
            return this;

        options || (options = {});

        batch = options.batch; // cmds get batched together and then executed
        execute = _.isUndefined(options.execute) ? true : options.execute;

        
        if( EntitySet.isEntitySet(entity) ){
            // TODO : stream entities into this set
            // entity.each( function(e){
            //     this.addEntity( e );
            // });

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
            for( i in entity ){
                this.addEntity( entity[i], options );
            }
            
            if( execute ){
                this._executeCmdBuffer( this._cmdBuffer );
            }

            return this;
        }

        // does this entity exist in our es?
        entity = Entity.toEntity( entity );
        entityId = Entity.toEntityId( entity );
        existingEntity = this.getEntity( entityId );

        if( !existingEntity ){
            if( !this.doesEntityHaveComponents( entity ) ){
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
            this._executeCmdBuffer( this._cmdBuffer );
        }

        return this;
    },


    _createEntity: function( returnId ){
        var entityId = //self._entitiesAvailable.length > 0 ?
                        // self._entitiesAvailable.pop() : 
                        this._entityId++;

        return returnId ? entityId : Entity.toEntity( entityId );
    },

    _createComponentId: function( ){
        return this._componentId++;
    },

    _addEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        // log.debug('_addEntity ' + entityId + ' ' + entity.cid );
        if( !this._entityObjs[ entityId ] ){
            this._entityObjs[ entityId ] = entity;
            this._entityIds.push( entityId );
            this.entities.push( entity );
        }

        return entity;
    },

    _removeEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        // remove the entity from the set
        delete this._entityObjs[ entityId ];

        var index = _.indexOf( this._entityIds, entityId );
        if( index > -1 ){
            this._entityIds.splice( index, 1 );
            this.entities.splice( index, 1 );
        }
        return entity;
    },


    /**
    *
    */
    _addComponent: function( component, options ){
        var componentArray;
        var entityId = component.getEntityId();
        var componentId = component.id;
        var componentDefId = component.defId;

        // add the component to internal datastructures
        componentArray = this._componentsByType[ componentDefId ] || [];
        componentArray.push( component );
        this._componentsByType[ componentDefId ] = componentArray;
        this._componentsById[ componentId ] = component;
        return component;
    },

    /**
    *
    */
    _removeComponent: function( component, options ){
        var componentArray;
        var componentId = component.id;
        var componentDefId = component.defId;

        delete this._componentsById[ componentId ];

        componentArray = this._componentsByType[ componentDefId ];
        componentArray = _.filter( componentArray, function(com){
            return com.id != componentId;
        });
        this._componentsByType[ componentDefId ] = componentArray;

        this.stopListening( component );
        return component;
    },


    /**
    *
    */
    hasEntity: function( entity ){
        var entityId = Entity.toEntityId(entity);
        return this.hasEntityId( entityId );
    },

    hasEntityId: function( entityId ){
        return this._entityObjs[ entityId ] != null;
    },

    /**
    *
    */
    removeEntity: function(entity, options){
        var batch, execute, existingEntity, entityId;

        if( !entity )
            return this;

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
            for( i in entity ){
                this.removeEntity( entity[i], options );
            }
            
            if( execute ){
                this._executeCmdBuffer( this._cmdBuffer );
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
            addCommand( this._cmdBuffer, CMD_COMPONENT_REMOVE, existingEntity.components[comDefId], options );
        }

        // execute any outstanding commands
        if( execute ){
            this._executeCmdBuffer( this._cmdBuffer );
        }

        return this;
    },

    getEntity: function( entity, options ){
        var entityId, entity, existingEntity;
        entityId = Entity.toEntityId(entity);
        existingEntity = this._entityObjs[ entityId ];

        return existingEntity;
    },

    toArray: function(){
        return this.entities;
    },

    getComponentEntity: function( component, options ){
        var result;
        var com = this.getComponentById( component.id );
        if( !com )
            throw new Error('no component found with id ' + component.id );
        var entityId = com.getEntityId();
        if( !entityId )
            throw new Error('no entity id for component');
        result = this._entityObjs[ entityId ];
        return result;
    },

    /**
    *   Checks through all contained entities, ensuring that they
    *   are still valid members of this entitySet
    */
    evaluateEntities: function( options ){
        var self = this, i,len,entity;

        for( i=this.entities.length-1; i>=0; i-- ){
            entity = this.entities[i];
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

        this.removeEntity( this.entities, opOptions );
        
        this._reset();
        
        if( entities ){
            this.addEntity( entities, opOptions );
        }

        if (!options.silent) {
            this.trigger('reset', this, options);
        }
    },


    triggerEntityEvent: function( entity, name ){

    },

    listenToEntityEvent: function( filter, name, callback, context ){

    },


    addComponentToEntity: function( component, entity, options ){
        var record = this.registerComponentDef( component );
        var bf = entity.getComponentBitfield();

        if( !entity.components ){
            entity.components = [];
        }

        var existing = entity.components[ record.id ];

        if( existing ){
            // release existing
            component.setEntityId( null );
        }

        // if( bf.get( record.id) ){
        //     log.debug('already registered ' + JSON.stringify(bf) );
        //     // already registered
        //     return this;
        // }

        bf.set( record.id, true );
        component.setEntityId( entity.id );

        entity[ record.name ] = component;
        entity.components[ record.id ] = component;

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
        result.defId = component.defId;
        result.registry = this.getRegistry();
        return result;
    },


    doesEntityHaveComponent: function( entityId, componentId, options ){
        var entity;
        if( Utils.isInteger(entityId) ){
            entity = this.entities[entityId];
        }

        if( !entity ){
            throw new Error('entity not found: ' + entityId);
        }

        // var record = this.registerComponentDef( componentId );
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
        var record = this.registerComponentDef( component );
        var bf = entity.getComponentBitfield();

        bf.set( record.id, false );
        // log.debug('e ' + this.id + ' remC ' + component.defId + ' ' + component.name );

        delete entity[ record.name ];
        delete entity.components[ record.id ];
        // printIns( entity );
        return this;
    },


    getComponentFromEntity: function( component, entity, options ){
        var record = this.registerComponentDef( component );
        if( !record )
            return null;
        return entity.components[ record.id ];
    },


    doesEntityHaveComponents: function( entity, options ){
        var bf = entity.getComponentBitfield();
        if( bf.count() > 0 )
            return true;
        var size = _.keys(entity.components).length;
        return size > 0;
    },

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
            break;
        case CMD_COMPONENT_ADD:
        case CMD_COMPONENT_REMOVE:
        case CMD_COMPONENT_UPDATE:
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
    } else
        entityBuffer.push( [type,arg,options] );
    cmdBuffer[ entityId ] = entityBuffer;
    return cmdBuffer;
}

function findEntityAddId( cmdBuffer ){
    var cmds;

    for( entityId in cmdBuffer ){
        cmds = cmdBuffer[entityId];
        if( cmds[0][0] == CMD_ENTITY_ADD )
            return entityId;
    }

    return -1;
}


EntitySet.prototype.__defineGetter__('length', function(){
    return this.entities.length;
});

_.each( ['forEach', 'each', 'map', 'where', 'filter'], function(method){
    EntitySet.prototype[method] = function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift( this.entities );
        // console.log( method + ' ' + JSON.stringify(_.toArray(args)) );
        return _[method].apply( _, args );
    };
});

EntitySet.isEntitySet = function(es){
    return ( es && _.isObject(es) && es instanceof EntitySet );
}

EntitySet.create = function(options){
    options || (options = {});
    // var Model = options.EntitySet || EntitySet;
    var result = new EntitySet();
    // assign a random id
    
    // if( options.debug )
        // result.debug = options.debug;
    
    return result;
};


module.exports = EntitySet;