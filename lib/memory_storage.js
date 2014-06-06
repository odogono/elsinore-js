var Promise = require('bluebird');
var _ = require('underscore');
var Backbone = require('backbone');
var Entity = require('./entity');
var ComponentDef = require('./component_def');


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
        var entityStartId = this.options.entity_start_id || 1000;
        var componentDefStartId = this.options.component_def_start_id || 1;
        var componentStartId = this.options.component_start_id || 3000;

        this._initialized = true;
        this._entityId = entityStartId;
        this._entities = []; // an array of all created entity ids
        this._entitiesAvailable = []; // a stack of available entity ids

        this._componentDefId = componentDefStartId;
        this._componentId = componentStartId;

        this._components = []; // an array of all created component instances
        this._componentsByType = []; // an array of componentDef ids mapped to arrays of entities
        this._componentDefsBySchemaId = {}; // a map of component schema ids mapped to componentDefs
        this._componentDefs = []; // an array of componentDef ids mapped to componentDefs

        this._componentDefInstances = [];// maps componentdef id to an array of component instances
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

    createEntity: function(entity, options){
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
                self.trigger('entity:create', entity.id);
            }

            return resolve( entityArray.length == 1 ? entityArray[0] : entityArray );
        });
    },

    destroyEntity: function(entity, options ){
        var entityId = entity.id;
        // log.debug('destroying entity ' + entityId );
        if( !this._entities[ entityId ] ){
            return Promise.reject(new Error('entity ' + entityId + ' not found'));
        }
        delete this._entities[ entityId ];

        // add this entity to the available
        this._entitiesAvailable.push( entityId );

        this.trigger('entity:destroy', entityId);

        return Promise.resolve( entity );
    },

    retrieveEntity: function(entity, options){
        var self = this;
        var entityId = entity.id;
        return new Promise( function(resolve, reject){
            if( self._entities[ entityId] ){
                return resolve( Entity.create( entityId ) );
            }
            return reject(new Error('entity ' + entityId + ' not found'));
        });
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
        return Promise.resolve( this._entities[ entity.id ] ? true : false );
    },

    /**
     * [ description]
     * @param  {[type]}   schema   [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    registerEntityTemplate: function( schema, options, callback ){
        return async.nextTick(function(){
            return callback(null, schema);
        });
    },

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


    saveComponents: function( components, options ){
        var self = this;

        return new Promise( function(resolve,reject){
            components.map( function(component){
                if( !component ){
                    return;
                }
                if( component.isNew() ){
                    component.set('id', ++self._componentId );
                }
                var componentDefId = component.getDefId();// component.ComponentDef ? component.ComponentDef.id : null;
                var componentData = self._componentToData( component );
                // log.debug('saveComponent ' + componentData );

                // map the id to data
                self._components[ component.id ] = componentData;

                // add to the list of 
                if( componentDefId ){
                    if( !this._componentDefInstances )
                        this._componentDefInstances = [];

                    var defInstanceArray = this._componentDefInstances[ componentDefId ] || [];
                    defInstanceArray[ component.id ] = true;
                    this._componentDefInstances[ componentDefId ] = defInstanceArray;
                }
            });

            self.trigger('component:save', components );
            return resolve( components );
        });
    },

    // /**
    // * Saves a component or array of components
    // */
    // saveComponent: function( component, options ){
    //     var self = this;
    //     var isSingle = !_.isArray(component);
    //     var components = isSingle ? [component] : component;

    //     return new Promise( function(resolve,reject){
    //         components.map( function(component){
    //             if( !component ){
    //                 return;
    //             }
    //             if( component.isNew() ){
    //                 component.set('id',self._componentId++);
    //             }
    //             self._components[ component.id ] = component;
    //         });

    //         self.trigger('component:save', components );
    //         return resolve( isSingle ? components[0] : components );
    //     });
    // },


    /**
     * [ description]
     * @param  {[type]}   componentDef [description]
     * @param  {[type]}   attrs        [description]
     * @param  {[type]}   options      [description]
     * @param  {Function} callback     [description]
     * @return {[type]}                [description]
     */
    /*createComponent: function( componentDef, attrs, options, callback ){
        var self = this;
        var Schema = odgnEntity.Schema;

        return async.nextTick( function(){

            // apply default schema attributes and passed attributes to the component
            var properties = _.extend( {}, Schema.getDefaultValues( componentDef.schema.id ), attrs );

            var component = componentDef.create(properties, options);
            component.registry = self.registry;
            component.id = self._componentId++;
            component.defId = componentDef.id;
            component.schemaId = componentDef.schema.id;

            self._components[ component.id ] = component;

            // return async.nextTick(function(){
                return callback(null, component);
            // });
        });
    },//*/


    /**
     * Adds an array of components to an entity
     * 
     * @param  {[type]}   component [description]
     * @param  {[type]}   entity    [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    addComponent: function(components, entity, callback ){
        var self = this;
        return new Promise(function(resolve,reject){
            var componentsByEntity;
            var component;
            var componentDef;

            components = _.isArray(components) ? components : [ components ];

            for( var i in components ){
                component = components[i];
                componentDef = component.ComponentDef; //self.registry.getComponentDef( component.defId );

                // store the component instance by type
                componentsByEntity = self._componentsByType[ componentDef.id ];
                
                if( !componentsByEntity ){
                    self._componentsByType[ componentDef.id ] = componentsByEntity = [];
                }

                // store the component instance by entity id
                componentsByEntity[ entity.id ] = component.id;

                // set the owning entity id on the component
                component.set( 'entityId', entity.id );

                // decorate the entity with the component
                var componentDefName = componentDef.get('name');
                entity[ componentDefName ] = component;

                self.trigger('component:add', component, entity );

                // log.debug('added component ' + componentDefName + ' to entity ' + entity.id );
            }

            return resolve(components);
        });
    },

    /**
    * Removes an array of ComponentDefs from a given entity
    */
    removeComponent: function( components, entity, callback ){
        var self = this;
        var componentsByEntity = this._componentsByType[ component.defId ];
        // log.debug('removing component ' + component.defId + ' from ' + entity.id );

        if( componentsByEntity ){
            delete componentsByEntity[ entity.id ];
        }

        component.entityId = null;

        return async.nextTick( function(){
            self.trigger('component:remove', component, entity, {} );
            return callback( null, component, entity );
        });
    },


    /**
     * Returns a component for an entity
     * 
     * @param  {[type]}   component [description]
     * @param  {[type]}   entity    [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    getComponentForEntity:function( componentDef, entity, options, callback ){
        var self = this;
        // log.debug('ms getComponentForEntity ' + componentDef.id + ' ' + entity.id );
        // print_ins( componentDefId, 1 );
        return async.nextTick( function(){
            var componentsByEntity = self._componentsByType[ componentDef.id ];
            return callback(null, componentsByEntity ? componentsByEntity[ entity.id ] : null, entity);
        });
    },


    /**
    *   Retrieve a raw array of components 
    */
    retrieveComponents: function( start, count, options ){
        var self = this;
        
        return new Promise( function(resolve, reject){
            var result = _.compact( self._components );

            result = result.map( function(data){
                return self._componentFromData( data );
            });

            return resolve( result );
        });
    },

    /**
    *
    */
    retrieveComponentById: function( id, options ) {
        var self = this;
        return new Promise( function(resolve,reject){
            var data = self._components[id];

            if( !data ){
                return reject(new Error('component ' + id + ' not found'));
            }
            // log.debug('retrieveComponentById ' + JSON.stringify(id) + ' ' + JSON.stringify( data ));

            var component = self._componentFromData( data );
            return resolve( component );
        });
    },

    /**
    *   Returns an array of components which have the specified ComponentDef
    */
    retrieveComponentsByComponentDef: function( componentDef, options ){
        var self = this;
        var componentDefId = componentDef.id;
        // log.debug( 'retrieveComponentsByComponentDef ' + componentDefId );

        return new Promise( function(resolve, reject){
            var defInstances = this._componentDefInstances[ componentDefId ];
            if( defInstances ){
                return resolve( defInstances.map( function(val,componentId){
                    var data = self._components[ componentId ];
                    // log.debug( 'retrieve ' + componentId + ' ' + data );
                    if( data ){
                        var component = self._componentFromData( data );
                        return component;
                    }
                    return null;
                }) );
            }

            return resolve([]);
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
            _.each( this._componentDefInstances, function(arr,defId){
                return self.destroyComponentsByComponentDef( {id:defId}, options );
            });
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
            var defInstances = this._componentDefInstances[ componentDefId ];

            if( !defInstances )
                return resolve(true);

            _.each( defInstances, function(val, componentId){
                self._components[ componentId ] = undefined;
            });

            this._componentDefInstances[ componentDefId ] = undefined;

            return resolve(true);
        });
    },


    /**
    *   Serialises a component to an internal form
    */
    _componentToData: function( component, options ){
        var componentDefId = component.getDefId(); //component.ComponentDef ? component.ComponentDef.id : null;
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

        if( entityId ){
            entityId = parseInt( entityId, 10 );
            if( !_.isNaN(entityId) )
                result.entityId = entityId;
        }

        // log.debug('_componentFromData ' + JSON.stringify(result) );
        return this.registry.createComponent( componentDefId, result, {save:false} );
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
    getEntitiesWithComponents: function( componentDefs, options, callback ){
        var self = this,
            result = {};
        var registry = self.registry;
        var returnObjects = true;

        return async.nextTick( function(){
            _.each( componentDefs, function(cDef){
                var componentsByEntity = self._componentsByType[ cDef.id ];
                for( var eid in componentsByEntity ){
                    result[eid] = odgnEntity.Entity.toEntity( eid );
                    // log.debug('adding eid ' + eid);
                }
            });
            result = _.values(result);
            return callback(null, result, componentDefs);
        });
    },

    /**
     * Returns all of an entities components
     * 
     * @param  {[type]}   entity   [description]
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    getEntityComponents: function( entity, options ){
        var self = this;

        return new Promise( function(resolve){
            var result = [];
            var comToEnt;

            for( var cId in self._componentsByType ){
                comToEnt = self._componentsByType[cId];
                if( comToEnt[entity.id] ){
                    result.push( comToEnt[entity.id] );
                }
            }
            return resolve( result );
        });
    },

    /**
     * Creates a new entityset
     * 
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    createEntitySet: function( attrs, options, callback ){
        var self = this;
        options || (options = {});
        
        var result = odgnEntity.EntitySet.create( attrs, this, this.registry, options );

        if( !options.reload ){
            self.trigger('entity_set:create', result );
            return Promise.resolve( result );
        }

        return result.reload( function(pEntitySet){
            self.trigger('entity_set:create', pEntitySet );
        });

        // return result.reload( function(err,pEntitySet){
        //     self.trigger('entity_set:create', pEntitySet );
        //     return callback(null, pEntitySet);
        // });
    },

    destroyEntitySet: function( entitySet ){
        if( entitySet ){
            entitySet.destroy();
        }
    },


    clear: function(){

    },
});

MemoryStorage.create = function create(registry, options){
    options || (options = {});
    var result = new MemoryStorage();
    result.registry = registry;
    return result;
};

module.exports = MemoryStorage;