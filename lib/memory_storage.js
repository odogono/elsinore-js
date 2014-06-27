var Promise = require('bluebird');
var _ = require('underscore');
var Backbone = require('backbone');
var Entity = require('./entity');
var EntitySet = require('./entity_set');
var ComponentDef = require('./component_def');
var Component = require('./component');


var MemoryStorage = function(){
};

var FIELD_COMPONENT_ID = '_c_id';
var FIELD_COMPONENTDEF_ID = '_cdef_id';
var FIELD_ENTITY_ID = '_ent_id';
var FIELD_DATA = '_data';


_.extend(MemoryStorage.prototype, Backbone.Events, {

    /**
     * [ description]
     * @return {[type]} [description]
     */
    _reset: function(){
        var self = this;
        var entityStartId = this.options.entity_start_id || 1000;
        var entitySetStartId = this.options.entity_set_start_id || 2000;
        var componentDefStartId = this.options.component_def_start_id || 1;
        var componentStartId = this.options.component_start_id || 3000;


        // we use this entityset as a way of storing entities
        this.stopListening( this._entitySet );
        this._entitySet = EntitySet.create();
        this.listenTo( this._entitySet, 'all', function(evt){
            var args = _.toArray(arguments).splice(1);
            args.unshift(evt);
            self.trigger.apply(self, args);
        });

        this._initialized = true;
        this._entityId = entityStartId;
        this._entitySetId = entitySetStartId;
        // this._entities = []; // an array of all created entity ids
        this._entitiesAvailable = []; // a stack of available entity ids

        this._componentDefId = componentDefStartId;
        this._componentId = componentStartId;

        // this._components = []; // an array of all created component instances
        // this._componentsByType = []; // an array of componentDef ids mapped to arrays of entities
        this._componentDefsBySchemaId = {}; // a map of component schema ids mapped to componentDefs
        this._componentDefs = []; // an array of componentDef ids mapped to componentDefs
    },

    initialize: function(options){
        var self = this;
        this.options = options || {};
        this._reset();
        return new Promise(function(resolve, reject){
            process.nextTick(function(){
                return resolve(self);
            });
        });
    },

    begin: function( type, options ){
        return Promise.resolve(true);
    },

    end: function( type, options ){
        return Promise.resolve(true);
    },

    /**
    *   Returns a new available entity id
    */
    retrieveNewEntityId: function(options){
        var self = this;

        return new Promise( function(resolve){
            var entityId;
            entityId = self._entitiesAvailable.length > 0 ?
                            self._entitiesAvailable.pop() : 
                            self._entityId++;

            return resolve( entityId );
        });
    },

    _retrieveNewEntityId: function(options){
        var self = this;
        var entityId;
        entityId = self._entitiesAvailable.length > 0 ?
                        self._entitiesAvailable.pop() : 
                        self._entityId++;

        return entityId;
    },

    /*_createEntity: function(entity, options){
        var self = this;
        return new Promise(function(resolve,reject){
            if( !self._initialized ){
                return reject(new Error('memory storage is uninitialized'));
            }

            var entityId;
            var entityArray = _.isArray(entity) ? entity : [ entity ];
            for( var i=0;i<entityArray.length;i++ ){
                entity = entityArray[i];
                entityId = entity.id;
                if( !entityId ){
                    // try and assign from available entity ids first
                    entityId = self._entitiesAvailable.length > 0 ?
                                    self._entitiesAvailable.pop() : 
                                    self._entityId++;
                } else {
                    if( self._entities[ entityId] )
                        return reject(new Error('entity ' + entityId + ' already exists'));
                }
                self._entities[ entityId ]  = entity;
                entity.set({id:entityId});
                self.trigger('create:entity', entity.id);
            }

            return resolve( entityArray.length == 1 ? entityArray[0] : entityArray );
        });
    },//*/

    destroyEntity: function(entity, options ){
        var self = this;
        return new Promise(function(resolve,reject){
            var destroyedEntity = self._entitySet.removeEntity( entity );

            if( !destroyedEntity ){
                return reject(new Error('entity ' + entityId + ' not found'));
            }

            // add this entity to the available
            self._entitiesAvailable.push( destroyedEntity.id );
            return resolve( destroyedEntity );
        });
    },

    /**
    *
    */
    retrieveEntity: function(entity, options){
        var self = this;
        var entityId = entity.id;
        return new Promise( function(resolve, reject){

            var result = self._entitySet.getEntity( entityId );

            if( !result )
                return reject(new Error('entity ' + entityId + ' not found'));
            result = result.clone();
            return resolve( result ); 
        });
    },

    /**
    *   Retrieves an entity instance from a component instance
    */
    retrieveComponentEntity: function(component, options){
        return this._entitySet.getComponentEntity( component, options );
    },

    /**
    *   Normalises an entity into an instance
    */
    toEntity: function( entity ){
        return this.registry.toEntity( entity );
    },

    /**
     * If an entity exists, returns the entity id
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    hasEntity: function( entity, debug ){
        return Promise.resolve( this._entitySet.getEntity(entity.id) == null ? false : true );
    },

    /**
     * [ description]
     * @param  {[type]}   schema   [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    // registerEntityTemplate: function( schema, options, callback ){
    //     return async.nextTick(function(){
    //         return callback(null, schema);
    //     });
    // },

    /**
     * [ description]
     * @param  {[type]}   componentDef [description]
     * @param  {[type]}   options      [description]
     * @param  {Function} callback     [description]
     * @return {[type]}                [description]
     */
    registerComponentDef: function( componentDef, options ){
        var self = this;
        return new Promise(function(resolve,reject) {
            if( !componentDef ){
                return reject(new Error('null ComponentDef passed'));
            }

            var schema = componentDef.get('schema');

            if( !schema ){
                return reject(new Error('componentDef does not have a schema'));
            }

            if( schema.id && self._componentDefsBySchemaId[schema.id] ){
                return reject(new Error('componentDef ' + schema.id + ' is already registrered'));
            }

            componentDef.set({id:++self._componentDefId});

            // map from the schemas id (string) to the componentDef instance
            self._componentDefsBySchemaId[ schema.id ] = componentDef;

            // map from the componentDef id (int) to the componentDef
            self._componentDefs[ componentDef.id ] = componentDef;

            // log.debug('registered component def ' + componentDef.get('schema').id + ' to ' + componentDef.id );

            self.trigger('register', componentDef);

            return resolve( componentDef );
        });
    },

    unregisterComponentDef: function( schemaId, options ){
        
    },

    unregisterAllComponents: function( options ){

    },



    isComponentRegistered: function( componentDefSchemaId, options ){
        var self = this;
        return new Promise( function(resolve, reject){
            if( self._componentDefsBySchemaId[componentDefSchemaId] )
                return resolve(true);
            return resolve(false);
        });
    },

    retrieveComponentDef: function( componentDefSchemaId, options ){
        var self = this;
        return new Promise( function(resolve, reject){
            var result = self._componentDefsBySchemaId[componentDefSchemaId];
            if( result ){
                return resolve( result );
            }
            return reject(new Error('componentDef not found ' + componentDefSchemaId));
        });
    },

    /**
     * Returns a component definition using
     * some sort of id
     * 
     * @param  {[type]} defId [description]
     * @return {[type]}       [description]
     */
    getComponentDef: function( defId ) {
        if( typeof defId === 'number' && defId % 1 == 0 ){
            return this._componentDefs[ defId ];
        }
        else if( typeof defId === 'object' ){
            if( Component.isComponentDef(defId) )
                return defId;
        }
        else if( _.isString(defId) ){
            return this._componentDefsBySchemaId[ defId ];
        }
        return null;
    },


    /**
    *   Saves components data
    */
    saveComponents: function( components, options ){
        var self = this;
        options || (options = {});

        var entityId;
        var createEntity = options.createEntity;

        if( createEntity ){
            entityId = _.isBoolean(createEntity) ?
                this._retrieveNewEntityId() :
                createEntity;
        }

        return new Promise( function(resolve,reject){
            components.map( function(component){
                if( !component ){
                    return;
                }
                if( !component.getEntityId() ){
                    if( !createEntity )
                        throw new Error('component is not attached to an entity');
                    component.setEntityId( entityId );
                }

                if( !Component.getComponentDefId(component) ){
                    throw new Error('component has no def');
                }

                if( component.isNew() ){
                    component.set('id', ++self._componentId );
                }

                var clone = component.clone();
                self._entitySet.addComponent( clone );
            });

            self.trigger('component:save', components );
            return resolve( components );
        });
    },


    /**
     * Adds an array of components to an entity
     * 
     * @param  {[type]}   component [description]
     * @param  {[type]}   entity    [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    /*addComponents: function(components, entity, options ){
        var self = this;
        var useInternal = false;

        return new Promise(function(resolve,reject){
            var componentsByEntity;
            var component;
            var componentDef;
            var componentData;

            components = _.isArray(components) ? components : [ components ];

            for( var i in components ){
                component = components[i];
                componentDef = component.ComponentDef;
                
                if( component.isNew() ){
                    component.set('id', ++self._componentId );
                }

                // set the owning entity id on the component
                if( entity )
                    component.setEntityId( entity.id );

                // create a clone
                var clone = component.clone();

                // add to the entity set which we use as main storage
                self._entitySet.addComponent( clone );
                self.trigger('add:component', clone, entity );
            }

            return resolve(components);
        });
    },//*/

    /**
    * Removes an array of ComponentDefs from a given entity
    */
    // removeComponent: function( components, entity, callback ){
    //     var self = this;
    //     var componentsByEntity = this._componentsByType[ component.defId ];
    //     // log.debug('removing component ' + component.defId + ' from ' + entity.id );

    //     if( componentsByEntity ){
    //         delete componentsByEntity[ entity.id ];
    //     }

    //     component.setEntityId( null );

    //     return async.nextTick( function(){
    //         // self.trigger('component:remove', component, entity, {} );
    //         return callback( null, component, entity );
    //     });
    // },


    /**
     * Returns a component for an entity
     * 
     * @param  {[type]}   component [description]
     * @param  {[type]}   entity    [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    // getComponentForEntity:function( componentDef, entity, options, callback ){
    //     var self = this;
    //     // log.debug('ms getComponentForEntity ' + componentDef.id + ' ' + entity.id );
    //     // print_ins( componentDefId, 1 );
    //     return async.nextTick( function(){
    //         var componentsByEntity = self._componentsByType[ componentDef.id ];
    //         return callback(null, componentsByEntity ? componentsByEntity[ entity.id ] : null, entity);
    //     });
    // },


    /**
    *   Retrieve a raw array of components 
    */
    retrieveComponents: function( start, count, options ){
        var self = this;
        
        return new Promise( function(resolve, reject){
            return resolve( self._entitySet.getComponents() );
        });
    },

    /**
    *
    */
    retrieveComponentById: function( id, options ) {
        var self = this;
        return new Promise( function(resolve,reject){
            // var data = self._components[id];
            var component = self._entitySet.getComponentById( id );
            if( !component ){
                return reject(new Error('component ' + id + ' not found'));
            }
            // var component = self._componentFromData( data );
            return resolve( component );
        });
    },

    /**
    *   Returns an array of components which have the specified ComponentDef
    */
    retrieveComponentsByComponentDef: function( componentDef, options ){
        var self = this;
        return new Promise( function(resolve, reject){
            return resolve( self._entitySet.getComponentsByComponentDef( componentDef ) );
        });
        
    },

    /**
    *   Destroys all the components of a given componentDef
    */
    destroyComponents: function( componentDef, options){
        var self = this;
        if( componentDef )
            return this.destroyComponentsByComponentDef( componentDef, options );

        return new Promise( function(resolve, reject){
            self._entitySet.reset();
            return resolve(true);
        });
    },

    /**
    *   Destroys all the components of a given componentDef
    */
    destroyComponentsByComponentDef: function( componentDef, options){
        var self = this;
        var componentDefId = componentDef.id;

        return new Promise( function(resolve, reject){
            self._entitySet.removeComponentsByComponentDef( componentDef, options );
            return resolve(true);
        });
    },


    /**
    *   Serialises a component to an internal form
    */
    _componentToData: function( component, options ){
        var componentDefId = component.getDefId();
        var entityId = component.getEntityId();

        var data = {};
        data[ FIELD_DATA ] = component.toJSON({save:true});

        if( entityId )
            data[FIELD_ENTITY_ID] = entityId;
        if( componentDefId )
            data[FIELD_COMPONENTDEF_ID] = componentDefId;

        data = JSON.stringify(data);

        return data;
    },

    /**
    *   Deserialises a component from data
    */
    _componentFromData: function( data, dataOnly ){
        var dataObj = JSON.parse( data );

        var entityId = dataObj[FIELD_ENTITY_ID];
        var componentDefId = dataObj[FIELD_COMPONENTDEF_ID];
        var result = dataObj[FIELD_DATA];

        result.defId = componentDefId;

        if( entityId ){
            entityId = parseInt( entityId, 10 );
            if( !_.isNaN(entityId) ){
                result.entityId = entityId;
            }
        }

        return this.registry.createComponent( result, {save:false} );
    },

    /**
     * Returns an array of entities which have the specified
     * Component Defs
     *
     * Callback returns error, entities, componentDefs
     * 
     * @param  {[type]}   defs     [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    // getEntitiesWithComponents: function( componentDefs, options, callback ){
    //     var self = this,
    //         result = {};
    //     var registry = self.registry;
    //     var returnObjects = true;

    //     return async.nextTick( function(){
    //         _.each( componentDefs, function(cDef){
    //             var componentsByEntity = self._componentsByType[ cDef.id ];
    //             for( var eid in componentsByEntity ){
    //                 result[eid] = odgnEntity.Entity.toEntity( eid );
    //                 // log.debug('adding eid ' + eid);
    //             }
    //         });
    //         result = _.values(result);
    //         return callback(null, result, componentDefs);
    //     });
    // },

    /**
     * Returns all of an entities components
     * 
     * @param  {[type]}   entity   [description]
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    // getEntityComponents: function( entity, options ){
    //     var self = this;

    //     return new Promise( function(resolve){
    //         var result = [];
    //         var comToEnt;

    //         for( var cId in self._componentsByType ){
    //             comToEnt = self._componentsByType[cId];
    //             if( comToEnt[entity.id] ){
    //                 result.push( comToEnt[entity.id] );
    //             }
    //         }
    //         return resolve( result );
    //     });
    // },

    /**
     * Creates a new entityset
     * 
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    createEntitySet: function( options ){
        var self = this;
        options || (options = {});
        
        return new Promise( function(resolve, reject){
            var result = EntitySet.create( options );
            result.set({id:self._entitySetId++});
            result.storage = self;
            result.registry = self.registry;

            result.attachTo( self._entitySet );

            self.trigger('es:create', result );

            return resolve( result );
        });
    },

    /**
    *
    */
    reloadEntitySet: function( entitySet, options ){
        var self = this;
        return new Promise( function(resolve, reject){
            // causing a reset and then re-adding of entities
            entitySet.attachTo( self._entitySet );
            return resolve(entitySet);
        });
    },

    destroyEntitySet: function( entitySet ){
        if( entitySet ){
            entitySet.destroy();
        }
    },


    clear: function(){

    },
});

// useful for direct access and debugging
MemoryStorage.prototype.__defineGetter__('entities', function(){
    return this._entitySet.entities;
});

MemoryStorage.create = function create(registry, options){
    options || (options = {});
    var result = new MemoryStorage();
    result.registry = registry;
    return result;
};

module.exports = MemoryStorage;