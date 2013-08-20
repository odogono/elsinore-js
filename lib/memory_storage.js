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
        },

        initialise: function(options,callback){
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
         * [ description]
         * @param  {[type]}   schema   [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        registerEntityTemplate: function( schema, callback ){
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
                return callback(null, componentDef);
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
        createComponent: function( componentDef, attrs, options, callback ){
            var self = this;
            return async.nextTick( function(){

                var component = componentDef.create(attrs, options);
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
            log.debug('removing component ' + component.defId + ' from ' + entity.id );

            if( componentsByEntity ){
                delete componentsByEntity[ entity.id ];
            }

            return async.nextTick( function(){
                self.trigger('component:remove', component, entity, {} );
                return callback( null, component, entity );
            });
        },


        /**
         * [ description]
         * @param  {[type]}   component [description]
         * @param  {[type]}   entity    [description]
         * @param  {Function} callback  [description]
         * @return {[type]}             [description]
         */
        getComponentForEntity:function( componentDefId, entity, callback ){
            var self = this;
            return async.nextTick( function(){
                var componentsByEntity = self._componentsByType[ componentDefId ];
                return callback(null,componentsByEntity?componentsByEntity[ entity.id ]:null);
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
                        result[eid] = registry.toEntity( eid );
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