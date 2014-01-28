var assert = require('assert');
var MemoryStorage = require('./memory_storage');

// (function(){
//     var root = this;
//     var Api;
//     var isServer = (typeof exports !== 'undefined');
//     var Schema;
//     var MemoryStorage;
//     var Entity;
//     var Component;

//     if (isServer) {
//         Api = exports;
//         Schema = require('./schema');
//         MemoryStorage = require('./memory_storage');
//         Entity = require('./entity');
//         Component = require('./component');
//         EntitySystem = require('./entity_system');
//         // root.odgn.entity.Registry = Api;
//     } else {
//         root.odgn = root.odgn || { entity:{} };
//         Api = root.odgn.entity.Registry = {};
//         Schema = odgn.entity.Schema;
//     }

    /**
     * Registry
     * @return {[type]} [description]
     */
    var Registry = function(){
    };

    // var ComponentDef = Registry.ComponentDef = function(){
    // };

    _.extend(Registry.prototype, Backbone.Events, {

        /**
         * Initialises the entity store
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        initialize: function(options,callback){
            var self = this;
            if( _.isFunction(options) ){
                callback = options;
                options = {};
            }

            this.schema = odgnEntity.Schema;

            _.bindAll( this, 'update' );

            // current index of component defs
            this._componentDefId = 1;
            // a map of schema ids to componentDef objects
            this._componentDefsBySchemaId = {};
            // an array of component def ids to componentDef objects
            this._componentDefs = [];

            // an array of component def constants
            this.ComponentDef = {};

            this._systems = new Backbone.Collection();
            this._systems.comparator = function(system){
                return system.get('priority');
            };

            // we use an entityset to keep track of all entities and components
            // this.entitySet = odgnEntity.EntitySet.create( this.memoryStorage, this, options );
            
            var storage = options.storage || MemoryStorage;

            if( storage ){
                return this.useStorage( storage, options, function(err,storage){
                    return callback(err, self);
                });
            }

            return this.storage.initialize( options, function(err){
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
            var self = this;
            var storage = mw;

            if( mw.create ){
                storage = mw.create(this, options);
            }

            if( storage.initialize ){
                self.storage = storage;
                storage.registry = self;
                return storage.initialize( options, function(err){
                    self._bindStorageEvents( storage );
                    callback(err,storage);
                });
            }
            return callback('invalid storage');
        },


        /**
         * Creates a new entity
         * 
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        createEntity: function(options, callback){
            var self = this;
            var Component = odgnEntity.Component;
            var Entity = odgnEntity.Entity;

            if( _.isFunction(options) ){
                callback = options; options = {};
            }
            var entity = Entity.create();
            entity.registry = this;
            if( options.id ){
                entity.id = options.id;
            }
            return this.storage.createEntity( entity, options, function(err, entity){
                if( err ){ return callback(err); }
                self.trigger('entity:create', entity);

                // self.listenTo( entity, 'all', self.onEntityEvent );

                return callback( err, entity );
            });
        },


        onEntityEvent: function( evt ){
            log.debug('entity event');
            print_ins( arguments );
        },

        /**
         * Destroys an entity
         * 
         * @param  {[type]} entityId [description]
         * @return {[type]}          [description]
         */
        destroyEntity: function( entityId, options, callback ){
            var self = this;
            options = options || {};
            log.debug('destroyEntity ' + entityId );
            var entity = this.toEntity(entityId);
            entityId = entity.id;

            // if( !callback ){
                
            // }
            // print_ins( arguments );

            // get list of components that belong to this entity
            return this.getEntityComponents( entityId, null, function(err,components, entity){
                if( !entity ){
                    return callback('no entity found with id ' + entityId );
                }

                return self.removeComponent( components, entity, {updateEntity:false}, function(err, components,entity ){

                    // destroy the entity
                    return self.storage.destroyEntity( entity, null, function(err,entity){
                        if( err ){ return callback(err); }
                        self.trigger('entity:destroy', entity);
                        return callback( err, entity );
                    });
                });        
            });
            
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
        getEntityComponent: function( entity, componentDef, options, callback ){
            entity = this.toEntity(entity);
            
            var oCD = componentDef;
            componentDef = this.getComponentDef( componentDef );
            if( !componentDef ){
                return callback('no component found matching ' + JSON.stringify(oCD) );
            }
            
            return this.storage.getComponentForEntity( componentDef, entity, options, callback );
        },

        

        /**
         * Returns an entity by a given component
         * 
         * @param  {[type]}   componentDef [description]
         * @param  {[type]}   options      [description]
         * @param  {Function} callback     [description]
         * @return {[type]}                [description]
         */
        getEntityByComponent: function( componentDef, options, callback ){
            return this.storage.retrieveComponent( componentDef, options, callback );
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
            options = options || {};
            entity = this.toEntity(entity);
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
        registerEntityTemplate: function( schemaArray, options, callback ){
            var self = this;
            var isSingle = false;
            var Schema = odgnEntity.Schema;
            if( !_.isArray(schemaArray) ){
                isSingle = true;
                schemaArray = [schemaArray];
            }

            async.map( schemaArray, function(schema,cb){
                if( !schema.id )
                    return cb();

                Schema.addSchema( schema.id, schema );

                if( self.storage.registerEntityTemplate ){
                    return self.storage.registerEntityTemplate( schema, null, function(err,schema){
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
         * Imports an entity and its associated components
         * 
         * @param  {[type]}   dataArray     [description]
         * @param  {[type]}   options  [description]
         * @param  {Function} callback [description]
         * @return {[type]}            [description]
         */
        importEntity: function( dataArray, options, callback ){
            var self = this;
            var isSingle = false;
            var Schema = odgnEntity.Schema;
            var entityResults = [];

            if( !_.isArray(dataArray) ){
                isSingle = true;
                dataArray = [dataArray];
            }

            return async.map( dataArray, 
                function(entityData,entityDataCb){
                    return async.waterfall([
                        function createEntity(createEntityCb){
                            self.createEntity( _.extend({id:entityData.id},options), createEntityCb);
                        },
                        function createComponents (entityResult,cb){
                            entityResults.push( entityResult );
                            // log.debug('umm hey');
                            // log.debug('addCom ' + JSON.stringify(entityData) );
                            self.addComponent( entityData.components, entityResult, cb );
                        }
                    ], entityDataCb );
                },
                function( err ){
                    if( err ){ log.debug('importEntity error ' + err ); return callback(err); }
                    return callback(err, (isSingle && entityResults.length > 0) ? entityResults[0] : entityResults );
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
            var Component = odgnEntity.Component;
            var Schema = odgnEntity.Schema;
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
            var Component = odgnEntity.Component;
            var Schema = odgnEntity.Schema;
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

                self.ComponentDef[ Component.ComponentDefNameFromSchema( schema,'') ] = componentDef.id;

                self.trigger('component:register', componentDef, self, options );

                return componentDef;
            };

            // if no callback is passed, register directly.
            // this is not advised as the componentDefs won't be persisted, but
            // this is convenient for testing
            if( !callback ){
                self.storage.registerComponent( def, options );
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

            return async.mapSeries( schemaArray, function(schema,cb){
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
                if( odgnEntity.Component.isComponentDef(defId) )
                    return defId;
                else if( defId.schemaId )
                    return this._componentDefsBySchemaId[ defId.schemaId ];
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
            var notNull = function(it){ return odgnEntity.Component.isComponentDef(it); };
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
            options = options || {};
            if( _.isObject(schemaId) && schemaId.schemaId ){
                attrs = _.extend({}, schemaId);
                delete attrs.schemaId;
            }
            
            if( !componentDef ){
                if( callback ){
                    return callback('unknown component def ' + JSON.stringify(schemaId) );
                } else{
                    log.warn( 'unknown component def ' + JSON.stringify(schemaId) );
                    return;
                }
            }

            var createdCb = function(err, component){
                if( err ){ return callback(err); }
                self.trigger('component:create', component, componentDef, self, options);

                if( callback ){
                    return callback( err, component );
                }
            };

            // if( options.debug ) log.debug('create with ' + JSON.stringify(options) );
            return this.storage.createComponent( componentDef, attrs, options, callback ? createdCb : null );
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
        instantiateComponents: function( components, options, callback ){
            if( !_.isArray(components) ){ components = [ components]; }
            var self = this, result = [];
            var queueError;
            var Component = odgnEntity.Component;

            // queue an operation for creating tables from the
            // default schemas
            var q = async.queue(function(component,cb){
                if( component instanceof Component.Model ){
                    result.push( component );
                    return cb(null,component);
                }

                return self.createComponent(component, {}, options, function(err,component){
                    if( err ){ queueError = err; return cb(err); }
                    // log.debug('created component ' + component.id );
                    result.push( component );
                    return cb(null, component);
                });
            },1);

            _.each( components, q.push );

            // called when finished
            q.drain = function(){
                return callback(queueError, result);
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
            
            if( !component ){
                return callback();
            }

            var single = !_.isArray(component);

            // resolve the component
            return this.instantiateComponents( component, null, function(err,components){
                if( err ){ return callback(err); }
                
                // add each component instance to the entity
                return async.mapSeries( components, 
                    function(component,cb){
                        return self.storage.addComponent( component, entity, cb );
                    }, 
                    function(err,components){
                        if( err ){ return callback(err); }
                        log.debug('addComponent entity ' + entity.id + ' ' + entity.cid + ' ' + entity.get('component_bf').toHexString() );
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
        removeComponent: function( component, entity, options, callback ){
            var self = this;
            options = options || {};
            var single = !_.isArray(component);

            // convert to an array of component defs
            var componentDefs = this.getComponentDefs( component );

            entity = this.toEntity(entity);

            return async.mapSeries( componentDefs, function(cDef,cb){
                return self.storage.removeComponent( cDef, entity, options, cb );
            }, function(err, components){
                if( err ){ return callback(err); }
                if( single ){
                    return callback( null, componentDefs[0], entity );
                }
                return callback( null, components, entity );
            });
        },

        /**
         * Updates the fields of a component(s) in the database
         *
         * If an array, all components must be of the same type
         * 
         * @param  {[type]}   components [description]
         * @param  {[type]}   options    [description]
         * @param  {Function} callback   [description]
         * @return {[type]}              [description]
         */
        updateComponent: function( components, entity, options, callback ){
            options = options || {};
            components = _.isArray(components) ? components : [components];
            entity = this.toEntity(entity);
            
            return this.storage.updateComponent( components, entity, options, callback );
        },


        /**
         * Converts an entity id to an entity instance
         * 
         * @param  {[type]} entityId [description]
         * @return {[type]}          [description]
         */
        toEntity: function(entityId){
            var result = odgnEntity.Entity.toEntity(entityId);
            if( result )
                result.registry = this;
            return result;
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
        createEntitySet: function( attrs, options, callback ){
            return this.storage.createEntitySet( attrs, options, callback );
        },


        addSystem: function( systemModel, options, callback ){
            var self = this;
            options = options || {};
            var System = systemModel;
            systemModel = systemModel.Model || systemModel;
            var systemId = System.id || options.id;

            var priority = _.isUndefined(options.priority) ? 100 : options.priority;
            var updateable = _.isUndefined(options.update) ? true : options.update;
            var system = (System.create || odgnEntity.EntitySystem.create)(
                {id:systemId, priority:priority, updateable:updateable}, 
                {Model:systemModel,registry:this});

            if( callback && system.addToRegistry ){
                return system.addToRegistry( this, options, function(err){
                    self._systems.add( system );
                    self.trigger('system:add', system, self );
                    return callback(err, system, self);
                });
            }
            self._systems.add( system );
            self.trigger('system:add', system, self );
            return system;
        },

        startUpdateLoop: function( options ){
            var fps = options.fps;
            if( fps <= 0 )
                return;
            var intervalMs = (1/fps)*1000;
            this._updateIntervalId = setInterval( this.update, intervalMs );
        },

        stopUpdateLoop: function(){
            if( this._updateIntervalId ){
                this._updateIntervalId = clearInterval( this._updateIntervalId );
            }
        },

        update: function( callback ){
            var self = this;
            var now = Date.now();
            var dt = now - this.updateLastTime;
            this.updateLastTime = now;
            this.updateStartTime += dt;
            var updateOptions = {};
            var system;

            // print_ins( this, 1);
            this.trigger('system:update:start', this);
            // log.debug(this._systems.models.length + ' system updates');

            async.eachSeries( this._systems.models, function(system, cb){
                if( system.get('updateable') ){
                    // log.debug('updating system ' + system.id );
                    return system.update(dt,self.updateStartTime,now,updateOptions,function(err){
                        system.set({lastUpdated:now});
                        cb(err);
                    });
                }
                // print_ins(system.attributes,1);
                // log.debug('not updating system ' + system.id + ' ' + system.get('updateable') + ' ' + JSON.stringify(system.attributes) );
                return cb();
            }, function(err){
                self.trigger('system:update:finish', this);
                if( callback ){
                    callback(err);
                }
            });
        }
    });


    

    /**
     * creates a new registry instance
     * 
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    Registry.create = function(options){
        options = options || {};
        var cr = new Registry();
        if( options.initialize ){
            return cr.initialize( options, callback );
        } 

        // memory storage will always be present, as well
        // as acting as primary storage in abscence of any
        // other
        return cr.useStorage( MemoryStorage, options );
        // return cr.memoryStorage = cr.useStorage( MemoryStorage, options, function(err,storage){
        //     return callback(err, cr);
        // });
    };

if( typeof module !== 'undefined' && module.exports ){
    module.exports = Registry; //{ create:Registry.create };
}

// }).call(this);