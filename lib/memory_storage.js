(function(){
    var root = this;
    var Api;
    var isServer = (typeof exports !== 'undefined');

    if (isServer) {
        async = require('async');
        Api = exports;
        Schema = require('./schema');
        Entity = require('./entity');
        Component = require('./component');
        // root.odgn.entity.Registry = Api;
    } else {
        root.odgn = root.odgn || { entity:{} };
        Api = root.odgn.entity.storage.Memory = {};
    }

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

        initialize: function(options,callback){
            this._reset();
            if( callback ){
                return async.nextTick( function(){
                    return callback();
                });
            }
            return this;
        },

        createEntity: function(entity, options, callback){
            var self = this;
            return async.nextTick(function(){
                // var result = new Entity();
                entity.id = self._entityId++;
                // add the new entity to the entity registry
                self._entities[ entity.id ] = entity;
                return callback(null, entity);
            });
        },


        /**
         * If an entity exists, returns the entity id
         * @param  {[type]} entityId [description]
         * @return {[type]}          [description]
         */
        hasEntity: function( entityId, callback ){
            var self = this;
            return async.nextTick(function(){
                return callback( null, self._entities[ entityId ] ? entityId : null);
            });
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
            return async.nextTick( function(){

                // apply default schema attributes and passed attributes to the component
                var properties = _.extend( {}, Schema.getDefaultValues( componentDef.schema.id ), attrs );

                var component = componentDef.create(properties, options);
                component.registry = self.registry;
                component.id = self._componentId++;
                component.defId = componentDef.id;
                component.schemaId = componentDef.schema.id;

                self._components[ component.id ] = component;


                return async.nextTick(function(){
                    callback(null, component);
                });
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
        getComponentForEntity:function( componentDef, entity, callback ){
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
        retrieveComponents: function( componentDefArray, componentCallback, completeCallback ){
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
                        result[eid] = Entity.toEntity( eid );
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

                // log.debug('hMM? ' + entity.id );
                // print_ins( self, 1 );
                for( var cId in self._componentsByType ){
                    comToEnt = self._componentsByType[cId];
                    if( comToEnt[entity.id] ){
                        result.push( comToEnt[entity.id] );
                    }
                }

                return callback( null, result );
                // var componentsByEntity = self._componentsByType[ componentDefId ];
                // return callback(null, componentsByEntity ? componentsByEntity[ entity.id ]:null);
            });
        },

        /**
         * Creates a new entityset
         * 
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        createEntitySet: function( options, callback ){
            var self = this;
            options = options || {};
            
            var result = odgn.entity.EntitySet.create( this, this.registry, options );

            return result.reload( function(err,pEntitySet){
                self.trigger('entity_set:create', pEntitySet );
                return callback(null, pEntitySet);
            });
        }
    });

    Api.create = function(registry, options){
        if( _.isFunction(options) ){
            callback = options; options = {};
        }
        options = options || {};
        var result = new MemoryStorage();
        result.registry = registry;

        // if( callback ){
        //     return async.nextTick(function(){
        //         return callback(result);
        //     });
        // }
        return result;
    };

}).call(this);