var Promise = require('bluebird');
var _ = require('underscore');
var Backbone = require('backbone');
var Entity = require('./entity');

var MemoryStorage = function(){
};

_.extend(MemoryStorage.prototype, Backbone.Events, {

    /**
     * [ description]
     * @return {[type]} [description]
     */
    _reset: function(){
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
        this._reset();
        return Promise.resolve(this);
    },

    createEntity: function(entity, options){
        var self = this;
        return new Promise(function(resolve){
            entity.id = self._entityId++;
            self._entities[ entity.id ]  = entity;
            // return process.nextTick( function(){
                resolve( entity );
            // });
        });
    },

    destroyEntity: function(entity, options ){
        this._entities[ entity.id ] = null;
        return Promise.resolve( entity );
    },

    retrieveEntity: function(entity, options){
        var self = this;
        entity = this.toEntity( entity );
        var entityId = entity.id;
        return new Promise( function(resolve, reject){
            if( self._entities[ entityId] ){
                return resolve( Entity.create( entityId ) );
            }
            return reject(new Error('entity not found: ' + entityId));
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
    hasEntity: function( entityId ){
        var entity = this.toEntity( entityId );
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
    registerComponent: function( componentDef, options, callback ){
        var self = this;
        return async.nextTick(function(){
            componentDef.id = componentDef.defId = self._componentDefId++;
            
            // map from the schemas id (string) to the componentDef instance
            self._componentDefsBySchemaId[ componentDef.schema.id ] = componentDef;

            // map from the componentDef id (int) to the componentDef
            self._componentDefs[ componentDef.defId ] = componentDef;

            return callback(null, componentDef);
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
     * [ description]
     * @param  {[type]}   componentDef [description]
     * @param  {[type]}   attrs        [description]
     * @param  {[type]}   options      [description]
     * @param  {Function} callback     [description]
     * @return {[type]}                [description]
     */
    createComponent: function( componentDef, attrs, options, callback ){
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
    },


    /**
     * Adds a component to an entity
     * 
     * @param  {[type]}   component [description]
     * @param  {[type]}   entity    [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    addComponent: function(component, entity, callback ){
        var self = this;
        var componentsByEntity = this._componentsByType[ component.defId ];
        
        if( !componentsByEntity ){
            this._componentsByType[ component.defId ] = componentsByEntity = [];
        }

        componentsByEntity[ entity.id ] = component;

        component.entityId = entity.id;
        // component.set({entity_id:entity.id});

        return async.nextTick( function(){
            self.trigger('component:add', component, entity, {} );
            callback(null,component,entity);
        });
    },

    /**
    *   
    */
    removeComponent: function( component, entity, callback ){
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
     * Returns all component instances of a given schemaId
     * 
     * @param  {[type]} schemaId [description]
     * @return {[type]}          [description]
     */
    selectComponents: function( schemaId, callback ){
        var self = this, 
            def = this.getComponentDef( schemaId );

        return async.nextTick( function(){
            // No schema id provided or def not found - return all components
            if( !def ){
                return callback(null, self._components );
            }
            return callback( null, _.select( self._components, function(com){
                return com.constructor.componentDef === def;
            }));
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
    getEntityComponents: function( entity, options, callback ){
        var self = this;

        // if( !_.isFunction(callback) ){
        //     print_ins( arguments, 1 );
        //     print_stack();
        //     process.exit();
        // }

        return async.nextTick( function(){
            var result = [];
            var comToEnt;

            for( var cId in self._componentsByType ){
                comToEnt = self._componentsByType[cId];
                if( comToEnt[entity.id] ){
                    result.push( comToEnt[entity.id] );
                }
            }

            return callback( null, result );
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

MemoryStorage.create = function(registry, options){
    options = options || {};
    var result = new MemoryStorage();
    result.registry = registry;
    // if( options.initialize ){
    //     return result.initialize( options );
    // }
    return result;
};

module.exports = MemoryStorage;// { create:MemoryStorage.create };