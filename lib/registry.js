(function(){
    var root = this;
    var Api;
    var isServer = (typeof exports !== 'undefined');
    var Schema;
    var MemoryStorage;
    var Entity;
    var Component;

    if (isServer) {
        Api = exports;
        Schema = require('./schema');
        MemoryStorage = require('./memory_storage');
        Entity = require('./entity');
        Component = require('./component');
        // root.odgn.entity.Registry = Api;
    } else {
        root.odgn = root.odgn || { entity:{} };
        Api = root.odgn.entity.Registry = {};
        Schema = odgn.entity.Schema;
    }

    /**
     * Registry
     * @return {[type]} [description]
     */
    var Registry = function(){
    };

    var ComponentDef = Api.ComponentDef = function(){
    };

    _.extend(Registry.prototype, Backbone.Events, {

        /**
         * Initialises the entity store
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        initialise: function(options,callback){
            var self = this;
            if( _.isFunction(options) ){
                callback = options;
                options = {};
            }

            if( this.storage.initialise ){
                return this.storage.initialise( options, callback );
            }

            return async.nextTick(function(){
                return callback(null,self);
            });
        },

        use: function( mw ){
            if( mw.create ){
                this.storage = mw.create(this,{});
            }
        },


        /**
         * [ description]
         * @param  {[type]} attrs [description]
         * @return {[type]}       [description]
         */
        _create: function( attrs ){
            var result = new Entity(attrs);
            return result;
        },

        /**
         * [ description]
         * @param  {[type]} resp [description]
         * @return {[type]}      [description]
         */
        _parse: function( resp ){
            var result = this._create();
            result.set( result.parse(resp) );
            return result;
        },

        /**
         * Creates a new entity
         * 
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        createEntity: function(options, callback){
            var self = this;

            if( callback === undefined ){
                callback = options;
                options = {};
            }

            var entity = Entity.create();

            if( this.storage.createEntity ){
                return this.storage.createEntity( entity, options, callback );
            }

            return async.nextTick(function(){
                return callback('no storage defined');
            });
        },

        /**
         * Deletes an entity
         * 
         * @param  {[type]} entityId [description]
         * @return {[type]}          [description]
         */
        deleteEntity: function( entityId, callback ){
            var self = this;
            
            return async.nextTick(function(){
                return callback();
            });
        },

        /**
         * 
         * @param  {[type]}   entityId [description]
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        readEntity: function( entityId, options, callback ){
            var self = this;
            if( _.isFunction(options) ){//arguments.length == 2 ){
                callback = options;
                options = {};
            }

            if( this.storage.read ){
                return this.storage.read( entityId, self, options, callback );
            }

            return async.nextTick(function(){
                var result = self._create();
                result.id = entityId;
                return callback(null,result);
            });
        },

        _createComponentDef: function( def, name, schema, options ){
            var self = this;
            // instantiate the Def and assign it
            // references
            def = def || new ComponentDef();
            def.name = name;
            def.schema = schema;
            def.registry = this;

            // Create the Component Class
            var component = def.Component = Component.Component.extend({},{ 
                // assign class properties
                componentDef:def,
            });

            // ensure the component and def have a create function
            def.create = /*def.Component.create = */def.create || function(attrs, options,cb){
                if( arguments.length === 1 ){
                    cb = attrs; options = {};
                } else if( arguments.length == 2 ){
                    cb = options; options = {};
                }
                // log.debug('creating component ' + def.schema.id );
                var result = new component(attrs,options);
                result.comId = self._comId++;
                self._components[ result.comId ] = result;
                return async.nextTick( function(){
                    cb(null,result);
                });
            };

            // ensure the component and def have a parse function
            def.parse = /*def.Component.parse =*/ def.parse || function( resp, options, cb ){
                return def.create({}, {}, function(err,result){
                    result.set( result.parse(resp,options) );
                    return cb(null,result);    
                });
            };

            return def;
        },


        /**
         * [ description]
         * @param  {Object}   schema   [description]
         * @param  {[type]}   def      [description]
         * @param  {Object}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        _registerComponent: function( schema, def, options, callback ){
            var self = this;

            Schema.addSchema( schema.id, schema );
            var defName = ComponentDefNameFromSchema( schema );

            // create the Def class
            def = this._createComponentDef(def, defName, schema, options);

            if( this.storage.registerComponent ){
                return this.storage.registerComponent( def, options, function(err,def){
                    self.trigger('component_register', def, this, options );
                    return callback(null,def);
                });
            }

            return async.nextTick(function(){
                return callback(null, def);
            });
        },

        /**
         * Registers a new Component
         * @param  {Object|Array} schema [description]
         * @return {[type]}        [description]
         */
        registerComponent: function( schemaArray, options, callback ){
            var self = this, 
                isSingle = false, schema;
            if( _.isFunction(options) ){
                callback = options;
                options = {};
            }

            // if we were passed just a object, turn it into
            // an array and make a note, so that we can return
            // an object for the result
            if( !_.isArray(schemaArray) ){
                schemaArray = [schemaArray];
                isSingle = true;
            }

            async.map( schemaArray, function(schema,cb){
                var def;
                if( _.isString(schema) ){
                    schema = { id:schema };
                } else if (typeof schema === 'object') {
                    if( schema.schema ){
                        def = schema;
                        schema = def.schema;
                    }
                }
                return self._registerComponent( schema, def, options, cb );
            }, function(err, defs){
                callback(err, (isSingle && defs.length > 0) ? defs[0] : defs );
            });
        },
        

    });


    var ComponentDefNameFromSchema = function( schema ){
        var name = _.isString(schema) ? schema : schema.title || schema.id; 
        name = name.split('/').pop();
        return _.classify( name + '_com_def' );
    };

    /**
     * creates a new registry instance
     * 
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    Api.create = function(options,callback){
        if( _.isFunction(options) ){
            callback = options; options = {};
        }
        options = options || {};
        var cr = new Registry();
        cr.use( MemoryStorage );
        if( callback !== undefined ){
            return cr.initialise(options,callback);
        }
        return cr;
    };

}).call(this);