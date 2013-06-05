(function(){
    var root = this;
    var Api;
    var isServer = (typeof exports !== 'undefined');

    if (isServer) {
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

    _.extend(MemoryStorage.prototype, {

        /**
         * [ description]
         * @return {[type]} [description]
         */
        _reset: function(){
            this._entityId = 1;
            this._entities = []; // an array of all created component instances

            this._defId = 1;
            this._componentDefsBySchemaId = {};
            this._componentDefs = [];
            this._comId = 1;
            this._components = []; // an array of all created component instances
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
         * @param  {[type]}   componentDef [description]
         * @param  {[type]}   options      [description]
         * @param  {Function} callback     [description]
         * @return {[type]}                [description]
         */
        registerComponent: function( componentDef, options, callback ){
            var self = this;
            return async.nextTick(function(){
                componentDef.defId = self._defId++;
                self._componentDefsBySchemaId[ componentDef.schema.id ] = componentDef;
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
        getComponentDef: function( defId ){
            if( typeof defId === 'number' && defId % 1 == 0 ){
                return this._componentDefs[ defId ];
            }
            else if( typeof defId === 'object' ){
                if( Component.isComponentDef(defId) ||
                    defId instanceof Component.ComponentDef )
                    return defId;
            }
            else if( _.isString(defId) )
                return this._componentDefsBySchemaId[ defId ];
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

                var component = componentDef.create(attrs, options);

                component.comId = component.id = self._comId++;
                self._components[ component.comId ] = component;

                return async.nextTick(function(){
                    callback(null, component);
                });
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