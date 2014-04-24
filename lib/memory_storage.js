var Promise = require('bluebird');
var _ = require('underscore');
var Backbone = require('backbone');
var Entity = require('./entity');
var ComponentDef = require('./component_def');


var MemoryStorage = function(){
};

_.extend(MemoryStorage.prototype, Backbone.Events, {

    /**
     * [ description]
     * @return {[type]} [description]
     */
    _reset: function(){
        this._initialized = true;
        this._entityId = 1;
        this._entities = []; // an array of all created entity ids

        this._componentDefId = 1;
        this._componentId = 1;
        this._components = []; // an array of all created component instances
        this._componentsByType = []; // an array of componentDef ids mapped to arrays of entities
        this._componentDefsBySchemaId = {}; // a map of component schema ids mapped to componentDefs
        this._componentDefs = []; // an array of componentDef ids mapped to componentDefs
    },

    initialize: function(options){
        var self = this;
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
            var entityArray = _.isArray(entity) ? entity : [ entity ];
            for( var i=0;i<entityArray.length;i++ ){
                entity = entityArray[i];
                entity.id = entity.id || self._entityId++;
                self._entities[ entity.id ]  = entity;
            }

            // entity.id = entity.id || self._entityId++;
            // self._entities[ entity.id ]  = entity;
            resolve( entityArray.length == 1 ? entityArray[0] : entityArray );
        });
    },

    destroyEntity: function(entity, options ){
        if( !this._entities[ entity.id ] ){
            return Promise.reject(new Error('entity ' + entity.id + ' not found'));
        }
        delete this._entities[ entity.id ];
        // this._entities[ entity.id ] = null;
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
    registerComponent: function( componentDef, options ){
        var self = this;
        return new Promise(function(resolve,reject) {
            if( !componentDef ){
                return reject(new Error('null ComponentDef passed'));
            }

            var schema = componentDef.get('schema');

            if( !schema ){
                return reject(new Error('componentDef does not have a schema'));
            }

            if( self._componentDefsBySchemaId[schema.id] ){
                return reject(new Error('componentDef ' + schema.id + ' is already registrered'));
            }

            componentDef.set({id:self._componentDefId++});

            // map from the schemas id (string) to the componentDef instance
            self._componentDefsBySchemaId[ schema.id ] = componentDef;

            // map from the componentDef id (int) to the componentDef
            self._componentDefs[ componentDef.id ] = componentDef;

            // log.debug('registered component def ' + componentDef.get('schema').id + ' to ' + componentDef.id );

            return resolve( componentDef );
        });
    },

    unregisterComponent: function( schemaId, options ){
        
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
    * Saves a component or array of components
    */
    saveComponent: function( component, options ){
        var self = this;
        var isSingle = !_.isArray(component);
        var components = isSingle ? [component] : component;

        return new Promise( function(resolve,reject){
            components.map( function(component){
                if( !component ){
                    return;
                }
                if( component.isNew() ){
                    component.set('id',self._componentId++);
                }
                self._components[ component.id ] = component;
            });

            self.trigger('component:save', components );
            return resolve( isSingle ? components[0] : components );
        });
    },


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
            var componentsByEntity, component, componentDef;

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

            return resolve(entity);
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
    *
    */
    retrieveComponents: function( componentDefArray, options, componentCallback, completeCallback ){
        var self = this;
        return async.nextTick( function(){
            if( !componentDefArray ){
                _.each( self._components, componentCallback );
                return completeCallback();
            }
        });
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
        options = options || {};
        
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
    }
});

MemoryStorage.create = function create(registry, options){
    options = options || {};
    var result = new MemoryStorage();
    result.registry = registry;
    return result;
};

module.exports = MemoryStorage;