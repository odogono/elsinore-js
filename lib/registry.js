var assert = require('assert');
var _ = require('underscore');
var Backbone = require('backbone');
var Promise = require('bluebird');

var Entity = require('./entity');
var MemoryStorage = require('./memory_storage');
var Component = require('./component');
var ComponentDef = require('./component_def');
var SchemaRegistry = require('./schema_registry');
var EntityProcessor = require('./entity_processor');


var BatchTypeEnum = {
    IMPORT_COMPONENT: 1
};



/**
 * Registry
 * @return {[type]} [description]
 */
var Registry = function(){
};


_.extend(Registry.prototype, Backbone.Events, {

    /**
     * Initialises the entity store
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    initialize: function(options){
        var self = this;
        options = options || {};
        _.bindAll( this, 'update' );

        this._initialized = true;

        this._schemaRegistry = options.schemaRegistry || SchemaRegistry.create();

        // current index of component defs
        this._componentDefId = 1;
        // an array of component def ids to componentDef objects
        this._componentDefs = [];
        // a map of componentDef schema ids to componentDef objects
        this._componentSchemaIds = {};

        // ComponentDef constant names
        this.ComponentDef = {};

        this.updateLastTime = Date.now();
        this.processors = new Backbone.Collection();
        this.processors.comparator = function(system){
            return system.get('priority');
        };

        // we use an entityset to keep track of all entities and components
        // this.entitySet = odgnEntity.EntitySet.create( this.memoryStorage, this, options );
        
        var storage = options.storage || MemoryStorage;

        return this.useStorage( storage, options );
    },

    // _bindStorageEvents: function( storage ){
    //     var self = this; 
    //     if( this._existingBoundStorage ){
    //         this.stopListening( this._existingBoundStorage );
    //     }
    //     this._existingBoundStorage = storage;
    //     storage.on('all', function(evt){
    //         // log.debug('storage event ' + evt );
    //         self.trigger.apply( self, arguments );
    //     });
    // },

    /**
     * 
     * @param  {[type]} mw [description]
     * @return {[type]}    [description]
     */
    useStorage: function( mw, options ){
        var self = this;
        var storage = mw;

        if( this.storage ){
            this.stopListening( this.storage );
        }

        if( !mw ){
            this.storage = null;
            return Promise.resolve( this );
        }

        if( !mw.create ){
            return Promise.reject(new Error('invalid storage passed'));
        }

        storage = mw.create(this, options);
        
        this.storage = storage;
        storage.registry = self;

        this.listenTo( this.storage, 'all', function(evt){
            self.trigger.apply( self, arguments );
        });


        // log.debug('using storage ' + storage );

        return storage.initialize( options )
            .then(function(storage){
                // return 'poop';
                // return Promise.resolve(self);
                return self;
            });
    },


    /**
     * Returns a Promise of a new entity
     * 
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    createEntity: function( components, options){
        var self = this;
        var entity;
        var entityId;

        if( !_.isArray(components) && _.isObject(components) ){
            options = components;
            components = null;
        }

        if( options && options.id ){
            entityId = options.id;
        }

        entity = this.toEntity(entityId);

        return this.storage.createEntity( entity )
            .then( function(entity){
                self.trigger('entity:create', entity);
                return entity;
            })
            .then( function(entity){
                if( components ){
                    return self.addComponent( components, entity, options )
                        .then(function(){
                            return entity;
                        })
                }
                return entity;
            });
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
        var entity = this.toEntity(entityId);
        
        if( !entity ){
            return Promise.reject(new Error('invalid entityId passed'));
        }

        entityId = entity.id;

        // remove and destroy all components from this entity

        // destroy the entity

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
     * Imports an entity and its associated components
     * 
     * @param  {[type]}   dataArray     [description]
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    importEntity: function( dataArray, options, callback ){
        // var self = this;
        // var isSingle = false;
        // var Schema = odgnEntity.Schema;
        // var entityResults = [];

        // if( !_.isArray(dataArray) ){
        //     isSingle = true;
        //     dataArray = [dataArray];
        // }

        // return async.map( dataArray, 
        //     function(entityData,entityDataCb){
        //         return async.waterfall([
        //             function createEntity(createEntityCb){
        //                 self.createEntity( _.extend({id:entityData.id},options), createEntityCb);
        //             },
        //             function createComponents (entityResult,cb){
        //                 entityResults.push( entityResult );
        //                 // log.debug('umm hey');
        //                 // log.debug('addCom ' + JSON.stringify(entityData) );
        //                 self.addComponent( entityData.components, entityResult, cb );
        //             }
        //         ], entityDataCb );
        //     },
        //     function( err ){
        //         if( err ){ log.debug('importEntity error ' + err ); return callback(err); }
        //         return callback(err, (isSingle && entityResults.length > 0) ? entityResults[0] : entityResults );
        //     });

        throw new Error('Not Yet Implemented');
    },


    /**
        Begins a batch operation
    */
    begin: function( type, options ){
        return this.storage.begin( type, options );
    },

    /**
        Ends a batch operation
    */
    end: function( type, options ){
        return this.storage.end( type, options );
    },

    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent: function( data, options ){
        var self = this;
        var isSingle = false;
        var schema;

        if( !self._initialized ){
            return Promise.reject(new Error('registry is uninitialized'));
        }

        // if we have an array of components, then register each in turn
        if( _.isArray(data) ){
            var current = Promise.resolve();
            return Promise.map( data, function(comData){
                return current = current.then( function(){
                    return self.registerComponent(comData);
                });
            });
        }

        if( this._schemaRegistry.get(data.id) ){
            return Promise.reject(new Error(data.id + ' is already registered'));
        }

        this._schemaRegistry.register( data );
        var defaults = this._schemaRegistry.getPropertiesObject( data.id );

        // create a ComponentDef instance
        var componentDef = ComponentDef.create( data, null, defaults, options );

        // check whether we already have this ComponentDef registered
        return this.storage.registerComponent( componentDef, options )
            .then( function(componentDef){

                componentDef = self._addComponentToRegistry( componentDef, options );

                self.trigger('component:register', componentDef, self, options );

                return componentDef;
            });
    },


    /**
    *   Adds the component to the various internal structures
    */
    _addComponentToRegistry: function( componentDef, options ){
        // map from the componentDef id (int) to the componentDef
        this._componentDefs[ componentDef.id ] = componentDef;
        // map from the componentDefs schema (string) to the componentDef
        this._componentSchemaIds[ componentDef.getSchemaId() ] = componentDef;
        this.ComponentDef[ componentDef.get('name') ] = componentDef.id;
        return componentDef;
    },


    /**
    *   Removes the componentDef from the registries internal structures
    */
    _removeComponentFromRegistry: function( componentDef, options ){
        delete this._componentDefs[ componentDef.id ];
        delete this._componentSchemaIds[ componentDef.getSchemaId() ] = componentDef;
        delete this.ComponentDef[ componentDef.get('name') ];
        return componentDef;
    },


    importComponents: function( data, options ){
        var self = this;
        if( !_.isArray(data) ){
            return Promise.reject(new Error('import takes array only'));
        }

        // process each of the components in series
        return this.begin( BatchTypeEnum.IMPORT_COMPONENT, options )
            .then(function(){
                var current = Promise.fulfilled();

                return Promise.all( data.map( function(def){
                    return current = current.then( function(){
                        return self.registerComponent( def, options );
                    });
                }) );
            })
            .then( function(){
                return self.end(BatchTypeEnum.IMPORT_COMPONENT, options);  
            })
    },
    

    clearComponents: function(){

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
            if( ComponentDef.isComponentDef(defId) ){
                return defId;
            }
        }
        var fromSchema = this._componentSchemaIds[ defId ];
        if( fromSchema ){
            return fromSchema;
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
        var notNull = function(it){ return ComponentDef.isComponentDef(it); };
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
    createComponent: function( componentDefId, attrs, options ){
        var self = this, 
            componentDef;
        options = options || {};
        var isSingle = !_.isArray(componentDefId);

        componentDefId = isSingle ? [componentDefId] : componentDefId;

        // convert each of the def ids into a component instance
        var components = componentDefId.map( function(id){
            var def = self.getComponentDef( id );
            if( !def ){
                return Promise.reject( 'componentDef ' + id + ' not found' );
            }
            var component = def.create( attrs, options );
            component.registry = self;
            return component;
        });

        return this.storage.saveComponent( components, options )
            .then( function(components){
                var result = isSingle ? components[0] : components;
                self.trigger('component:create', result, self );
                return result;
            });
    },

    /**
    *   Creates a component instance from a data object
    */
    instantiateComponent: function( componentDefId, attrs, options ){
        var def = this.getComponentDef( componentDefId );
        if( _.isArray(attrs) ){
            return _.map( attrs, function(attr){
                var component = def.create( attr, options );
                component.registry = this;
                return component;
            });
        } else {
            var component = def.create( attrs, options );
            component.registry = this;
            return component;
        }
    },


    /**
     * Calling this indicates that the given
     * component is no longer needed.
     * 
     * @param  {Component} component [description]
     * @return {[type]}           [description]
     */
    destroyComponent: function( component, callback ){
        var self = this;
        return async.nextTick( function(){
            // first fire the event
            this.trigger('free', component);
            // then perform freeing
            return callback();
        });
    },




    /**
     * Adds a component to an entity

     * @param  {[type]}   entity    [description]
     * @param  {[type]}   component [description]
     * @param  {Function} callback  [description]
     * @return {[type]}             [description]
     */
    addComponent: function( componentDef, entity, options ){
        var self = this;
        // var componentDefs = _.isArray(componentDef) ? componentDef : [ componentDef ];

        // if( _.isArray(componentDef) ){
        //     var current = Promise.resolve();
        //     return Promise.map( componentDef, function(cdef){
        //         return current = current.then( function(){
        //             return self.addComponent(cdef);
        //         });
        //     });
        // }

        // for( var i in componentDefs ){
        //     componentDef = componentDefs[i];
        //     componentDef = this.getComponentDef( componentDef );

        // }

        // var components = componentDefId.map( function(id){
        //     var def = self.getComponentDef( id );
        //     if( !def ){
        //         return Promise.reject( 'componentDef ' + id + ' not found' );
        //     }
        //     var component = def.create( attrs, options );
        //     component.registry = self;
        //     return component;
        // });

        // componentDef = this.getComponentDef( componentDef );

        // if( !componentDef ){
        //     return Promise.reject(new TypeError('unknown component def passed') );
        // }
        // resolve the componentDef into a component instance
        return this.createComponent( componentDef, null, options )
            .then( function(component){
                return self.storage.addComponent( component, entity, options )
                    .then( function(components){
                        // map each of the components onto the entity as entity[ComponentDef.name]
                        // if( _.isArray(component) ){
                        _.each( components, function(com){
                            entity[ com.ComponentDef.get('name') ] = com;
                        });
                        return entity;
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
        var result = Entity.toEntity(entityId);
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

    destroyEntitySet: function( entitySet ){
        return this.storage.destroyEntitySet( entitySet );
    },

    addProcessor: function( processorModel, options, callback ){
        var self = this;
        options = options || {};
        var ProcessorId = processorModel.id || options.id;

        var priority = _.isUndefined(options.priority) ? 100 : options.priority;
        var updateable = _.isUndefined(options.update) ? true : options.update;
        var processor = (processorModel.create || EntityProcessor.create)(
            {id:processorId, priority:priority, updateable:updateable}, 
            {Model:processorModel,registry:this});

        if( callback && processor.addToRegistry ){
            return processor.addToRegistry( this, options, function(err){
                self.processors.add( processor );
                self.trigger('processor:add', processor, self );
                return callback(err, processor, self);
            });
        }
        self.processors.add( processor );
        self.trigger('processor:add', processor, self );
        return processor;
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

        this.trigger('processor:update:start', this);

        var current = Promise.fulfilled();

        return Promise.all( 
            this.processors.models.map( function(processor){
                return current = current.then(function() {
                    // log.debug('calling update ' + dt );
                    return processor.update( dt, self.updateStartTime, now, updateOptions );
                });
            })).then( function( results ){
                self.trigger('processor:update:finish', self );
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
    var result = new Registry();
    // log.debug('creating registry with ' + JSON.stringify(options) );
    return result;
};


module.exports = Registry;
