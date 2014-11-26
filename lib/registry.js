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

        this.schemaRegistry = options.schemaRegistry || SchemaRegistry.create();

        // listen to when the schema registry registers and unregisters schemas
        this.listenTo( this.schemaRegistry, 'schema:add', this.schemaAdded );
        this.listenTo( this.schemaRegistry, 'schema:remove', this.schemaRemoved );

        // current index of component defs
        this._componentDefId = 1;
        // an array of component def ids to componentDef objects
        this._componentDefs = [];

        // a map of componentDef schema ids to componentDef objects
        this._componentSchemaIds = {};

        // a map of componentDefs keyed by their hash
        this._componentDefsBySchemaHash = [];
        this._schemaHashComponentDefIds = {};

        // ComponentDef constant names
        this.ComponentDef = {};

        this.updateLastTime = Date.now();
        this.processors = new Backbone.Collection();
        this.processors.comparator = function(system){
            return system.get('priority');
        };

        return this;
    },


    schemaAdded: function( schemaUri, schemaHash, schema ){
        // derive an id for this schema
        var componentDefId = this._componentDefId++;
        this._componentDefsBySchemaHash[ componentDefId ] = schemaHash;
        this._schemaHashComponentDefIds[ schemaHash ] = componentDefId;
    },

    schemaRemoved: function( schemaUri, schemaHash, schema ){
        log.debug('schema removed from registry');
        var componentDefId = this._schemaHashComponentDefIds[ schemaHash ];
        if( componentDefId ){
            delete this._schemaHashComponentDefIds[ schemaHash ];
            this._componentDefsBySchemaHash[ componentDefId ] = undefined;
        }
    },


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
        // var self = this;
        // var isSingle = false;
        var schema;


        // if( !self._initialized ){
        //     throw new Error('registry is uninitialized');
        // }


        // // if we have an array of components, then register each in turn
        // if( _.isArray(data) ){
        //     var result = [];
        //     for( var i in data ){
        //         result.push( this.registerComponent(data[i], options) );
        //     }
        //     return result;
        // }

        // if( ComponentDef.isComponentDef(data) ){
        //     componentDef = data;
        //     // are we already registered?
        //     if( this.getComponentDef(componentDef.id) ){
        //         throw new Error(data.id + ' is already registered');
        //         // return componentDef;
        //     }

        //     this.schemaRegistry.register( componentDef.getSchema() );

        //     schema = this.schemaRegistry.get( data.id, {full:true} );

        //     if( componentDef.isNew() ){
        //         componentDef.set({id:++self._componentDefId});
        //     }

        //     componentDef = self._addComponentToRegistry( componentDef, options );
        //     self.trigger('component:register', componentDef, options );
        //     return componentDef;
        // }

        // register the schema with the registry
        schema = this.schemaRegistry.register( data );
        if( data.id ){
            schema = schema[0];
        }
        return schema;
        // schema = this.schemaRegistry.get( data.id, {full:true} );

        // var defaults = this.schemaRegistry.getPropertiesObject( data.id );

        // create a ComponentDef instance
        // var componentDef = ComponentDef.create( data, null, defaults, options );

        // check whether we already have this ComponentDef registered
        
        // componentDef.set({id:++self._componentDefId});
        // componentDef = self._addComponentToRegistry( componentDef, options );

        // self.trigger('component:register', componentDef, options );

        // return componentDef;
    },

    componentNameFromSchema: function( schemaUri, suffix ){
        var name;
        var schema = this.schemaRegistry.get( schemaUri, null, {full:true} );

        if( !schema ){
            throw new Error('unknown schema ' + schemaUri );
        }

        suffix = _.isUndefined(suffix) ? '' : suffix;

        if( schema.obj.name ){
            name = schema.obj.name;
        } else {
            name = schema.uri;
            name = name.split('/').pop();
        }

        // log.debug('name for ' + schemaUri + ' is ' + name + ' ' + _.str.classify( name + suffix ) );
        
        return _.str.classify( name + suffix );
    },

    // /**
    // *   Adds the component to the various internal structures
    // */
    // _addComponentToRegistry: function( componentDef, options ){
    //     // log.debug('_addComponentToRegistry ' + componentDef.id + ' ' + componentDef.getSchemaId() );
    //     // map from the componentDef id (int) to the componentDef
    //     this._componentDefs[ componentDef.id ] = componentDef;
    //     // map from the componentDefs schema (string) to the componentDef
    //     this._componentSchemaIds[ componentDef.getSchemaId() ] = componentDef;
    //     this.ComponentDef[ componentDef.get('name') ] = componentDef.id;
    //     return componentDef;
    // },


    // /**
    // *   Removes the componentDef from the registries internal structures
    // */
    // _removeComponentFromRegistry: function( componentDef, options ){
    //     var defId = componentDef.id;
    //     var schemaUri = componentDef.getSchemaId();
    //     var name = componentDef.get('name');

    //     delete this._componentDefs[ defId ];
    //     delete this._componentSchemaIds[ schemaUri ];
    //     delete this.ComponentDef[ name ];
    //     return componentDef;
    // },

    
    /**
     * Returns a component definition using
     * some sort of id
     * 
     * @param  {[type]} defId [description]
     * @return {[type]}       [description]
     */
    getComponentDef: function( defId, options ) {
        var self = this
        var returnId;
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
     * @param  {[type]} schemaUri [description]
     * @return {[type]}          [description]
     */
    createComponent: function( componentDef, data, options ){
        var self = this;
        var i, len;
        var componentEntity;
        var component;
        var schema;
        var defaults;
        var datum;
        var doRegister = false;
        var entityId;
        var defId;

        options || (options = {});

        entityId = options.entity || options.entityId;

        // options can either dicate the entity id, or indicate that a new entity should be created
        // componentEntity = options.entity || options.createEntity;
        // if( _.isBoolean(componentEntity) )
        //     componentEntity = null;

        // Obtain a component schema
        if( _.isArray(componentDef) ){
            // recurse each entry
            return Array.prototype.concat.apply( [], componentDef.map( function(s){
                return self.createComponent( s, data, options );
            }) );
        }
        else if( _.isObject(componentDef) ){
            if( componentDef.id ){
                schema = componentDef.id;
                doRegister = true;
            }
            else if( componentDef._s ){
                schema = componentDef._s;
                data = _.omit( componentDef, '_s' );
            }
            // attempt to retrieve existing already
            if( schema ){
                schema = this.schemaRegistry.get( schema, null, {full:true} );
            }

            // no existing - go ahead and register
            if( !schema && doRegister ){
                schema = this.schemaRegistry.register( componentDef );
                schema = schema[0];
                // log.debug('registered schema ' + schema.uri );
            }
        }
        else {
            schema = this.schemaRegistry.get(componentDef, null, {full:true});
        }

        if( !schema ){
            throw new Error('no schema found for component ' + JSON.stringify(componentDef) );
        }

        defId = this._schemaHashComponentDefIds[ schema.hash ];
        name = this.componentNameFromSchema( schema.hash );
        
        // obtain default properties from the schema
        defaults = this.schemaRegistry.getPropertiesObject( schema.uri );

        

        if( _.isArray(data) ){
            result = [];

            for( i=0,len=data.length;i<len;i++ ){
                result.push( _createComponent( defId, name, schema, defaults, data[i], entityId, options ) );
            }

            return result;
        }



        return _createComponent( defId, name, schema, defaults, data, entityId, options );

        /*
        var isSingle = !_.isArray(componentDef);
        componentDef = isSingle ? [componentDef] : componentDef;

        // convert each of the def ids into a component instance
        var components = componentDef.map( function(id){
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

        return isSingle ? components[0] : components;//*/        
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

/**
*   Create a component instance from the supplied 
*/
function _createComponent( defId, name, schema, defaults, data, entityId, options ){
    var component;
    var datum;

    datum = _.extend({}, defaults, data );

    component = Component.create( datum, _.extend({},options,{parse:true}) );
    
    component.schemaUri = schema.uri;

    component.name = name;
    component.defId = defId;
    component.schemaHash = schema.hash;
    
    if( entityId ){
        component.setEntityId( entityId );
    }

    return component;
}


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
        res.push( indent + 'c' + com.name 
            + ' (' + com.id  + '/' + com.defId + '/' + com.cid 
            + ') ^' + com.getEntityId() 
            + ' ' + com.hash()
            + ' ' + JSON.stringify(_.omit(com.toJSON(),'id') ));
        // com.schemaHash
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
