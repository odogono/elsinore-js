var async = require('async');

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

            // current index of component defs
            this._componentDefId = 1;
            // a map of schema ids to componentDef objects
            this._componentDefsBySchemaId = {};
            // an array of component def ids to componentDef objects
            this._componentDefs = [];

            // we use an entityset to keep track of entities and components
            this.entitySet = odgn.entity.EntitySet.create( this.memoryStorage, this, options );

            return this.storage.initialise( options, function(err){
                if( err ){ return callback(err,self); }
                self._bindStorageEvents( self.storage );
                return callback(null,self);
            });
        },

        _bindStorageEvents: function( storage ){
            var self = this; 
            if( this._existingBoundStorage ){
                this.stopListening( this._existingBoundStorage );
            }
            this._existingBoundStorage = storage;
            storage.on('all', function(evt){
                // log.debug('storage event ' + evt );
                self.trigger.apply( self, arguments );
            });
        },

        /**
         * 
         * @param  {[type]} mw [description]
         * @return {[type]}    [description]
         */
        useStorage: function( mw, options ){
            if( mw.create ){
                // options = _.extend({memoryStorage:this.memoryStorage},options)
                var storage = this.storage = mw.create(this, options);
                this._bindStorageEvents( storage );
                return storage;
            }
        },


        /**
         * Creates a new entity
         * 
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        createEntity: function(options, callback){
            var self = this;
            if( _.isFunction(options) ){
                callback = options; options = {};
            }
            var entity = Entity.create();
            entity.registry = this;
            return this.storage.createEntity( entity, options, callback );
        },

        /**
         * Deletes an entity
         * 
         * @param  {[type]} entityId [description]
         * @return {[type]}          [description]
         */
        deleteEntity: function( entityId, callback ){
            return this.storage.deleteEntity( entityId, callback );
        },

        /**
         * If an entity exists, returns the entity id
         * @param  {[type]} entityId [description]
         * @return {[type]}          [description]
         */
        hasEntity: function( entityId, callback ){
            return this.storage.hasEntity( entityId, callback );
        },

        /**
         * Returns a component(s) for an entity
         * 
         * @param  {[type]} entity [description]
         * @return {[type]}        [description]
         */
        getEntityComponent: function( entity, componentDef, callback ){
            entity = Entity.toEntity(entity);
            entity.registry = this;
            componentDef = this.getComponentDef( componentDef );
            return this.storage.getComponentForEntity( componentDef, entity, callback );
        },

        /**
         * Returns an array of components that belong to a particular entity
         * 
         * @param  {[type]}   entity   [description]
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        getEntityComponents: function( entity, options, callback ){
            if( _.isFunction(options) ){
                callback = options; options = {};
            }
            entity = Entity.toEntity(entity);
            entity.registry = this;
            return this.storage.getEntityComponents( entity, options, callback );
        },

        /**
         * Registers a schema describing an initial set of templates
         * for an entity
         * 
         * @param  {[type]}   schema   [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        registerEntityTemplate: function( schemaArray, callback ){
            var self = this;
            var isSingle = false;
            if( !_.isArray(schemaArray) ){
                isSingle = true;
                schemaArray = [schemaArray];
            }

            async.map( schemaArray, function(schema,cb){
                Schema.addSchema( schema.id, schema );

                if( self.storage.registerEntityTemplate ){
                    return self.storage.registerEntityTemplate( schema, function(err,schema){
                        self.trigger('entity_template:register', schema, self );
                        return cb(null,schema);
                    });
                } else {
                    return cb( null, schema );
                }
            }, function(err, schemas){
                return callback(err, (isSingle && schemas.length > 0) ? schemas[0] : schemas );
            });
        },

        /**
         * 
         * @param  {[type]}   schemaId [description]
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        createEntityFromTemplate: function( schemaId, options, callback ){
            var self = this;
            var entity;
            if( _.isFunction(options) ){
                callback = options; options = {};
            }
            var schema = Schema.getSchema( schemaId );
            if( !schema ){
                return callback('no schema found for ' + schemaId );
            }

            var componentSchemas = _.compact( _.map( Schema.getProperties( schemaId ), function(prop){
                return prop['$ref'];
            }));

            return async.waterfall([
                function(cb){
                    self.createEntity(options, cb);
                },
                function(entityResult,cb){
                    entity = entityResult;
                    self.addComponent( componentSchemas, entity, cb );
                }
            ], function(err){
                if( err ){ return callback(err); }
                return callback( null, entity );
            });
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
            var defName = Component.ComponentDefNameFromSchema( schema );

            // create the Def class
            def = Component.createComponentDef(def, defName, schema, options);
            def.registry = this;

            var internalRegister = function( componentDef ){
                if( !componentDef.id ){
                    componentDef.id = componentDef.defId = self._componentDefId++;
                } else {
                    // update the latest
                    self._componentDefId = componentDef.id;
                }
                // map from the schemas id (string) to the componentDef instance
                self._componentDefsBySchemaId[ componentDef.schema.id ] = componentDef;
                // map from the componentDef id (int) to the componentDef
                self._componentDefs[ componentDef.id ] = componentDef;

                self[defName] = componentDef.id;

                self.trigger('component:register', componentDef, self, options );

                return componentDef;
            };

            // if no callback is passed, register directly.
            // this is not advised as the componentDefs won't be persisted, but
            // this is convenient for testing
            if( !callback ){
                return internalRegister( def );
            }

            // allow storage to register
            return this.storage.registerComponent( def, options, function(err,def){
                return callback(null, internalRegister(def) );
            });
        },

        /**
         * Registers a new Component or components
         * @param  {Object|Array} schema [description]
         * @return {[type]}        [description]
         */
        registerComponent: function( schemaArray, options, callback ){
            var self = this, 
                isSingle = false, schema;
            // print_ins( arguments, 1 );
            // if we were passed just a object, turn it into
            // an array and make a note, so that we can return
            // an object for the result
            if( !_.isArray(schemaArray) ){
                schemaArray = [schemaArray];
                isSingle = true;
            }
            // log.debug('registering ' + schema.id + ' to ' + componentDef.id );
            var normaliseSchema = function(schema){
                var def;
                if( _.isString(schema) ){
                    def = { schema:{id:schema} };
                } else if (typeof schema === 'object') {
                    if( schema.schema ){
                        def = schema;
                        schema = def.schema;
                    } else{
                        def = {};
                    }
                    def.schema = schema;
                }
                return def;
            }

            if( !callback ){
                var componentDefs = _.map( schemaArray, function(schema){
                    var def = normaliseSchema( schema );
                    return self._registerComponent( def.schema, def, options );
                });
                return (isSingle && componentDefs.length > 0) ? componentDefs[0] : componentDefs;
            }

            return async.map( schemaArray, function(schema,cb){
                var def = normaliseSchema( schema );
                return self._registerComponent( def.schema, def, options, cb );
            }, function(err, componentDefs){
                var result = (isSingle && componentDefs.length > 0) ? componentDefs[0] : componentDefs;
                return callback(err, result);
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
         * Normalises a componentDef or array of componentDefs into
         * ComponentDef instances
         * 
         * @param  {[type]}   componentDefs [description]
         * @return {[type]}                 [description]
         */
        getComponentDefs: function( componentDefs ){
            var self = this;
            if( !_.isArray(componentDefs) ){
                componentDefs = [ componentDefs ];
            }
            var notNull = function(it){ return Component.isComponentDef(it); };
            return _.filter( _.map( componentDefs, function(cDef){
                // log.debug('    toComponentDef ' + cDef );
                return self.getComponentDef( cDef );
            }), notNull );
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
                return callback('unknown component def ' + schemaId );
            }

            var createdCb = function(err, component){
                if( err ){ return callback(err); }
                self.trigger('component:create', component, componentDef, self, options);
                callback( err, component );
            };

            return this.storage.createComponent( componentDef, attrs, options, createdCb );
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
            var queueError;

            // queue an operation for creating tables from the
            // default schemas
            var q = async.queue(function(component,cb){
                if( component instanceof Component.Model ){
                    result.push( component );
                    return cb(null,component);
                }
                return self.createComponent(component,function(err,component){
                    if( err ){ queueError = err; return cb(err); }
                    // log.debug('created component ' + component.id );
                    result.push( component );
                    return cb(null, component);
                });
            },1);

            _.each( components, q.push );

            // called when finished
            q.drain = function(){
                callback(queueError, result);
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
            var self = this;
            var single = !_.isArray(component);

            // resolve the component
            return this.instantiateComponents( component, function(err,components){
                if( err ){ return callback(err); }
            
                // add each component instance to the entity
                return async.mapSeries( components, function(component,cb){
                    return self.storage.addComponent( component, entity, cb );
                }, function(err,components){
                    if( err ){ return callback(err); }
                    if( single )
                        return callback(null,components[0], entity);
                    return callback(null,components,entity);
                });
            });
        },

        /**
        *   Remove a component or list of components from the
        *   given entity
        */
        removeComponent: function( component, entity, callback ){
            var self = this;

            // log.debug('removeComponent ' + component );
            var single = !_.isArray(component);
            var componentDefs = this.getComponentDefs( component );

            return async.mapSeries( componentDefs, function(cDef,cb){
                return self.storage.removeComponent( cDef, entity, cb );
            }, function(err, components){
                if( err ){ return callback(err); }
                if( single ){
                    // if( !_.isFunction(callback) ){ log.debug('not cb'); }
                    return callback( null, componentDefs[0], entity );
                }
                return callback( null, components, entity );
            });
        },


        /**
         * Returns all component instances of a given schemaId
         * 
         * @param  {[type]} schemaId [description]
         * @return {[type]}          [description]
         */
        selectComponents: function( schemaId, callback ){
            return this.storage.selectComponents.apply( this.storage, arguments );
        },

        /**
         * Returns an array of entities which have the specified
         * Component Defs
         * 
         * @param  {[type]}   defs     [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        getEntitiesWithComponents: function( componentDefs, options, callback ){
            if( _.isFunction(options) ){
                callback = options; options = {};
            }
            // convert the incoming cDefs into an array of CDef instances
            componentDefs = this.getComponentDefs( componentDefs );
            return this.storage.getEntitiesWithComponents( componentDefs, options, callback );
        },


        /**
         * Returns true if the entity has all the given components
         * 
         * @param  {[type]} entity    [description]
         * @param  {[type]} component [description]
         * @return {[type]}           [description]
         */
        doesEntityHaveComponent: function( entity, components ){
            var self = this;
            if( !_.isArray(components) ){
                components = [components];
            }
            return _.every( components, function(com){
                return self.entitySet.getComponent( com, entity );
            });
        },


        /**
         * Creates a new EntitySet instance.
         * @param  {[type]}   components [description]
         * @param  {[type]}   options    [description]
         * @param  {Function} callback   [description]
         * @return {[type]}              [description]
         */
        createEntitySet: function( options, callback ){
            return this.storage.createEntitySet( options, callback );
        }

    });


    

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
        cr.memoryStorage = cr.useStorage( MemoryStorage );

        if( options.initialise && callback !== undefined ){
            return cr.initialise(options,callback);
        }
        return cr;
    };

}).call(this);