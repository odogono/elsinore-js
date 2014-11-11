var _ = require('underscore');
var Backbone = require('backbone');
var Promise = require('bluebird');

var BitField = require('./bit_field');
var Entity = require('./entity');
var EntitySet = require('./entity_set');
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
        options || (options = {});
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

        return this;
    },

    // /**
    // *   Convenience function for creating many entities
    // */
    // createEntities: function( entityArray, options ){
    //     var self = this;
    //     var current = Promise.resolve();
    //     return Promise.map( entityArray, function(entity){
    //         current = current.then( function(){
    //             return self.createEntity( entity, options );
    //         });
    //         return current;
    //     });
    // },


    createEntity: function( components, options ){
        var entityId;
        var entity;

        if( options && options.id ){
            entityId = options.id;
        }

        entity = Entity.toEntity(entityId);
        entity.registry = this;

        if( !components )
            return entity;

        components = this.createComponent( components );
        
        entity.addComponent( components );

        return entity;
    },


    // /**
    //  * Returns a Promise of a new entity
    //  * 
    //  * @param  {Function} callback [description]
    //  * @return {[type]}            [description]
    //  */
    // createEntity: function( components, options){
    //     var self = this;
    //     var entity;
    //     var entityId;

    //     if( options && options.id ){
    //         entityId = options.id;
    //     }
    //     entity = this.toEntity(entityId);

    //     return this.addComponent( components, entity, options )
    //         .then( function(entity){
    //             return entity;
    //         });
    // },


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
            throw new Error('registry is uninitialized');
        }


        // if we have an array of components, then register each in turn
        if( _.isArray(data) ){
            var result = [];
            for( var i in data ){
                result.push( this.registerComponent(data[i], options) );
            }
            return result;
            // var current = Promise.resolve();
            // return Promise.map( data, function(comData){
            //     return current = current.then( function(){
            //         return self.registerComponent(comData, options);
            //     });
            // });
        }

        if( ComponentDef.isComponentDef(data) ){
            componentDef = data;
            // are we already registered?
            if( this.getComponentDef(componentDef.id) ){
                throw new Error(data.id + ' is already registered');
                // return componentDef;
            }

            this._schemaRegistry.register( componentDef.getSchema() );

            if( componentDef.isNew() ){
                componentDef.set({id:++self._componentDefId});
            }

            componentDef = self._addComponentToRegistry( componentDef, options );
            self.trigger('component:register', componentDef, options );
            return componentDef;
        }

        if( this._schemaRegistry.get(data.id) ){
            throw new Error(data.id + ' is already registered');
        }

        // register the schema with the registry
        this._schemaRegistry.register( data );

        var defaults = this._schemaRegistry.getPropertiesObject( data.id );

        // create a ComponentDef instance
        var componentDef = ComponentDef.create( data, null, defaults, options );

        // check whether we already have this ComponentDef registered
        
        componentDef.set({id:++self._componentDefId});
        componentDef = self._addComponentToRegistry( componentDef, options );

        self.trigger('component:register', componentDef, options );

        return componentDef;
    },


    /**
    *   Adds the component to the various internal structures
    */
    _addComponentToRegistry: function( componentDef, options ){
        // log.debug('_addComponentToRegistry ' + componentDef.id + ' ' + componentDef.getSchemaId() );
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
        var defId = componentDef.id;
        var schemaId = componentDef.getSchemaId();
        var name = componentDef.get('name');

        delete this._componentDefs[ defId ];
        delete this._componentSchemaIds[ schemaId ];
        delete this.ComponentDef[ name ];
        return componentDef;
    },

    
    /**
     * Returns a component definition using
     * some sort of id
     * 
     * @param  {[type]} defId [description]
     * @return {[type]}       [description]
     */
    getComponentDef: function( defId, options ) {
        var self = this, returnId;
        options || (options = {});
        if( !defId )
            return null;
        returnId = options.returnId;
        if( _.isArray(defId) ){
            return _.map(defId, function(d){ return self.getComponentDef(d) });
        }
        if( typeof defId === 'number' && defId % 1 == 0 ){
            if( returnId )
                return this._componentDefs[ defId ].id;
            return this._componentDefs[ defId ];
        }
        else if( typeof defId === 'object' ){
            if( defId.schema ){
                defId = defId.schema;
            }
            else if( ComponentDef.isComponentDef(defId) ){
                defId = defId.getSchema();
                // if( returnId )
                //     return defId.id;
                // defId = defId.id;
            }
        }

        var fromSchema = this._componentSchemaIds[ defId ];
        if( fromSchema ){

            if( returnId )
                return fromSchema.id;
            return fromSchema;
        }
        fromSchema = this._componentSchemaIds['/component/'+defId];
        if( fromSchema ){
            if( returnId )
                return fromSchema.id;
            return fromSchema;
        }
        return null;
    },

    /**
    *   Returns a bitfield with the supplied componentDef ids set
    */
    getComponentDefBitfield: function( defId ){
        var i,len,result = BitField.create();
        var defs = this.getComponentDef(defId);

        if( !_.isArray(defs) ){
            result.set( defs.id, true );
        }
        else{
            for( i=0,len=defs.length;i<len;i++){
                result.set( defs[i].id, true );
            }
        }
        return result;
    },



    /**
     * Creates a new component instance
     * 
     * TODO : determine whether components should ever be created without adding to an entity
     *
     *   There is never really a case where we are creating multiple instances of a single
     *   ComponentDef
     *
     * @param  {[type]} schemaId [description]
     * @return {[type]}          [description]
     */
    createComponent: function( componentDefId, options ){
        var self = this, 
            componentDef;
        options || (options = {});

        // options can either dicate the entity id, or indicate that a new entity should be created
        var componentEntity = options.entity || options.createEntity;
        if( _.isBoolean(componentEntity) )
            componentEntity = null;

        var isSingle = !_.isArray(componentDefId);
        componentDefId = isSingle ? [componentDefId] : componentDefId;

        // convert each of the def ids into a component instance
        var components = componentDefId.map( function(id){
            var attrs;
            // we may have been passed an object which contains both attributes for the component
            // and the id of the component.
            if( _.isObject(id) ){
                if( id.schema ){
                    attrs = _.omit( id, 'schema' );
                    id = id.schema;
                } else if( id.defId ){
                    attrs = _.omit( id, 'defId' );
                    id = id.defId;
                } else if( id._s ){
                    attrs = _.omit( id, '_s' );
                    id = id._s;
                }
            }
            var def = self.getComponentDef( id );
            if( !def ){
                throw new Error('could not find Component Def for ' + JSON.stringify(id) );
            }
            var component = def.create( attrs, options );
            component.registry = self;
            if( componentEntity ){
                component.setEntityId( componentEntity.id );
            }
            return component;
        });

        return isSingle ? components[0] : components;        
    },

    // /**
    //  * Adds a component to an entity

    //  * @param  {[type]}   entity    [description]
    //  * @param  {[type]}   component [description]
    //  * @param  {Function} callback  [description]
    //  * @return {[type]}             [description]
    //  */
    // addComponent: function( componentDef, entity, options ){
    //     var self = this;
    //     options || (options = {});
    //     entity = this.toEntity(entity);
    //     options.createEntity = entity.isNew() ? true : entity;
        
    //     return this.createComponent( componentDef, options )
    //         .then(function(components){
    //             return self.storage.retrieveComponentEntity( _.isArray(components) ? components[0] : components );
    //         });
    // },


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


    // /**
    //     Begins a batch operation
    // */
    // begin: function( type, options ){
    //     return this.storage.begin( type, options );
    // },

    // /**
    //     Ends a batch operation
    // */
    // end: function( type, options ){
    //     return this.storage.end( type, options );
    // },

    /**
     * Creates a new EntitySet instance.
     * @param  {[type]}   components [description]
     * @param  {[type]}   options    [description]
     * @param  {Function} callback   [description]
     * @return {[type]}              [description]
     */
    createEntitySet: function( options ){
        var self = this;
        options || (options={});
        var instanceClass = EntitySet;

        if( options.EntitySet ){
            instanceClass = options.EntitySet;
            delete options.EntitySet;
        }

        if( options.defs ){
            options.defs = this.getComponentDef(options.defs,{returnId:true});
        }

        var result = instanceClass.create(options);
        result.setRegistry( this );
        return result;
    },

    addProcessor: function( processorModel, options ){
        var self = this;
        // var entitySet;
        options || (options = {});
        var processorId = processorModel.id || options.id;

        var priority = _.isUndefined(options.priority) ? 100 : options.priority;
        var updateable = _.isUndefined(options.update) ? true : options.update;
        var processor = (processorModel.create || EntityProcessor.create)(
            {id:processorId, priority:priority, updateable:updateable}, 
            {Model:processorModel,registry:this});

        // if( callback && processor.addToRegistry ){
        //     return processor.addToRegistry( this, options, function(err){
        //         self.processors.add( processor );
        //         self.trigger('processor:add', processor, self );
        //         return callback(err, processor, self);
        //     });
        // }

        // initialise the entityset for the processor
        processor.entitySet = processor.createEntitySet( this );
        
        self.processors.add( processor );
        self.trigger('processor:add', processor );
        return processor;

        // return processor.createEntitySet( this )
        //     .then(function(es){
        //         processor.entitySet = es;
        //     })
        //     .then( function(){
        //         self.processors.add( processor );
        //         self.trigger('processor:add', processor );
        //         return processor;        
        //     });
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

function entityToString(entity, indent){
    var res = [];
    var comDefId;
    var com;
    indent || (indent='');
    
    res.push( indent + '- e(' + entity.id + '/' + entity.cid + ')' );
    indent += '  ';
    for( comDefId in entity.components ){
        com = entity.components[comDefId];
        if( !com )
            continue;
        res.push( indent + 'c' + com.ComponentDef.getName() 
            + ' (' + com.id  + '/' + com.ComponentDef.id + '/' + com.cid 
            + ') ^' + com.getEntityId() 
            + ' ' + com.hash()
            + ' ' + JSON.stringify(_.omit(com.toJSON(),'id') ));
    }
    return res;
}

function entitySetToString(es, indent){
    var res = [];
    indent || (indent='');
    res.push( indent + '- es(' + es.cid + ')' )
    es.each( function(e){
        res = res.concat( entityToString(e, indent+'  ') );
    });
    return res;
}

function toString(entity){
    var res = [''];
    var e;
    if( _.isArray(entity) ){
        entity.each( function(e){
            res = res.concat( toString(e) );
        });
        return res.join('');
    }
    if( Entity.isEntity(entity) ){
        res = res.concat( entityToString(entity) );
    } else if( EntityProcessor.isEntityProcessor(entity) ){
        res = res.concat( entitySetToString( entity.entitySet ) );
    } else if( EntitySet.isEntitySet(entity) ){
        res = res.concat( entitySetToString( entity ) );
    }
    return res.join("\n");
}

Registry.toString = toString;


/**
 * creates a new registry instance
 * 
 * @param  {[type]}   options  [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Registry.create = function(options){
    options || (options = {});
    var result = new Registry();
    result.initialize();
    return result;
};


module.exports = Registry;
