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

            this.memoryStorage.initialise();

            if( this.storage != this.memoryStorage && this.storage.initialise ){
                return this.storage.initialise( options, callback );
            }

            return async.nextTick(function(){
                return callback(null,self);
            });
        },

        /**
         * 
         * @param  {[type]} mw [description]
         * @return {[type]}    [description]
         */
        use: function( mw ){
            if( mw.create ){
                var storage = this.storage = mw.create(this,{});
                return storage;
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
            entity.registry = this;

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
            def.create = /*def.Component.create = */def.create || function(attrs, options){
                var result = new component(attrs,options);
                return result;
            };

            // ensure the component and def have a parse function
            def.parse = /*def.Component.parse =*/ def.parse || function( resp, options){
                var result = def.create();
                result.set( result.parse(resp,options) );
                return result;
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
        

        /**
         * Returns a component definition using
         * some sort of id
         * 
         * @param  {[type]} defId [description]
         * @return {[type]}       [description]
         */
        getComponentDef: function( defId ){
            if( _.isUndefined(defId) )
                return null;
            // TODO : let other storage retrieve if missing from memory
            return this.memoryStorage.getComponentDef( defId );
        },


        /**
         * Creates a new component instance
         * 
         * @param  {[type]} schemaId [description]
         * @return {[type]}          [description]
         */
        createComponent: function( schemaId, attrs, options, callback ){
            var self = this, 
                componentDef = this.getComponentDef( schemaId );
            if( _.isFunction(options) ){
                callback = options;  options = null;
            }
            else if( _.isFunction(attrs) ){
                callback = attrs; attrs = null;
            }
            options = options || {};

            if( !componentDef ){
                return async.nextTick( function(){
                    return callback('unknown component def ' + schemaId );
                });
            }

            var createdCb = function(err, component){
                if( err ){ return callback(err); }
                self.trigger('component:create', component, componentDef, self, options);
                callback( err, component );
            };

            if( this.storage.createComponent ){
                return this.storage.createComponent( componentDef, attrs, options, createdCb );
            }

            return this.memoryStorage.createComponent( componentDef, attrs, options, createdCb );
        },

        /**
         * Calling this indicates that the given
         * component is no longer needed.
         * 
         * @param  {Component} component [description]
         * @return {[type]}           [description]
         */
        freeComponent: function( component, callback ){
            var self = this;
            return async.nextTick( function(){
                // first fire the event
                this.trigger('free', component);
                // then perform freeing
                return callback();
            });
        },

        /**
         * [ description]
         * @param  {[type]}   components [description]
         * @param  {Function} callback   [description]
         * @return {[type]}              [description]
         */
        instantiateComponents: function( components, callback ){
            if( !_.isArray(components) ){ components = [ components]; }
            var self = this, result = [];

            // queue an operation for creating tables from the
            // default schemas
            var q = async.queue(function(component,cb){
                if( component instanceof Component.Component ){
                    result.push( component );
                    return cb(null,component);
                }
                return self.createComponent(component,function(err,component){
                    if( err ){ return cb(err); }
                    result.push( component );
                    return cb(null, component);
                });
            },1);

            _.each( components, q.push );

            // called when finished
            q.drain = function(){
                callback(null, result);
            };
        },


        /**
         * Adds a component to an entity
         * @param  {[type]}   entity    [description]
         * @param  {[type]}   component [description]
         * @param  {Function} callback  [description]
         * @return {[type]}             [description]
         */
        addComponent: function( component, entity, callback ){
            log.debug('adding component ' + component + ' to entity ' + entity.id );

            var storageAdd = this.storage.addComponent || this.memoryStorage.addComponent;

            // resolve the component
            return this.instantiateComponents( component, function(err,components){
                if( err ){ return callback(err); }
                
                // add each component instance to the entity
                return async.eachSeries( components, function(component,cb){
                    storageAdd( component, entity, cb );
                }, callback );
            });
        },

        /**
         * Returns all component instances of a given schemaId
         * 
         * @param  {[type]} schemaId [description]
         * @return {[type]}          [description]
         */
        selectComponents: function( schemaId, callback ){
            // var self = this;

            if( this.storage.selectComponents ){
                return this.storage.selectComponents.apply( this.storage, arguments );
            }

            return this.memoryStorage.selectComponents.apply( this.memoryStorage, arguments );
        },

        /**
         * Returns an array of entities which have the specified
         * Component Defs
         * 
         * @param  {[type]}   defs     [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        getEntitiesWithComponents: function( componentDefs, callback ){
            if( this.storage.getEntitiesWithComponents ){
                return this.storage.getEntitiesWithComponents.apply( this.storage, arguments );
            }
            return this.memoryStorage.getEntitiesWithComponents.apply( this.memoryStorage, arguments );    
        }

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
        // memory storage will always be present, as well
        // as acting as primary storage in abscence of any
        // other
        cr.memoryStorage = cr.use( MemoryStorage );

        if( options.initialise && callback !== undefined ){
            return cr.initialise(options,callback);
        }
        return cr;
    };

}).call(this);