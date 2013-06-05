(function(){
    var root = this;
    var Api;
    var isServer = (typeof exports !== 'undefined');

    if (isServer) {
        Api = exports;
        Schema = require('./schema');
        // root.odgn.entity.Registry = Api;
    } else {
        root.odgn = root.odgn || { entity:{} };
        Api = root.odgn.entity.storage.Memory = {};
    }

    var MemoryStorage = function(){
        this._reset();
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
            this._defsBySchemaId = {};
            this._defs = [];
            this._comId = 1;
            this._components = []; // an array of all created component instances
        },

        initialise: function(options,callback){
            log.info('initialised memory storage');
            return async.nextTick( function(){
                return callback();
            });
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
                self._defsBySchemaId[ componentDef.schema.id ] = componentDef;
                self._defs[ componentDef.defId ] = componentDef;
                return callback(null, componentDef);
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