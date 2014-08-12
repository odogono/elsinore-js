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
        this.storage = options.storage;
        this._reset( true );
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
    },

    at: function(index) {
        return this.entities[index];
    },

    setEntityFilter: function( entityFilter, options ){
        if( Utils.isInteger(entityFilter) ){
            this.entityFilter = EntityFilter.create( entityFilter, options );
        } else {
            this.entityFilter = entityFilter;
        }
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

    postEvent: function( name, entityOrComponent, batch ){
        // if batch, store event
    },

    flushEvents: function(){
        // send out all stored events
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
                args[1] = _.extend({}, args[1], {clone:true,debug:true});
                return this.addComponent.apply(this, args);
            case 'component:remove':
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

        var debug = options ? options.debug : false;
        var silent = options ? options.silent : false;

        for( entityId in cmdBuffer ){
            cmds = cmdBuffer[entityId];

            if( debug ) log.debug('executing for entity ' + entityId + ' ' + JSON.stringify(cmds));

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            entity = this.getEntity( entityId );
            if( entity ){
                tEntity = entity.clone();
                // log.debug('cloning ' + entity.cid + ' ' + JSON.stringify(entity) + ' to ' + tEntity.cid );
            } else {
                // log.debug('no entity passed in ? ' + entityId + ' ' + JSON.stringify(cmdBuffer) );
                // tEntity = entity;
            }

            for( i=0,len=cmds.length;i<len;i++ ){
                cmd = cmds[i];
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
                        // log.debug('cmd: add com ' + cmd[1].id + ' ' + JSON.stringify(cmd[2]) );
                        if( cmdOptions && cmdOptions.clone ){
                            cmd[1] = cmd[1].clone();
                        }
                        tEntity.addComponent( cmd[1] );
                        break;
                    case CMD_COMPONENT_REMOVE:
                        // no entity to remove from?
                        if( !entity )
                            continue;
                        tEntity.removeComponent( cmd[1] );
                        break;
                    case CMD_COMPONENT_UPDATE:
                        // if( debug ) log.debug('cmd: update com ' + JSON.stringify( cmd[1] ));
                        // if( debug ) print_e( tEntity );
                        tEntity.addComponent( cmd[1] );
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
                // determine which components need to be removed 
                for( defId in entity.components ){
                    if( !tEntity.components[defId] ){
                        com = entity.components[defId];
                        entity.removeComponent( com );
                        componentsRemoved.push( this._removeComponent( com ) );
                    }
                }

                // if the entity has no more components, then remove it
                if( !entity.hasComponents() ){
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
                    entity.addComponent( com );
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
                        entity.addComponent( com );
                        componentsUpdated.push( com );
                    }
                    
                }
            }
        }

        if( !silent && componentsUpdated && componentsUpdated.length > 0 ){
            this.trigger('component:change', componentsUpdated.length <= 1 ? componentsUpdated[0] : componentsUpdated );
        }

        if( !silent && componentsRemoved && componentsRemoved.length > 0 ){
            this.trigger('component:remove', componentsRemoved.length <= 1 ? componentsRemoved[0] : componentsRemoved );
        }
        
        if( !silent && entitiesRemoved && entitiesRemoved.length > 0 ){
            this.trigger('entity:remove', entitiesRemoved.length <= 1 ? entitiesRemoved[0] : entitiesRemoved );
        }        

        if( !silent && componentsAdded && componentsAdded.length > 0 ){
            this.trigger('component:add', componentsAdded.length <= 1 ? componentsAdded[0] : componentsAdded );
        }

        if( !silent && entitiesAdded && entitiesAdded.length > 0 ){
            this.trigger('entity:add', entitiesAdded.length <= 1 ? entitiesAdded[0] : entitiesAdded );
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


        entityId = component.getEntityId();
        if( !entityId )
            throw new Error('no entity id for component');    

        // does this entity exist in our es?
        entity = this.getEntity( entityId );

        if( !entity ){
            addCommand( this._cmdBuffer, CMD_ENTITY_ADD, entityId, options );
            addCommand( this._cmdBuffer, CMD_COMPONENT_ADD, component, options );
        }
        else {
            existingCom = entity.getComponent( component );
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

        /*
        

        entityId = component.getEntityId();

        if( !entityId )
            throw new Error('no entity id for component');
        
        if( entityId == 1001 ){
            log.debug(this.cid + ' e ' + entityId + ' es.addC ' + component.id );
        }
        

        entity = this.getEntity( entityId );
        componentDef = Component.getComponentDef( component );

        if( !entity ){
            // if( entityId == 1001 ){
                log.debug(this.cid + ' e ' + entityId + ' es.addC npe ' + component.id );
            // }
            entity = Entity.create( entityId );
            entity.addComponent( component );
            // if there is no existing entity, add it
            entity = this.addEntity( entity, _.extend(options, {isNew:true}) );
            // continue onwards to add the entity
            return this;
        }

        // determine whether the entity would still be valid
        else if( !skipFilter && entity && !this.isEntityOfInterest( entity, componentDef.id ) ){
            log.debug(this.cid + ' e ' + entityId + ' es.addC ' + component.id + ' removing entity due to non-accept');
            // remove this entity in totality
            this.removeEntity( entity );
            return this;
        }

        return this._addComponent( component, {} );//*/
    },

    /*_addComponent: function( component, options ){
        var self = this;
        var silent, listenTo, componentDef, existingCom;
        var entityId, componentId, componentDefId;

        silent = options.silent;
        listenTo = options.listen;
        componentDef = Component.getComponentDef( component );
        
        entityId = component.getEntityId(); //Entity.toEntityId( entity );
        componentId = component.id;
        componentDefId = ComponentDef.getId( component );
        

        existingCom = this._componentsById[ componentId ];

        if( existingCom ){
            existingCom.set( component.attributes );
            if( existingCom.hasChanged() ){
                this.trigger('component:change', existingCom, componentDefId, entityId );
            }
            return this;
        }

        if( listenTo ){
            this.listenTo( component, 'change', function(){
                var args = _.toArray(arguments);
                args.unshift( 'component:change' );
                self.trigger.apply( self, args );
            });
        }

        // add the component to internal datastructures
        componentArray = this._componentsByType[ componentDefId ] || [];
        componentArray.push( component );
        this._componentsByType[ componentDefId ] = componentArray;
        this._componentsById[ componentId ] = component;

        if( !silent ){
            this.trigger('component:add', component, componentDefId, entityId );
        }

        return this;
    },//*/

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
                this.addComponent( component[i], options );
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

        /*
        var ignoreEntity = options.entity;
        var entity = this.getEntity( component.getEntityId() );
        var silent = options.silent;
        var componentDef = Component.getComponentDef( component );

        if( !ignoreEntity && !entity ){
            // the entity doesn't belong
            return;
        }

        if( !ignoreEntity && !entity.hasComponent( component ) ) {
            return;
        }

        if( ignoreEntity )
            ignoreEntity.removeComponent( component );
        else
            entity.removeComponent( component );

        delete this._componentsById[ component.id ];

        componentArray = this._componentsByType[ componentDef.id ];
        componentArray = _.filter( componentArray, function(com){
            return com.id != component.id;
        });
        this._componentsByType[ componentDef.id ] = componentArray;

        this.stopListening( component );

        if( !silent ) this.trigger('component:remove', component );
        
        if( !ignoreEntity ){
            if( !entity.hasComponents() ){
                this.removeEntity( entity );
            }
            else {
                // check that this entity is still valid
                if( !this.isEntityOfInterest( entity ) ){
                    // remove this entity
                    this.removeEntity( entity );
                }
            }
        }
        
        return this;//*/
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
            if( !entity.hasComponents() )
                return this;
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
        /*
        options || (options = {});
        debug = options.debug;
        silent = options.silent;
        isNew = options.isNew;
        ignoreComponents = options.ignoreComponents;
        skipFilter = options.skipFilter;

        entityId = Entity.toEntityId( entity );
        
        if( !isNew ){
            entity = Entity.toEntity( entity );
            existingEntity = this._entityObjs[ entityId ];
        }

        if( this.entityFilter ){
            if( skipFilter )
                filteredEntity = filteredEntity;
            else
                filteredEntity = this.entityFilter.transform( entity, options );
        } else {
            // create a new entity instance with the same components
            if( isNew )
                filteredEntity = entity;
            else
                filteredEntity = Entity.toEntity( entity, {clone:true} );
        }

        // the filter may reject the entity according to its rules
        if( !filteredEntity || filteredEntity.components.length <= 0 ){
            // log.debug('adding entity ' + filteredEntity.components.length);
            if( !isNew && existingEntity )
                this.removeEntity( existingEntity, options );
            return null;
        }

        if( !existingEntity ){
            isNew = true;
            // existingEntity = Entity.toEntity( entityId );
            // log.debug('new entity adding ' + JSON.stringify(existingEntity) );
            this._entityIds.push( entityId );
            this.entities.push( filteredEntity );
            // add to map of entityId to entity instance
            this._entityObjs[ entityId ] = filteredEntity;
        }
        
        

        // entities without components should not be added - and removed if they
        // already exist
        if( !ignoreComponents ){

            // iterate through the incoming entities components and add, update
            // or remove
            addComponentOptions = { entity: existingEntity, checkComponents:false };
            if( isNew ){
                addComponentOptions.entity = filteredEntity;
                addComponentOptions.isNew = true;
            }

            // remove existing components that are not on this component
            if( !isNew ){
                eBf = filteredEntity.getComponentBitfield();
                exBf = existingEntity.getComponentBitfield();

                _.each( existingEntity.components, function(com){
                    if( !eBf.get( ComponentDef.getId(com) ) )
                        self._removeComponent( existingEntity, com, options );
                });
            }

            // if( entityId == 1001 ){
            //     log.debug('aCO ' + JSON.stringify(addComponentOptions));
            // }

            // add/update components            
            for( var comIndex in filteredEntity.components ){
                com = filteredEntity.components[comIndex];
                self._addComponent( com, addComponentOptions );
            }

            // _.each( filteredEntity.components, function(com){
            //     self._addComponent( existingEntity, com, addComponentOptions );
            // });
        }
        
        if( !silent && isNew ){
            this.trigger('entity:add', filteredEntity );
        }

        return existingEntity;//*/
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
        var entityId = component.getEntityId(); //Entity.toEntityId( entity );
        var componentId = component.id;
        var componentDefId = ComponentDef.getId( component );

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
        var componentDef = Component.getComponentDef( component );

        delete this._componentsById[ component.id ];

        componentArray = this._componentsByType[ componentDef.id ];
        componentArray = _.filter( componentArray, function(com){
            return com.id != component.id;
        });
        this._componentsByType[ componentDef.id ] = componentArray;

        this.stopListening( component );
        // if( !silent ) this.trigger('component:remove', component );
        return component;
    },


    /**
    *
    */
    hasEntity: function( entity ){
        return getEntity( entity ) != null;
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

        /*
        options || (options = {});
        silent = options.silent;
        entity = Entity.toEntity( entity );
        entityId = entity.id;
        existingEntity = this._entityObjs[ entityId ];

        if( !existingEntity ){
            return null;
        }

        // remove the entity from the set
        delete this._entityObjs[ entityId ];

        index = _.indexOf( this._entityIds, entityId );
        if( index > -1 ){
            this._entityIds.splice( index, 1 );
            this.entities.splice( index, 1 );
        }

        removeComponentOptions = { entity: existingEntity };

        _.each( existingEntity.components, function(com){
            self.removeComponent( com, removeComponentOptions );
        });

        if( !silent ){
            this.trigger('entity:remove', existingEntity );
        }

        return existingEntity;//*/
    },

    getEntity: function( entity, options ){
        var entityId, entity, existingEntity;
        entityId = Entity.toEntityId(entity);
        existingEntity = this._entityObjs[ entityId ];

        return existingEntity;
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

});


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
    // var Model = options.Model || exports.Model;
    var result = new EntitySet();
    if( options.debug )
        result.debug = options.debug;
    if( !_.isUndefined(options.filter) ){
        // log.debug('creating with filter ' + options.filter + ' ' + options.defs);
        result.setEntityFilter( options.filter, options.defs );
    }
    return result;
};


module.exports = EntitySet;