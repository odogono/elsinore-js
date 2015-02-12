'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Promise = require('bluebird');

var BitField = require('./bit_field');
var Entity = require('./entity');
var EntitySet = require('./entity_set');
var Component = require('./component');
// var ComponentDef = require('./component_def');
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


function createProcessorCollection(){
    var result = new Backbone.Collection();
    result.comparator = function(procA, procB){
        return procA.get('priority') > procB.get('priority');
    };
    return result;
}

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

        // a number used to assign id numbers to things - entities, components, entitysets
        this.sequenceCount = options.sequenceCount || 0;

        this.entitySetCount = options.entitySetCount || 0;

        // number of entity sets added - this also serves as
        // a way of assigning ids to entitysets
        this.entitySetCount = 0;

        // an array of entitysets created and active
        this._entitySets = new Backbone.Collection();

        // a map of entitySet ids mapped to a backbone collection of processors
        // for the particular entitySet
        this._entitySetProcessors = {};        

        // // an object of entity set ids -> instances
        // this._entitySetIds = {};

        // current index of component defs
        this._componentDefId = 1;
        // an array of component def ids to componentDef objects
        this._componentDefs = [];

        // a map of componentDef schema ids to componentDef objects
        this._componentSchemaIds = {};

        // a map of componentDefs keyed by their hash
        // this._componentDefsBySchemaHash = [];
        // this._schemaHashComponentDefIds = {};

        // ComponentDef constant names
        this.ComponentDef = {};

        this.updateLastTime = Date.now();
        this.processors = createProcessorCollection();

        return this;
    },

    /**
    *
    */
    createId: function(){
        return ++this.sequenceCount;
    },


    schemaAdded: function( schemaUri, schemaHash, schema ){
        // log.debug('schema ' + schemaUri + ' added to registry');
        // derive an id for this schema
        // var componentDefId = this._componentDefId++;
        // this._componentDefsBySchemaHash[ componentDefId ] = schemaHash;
        // this._schemaHashComponentDefIds[ schemaHash ] = componentDefId;
    },

    schemaRemoved: function( schemaUri, schemaHash, schema ){
        // log.debug('schema ' + schemaUri + ' removed from registry');
        // var componentDefId = this._schemaHashComponentDefIds[ schemaHash ];
        // if( componentDefId ){
            // delete this._schemaHashComponentDefIds[ schemaHash ];
            // this._componentDefsBySchemaHash[ componentDefId ] = undefined;
        // }
    },


    createEntity: function( components, options ){
        var entityId;
        var entity;
        var i;

        if( options && options.id ){
            entityId = options.id;
        }

        entity = Entity.toEntity(entityId);

        entity.registry = this;

        if( !components ){
            return entity;
        }

        components = this.createComponent( components );
        
        if( _.isArray(components) ){
            for( i in components ) {
                entity.addComponent( components[i] );
            }
        } else {
            entity.addComponent( components ); 
        }

        return entity;
    },


    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent: function( data, options ){
        var schema;

        // register the schema with the registry
        schema = this.schemaRegistry.register( data );
        if( data.id ){
            schema = schema[0];
        }
        return schema;
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

    /**
    * What? name this something better, like 'getComponentIID'
    */
    getIId: function( ){
        // printIns( arguments );
        return this.schemaRegistry.getIId.apply( this.schemaRegistry, arguments );
        // return this.schemaRegistry.getIId( arguments );
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
    createComponent: function( componentDef, attrs, options ){
        var self = this;
        var i, len;
        var name;
        var componentEntity;
        var component;
        var schema;
        var defaults;
        var datum;
        var doRegister = false;
        var entityId;
        var schemaIId;
        var result;

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
                return self.createComponent( s, attrs, options );
            }) );
        }
        else if( Component.isComponent(componentDef) ){
            return componentDef;
        }
        else if( _.isObject(componentDef) ){
            if( componentDef.uri ){
                schema = componentDef.uri;
            }
            else if( componentDef._s ){
                schema = componentDef._s;
                attrs = _.omit( componentDef, '_s' );
            }
            else if( componentDef.id ){
                schema = componentDef.id;
                doRegister = true;
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

        schemaIId = schema.iid;// this._schemaHashComponentDefIds[ schema.hash ];
        name = this.componentNameFromSchema( schema.hash );
        
        // obtain default properties from the schema
        defaults = this.schemaRegistry.getPropertiesObject( schema.uri );

        if( _.isArray(attrs) ){
            result = [];

            for( i=0,len=attrs.length;i<len;i++ ){
                result.push( _createComponent( schemaIId, name, schema, defaults, attrs[i], entityId, options ) );
            }

            return result;
        }



        return _createComponent( schemaIId, name, schema, defaults, attrs, entityId, options );
    },

    destroyComponent: function( component, options ){

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
     * Creates a new EntitySet instance.
     * @param  {[type]}   components [description]
     * @param  {[type]}   options    [description]
     * @param  {Function} callback   [description]
     * @return {[type]}              [description]
     */
    createEntitySet: function( instanceClass, options ){
        var self = this;
        

        if( !instanceClass ){
            instanceClass = EntitySet;
        }
        else if( _.isUndefined(options) 
            && !instanceClass.create
            && _.isObject(instanceClass) ){
            options = instanceClass;
            instanceClass = EntitySet;
        }

        options || (options={});

        if( options.EntitySet ){
            instanceClass = options.EntitySet;
            delete options.EntitySet;
        }

        // create a 20 bit 
        // var id = (Math.random()*0x3fffff)>>>0;
        var id = this.createId();
        var result = instanceClass.create(_.extend( {}, options, {id:id} ));

        // store the entityset against its id
        this._entitySets.add( result );
        
        result.setRegistry( this );

        if( !_.isUndefined(options.filter) ){
            result.setEntityFilter( options.filter, options.defs );
        }

        return result;
    },

    /**
    *
    */
    destroyEntitySet: function( entitySet ){
        var processors;
        if( !entitySet ){
            return null;
        }
        entitySet.setRegistry( null );
        this._entitySets.remove( entitySet );
        // this._entitySetIds.remove( entitySet );

        processors = this._entitySetProcessors[ entitySet.id ];
        if( processors ){
            processors.reset();
            this._entitySetProcessors[ entitySet.id ] = null;
        }
    },

    createEntityFilter: function( spec, options ){

    },


    /**
    *   Adds a new processor instance
    */
    addProcessor: function( processorModel, entitySet, options ){
        var self = this;
        var processor;
        var processorId;
        var processorAttrs;
        var processorOptions;
        var entitySetProcessors;
        var priority;
        var updateable;

        // var entitySet;
        options || (options = {});
        processorId = this.createId(); //processorModel.id || options.id;
        priority = _.isUndefined(options.priority) ? 100 : options.priority;
        updateable = _.isUndefined(options.update) ? true : options.update;

        processorAttrs = {id:processorId, priority:priority, updateable:updateable};
        processorOptions = {Model:processorModel,registry:this};

        if( entitySet ){
            processorAttrs.entitySet = entitySet;
        }

        // create the processor instance using either the passed processor, or the base
        // processor create function
        processor = (processorModel.create || EntityProcessor.create)(
            processorAttrs, processorOptions);

        // create the entity filter(s) specified by the processor
        if( processor.entityFilter ){
            // convert the supplied directives into entityFilter instances

        }

        // store the mapping between the entityset and the processor
        entitySetProcessors = this._entitySetProcessors[ entitySet.id ] || createProcessorCollection(); //new Backbone.Collection();
        entitySetProcessors.add( processor );
        this._entitySetProcessors[ entitySet.id ] = entitySetProcessors;

        // if the processor has event listeners defined, connect those to the entityset
        this._attachEntitySetEventsToProcessor( entitySet, processor );

        self.processors.add( processor );
        self.trigger('processor:add', processor );
        return processor;
    },

    _attachEntitySetEventsToProcessor: function( entitySet, processor ){
        var name;
        var event;
        if( !processor.events ){
            return;
        }
        
        for( name in processor.events ){
            event = processor.events[name];
            // curry the event function so that it receives the entity and the entityset as arguments
            entitySet.listenToEntityEvent( null, name, function( entity ){
                var args = Array.prototype.slice.call( arguments, 1 );
                return event.apply( processor, [entity, entitySet ].concat( args ) );
            });
        }
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
    },

    /**
    *   Updates the processors attached to each entityset
    */
    updateSync: function( timeMs, options ){
        var entitySet;
        var entitySetId;
        var entitySetProcessors;
        var debug;

        options || (options={});
        debug = options.debug;
        
        // iterate through each of the entitysets which have processors
        for( entitySetId in this._entitySetProcessors ){

            entitySetProcessors = this._entitySetProcessors[ entitySetId ];
            entitySet = this._entitySets.get( entitySetId );

            // iterate through each processor attached to the entityset
            entitySetProcessors.each( function(processor){
                // printIns( processor );
                log.debug('executing processor ' + processor.name + ' ' + processor.get('priority') );
                processor.onUpdate( entitySet, timeMs );
            });
        }
    },
});

/**
*   Create a component instance from the supplied 
*/
function _createComponent( schemaIId, name, schema, defaults, data, entityId, options ){
    var component;
    var datum;

    datum = _.extend({}, defaults, data );

    component = Component.create( datum, _.extend({},options,{parse:true}) );
    
    component.schemaUri = schema.uri;

    component.name = name;
    component.schemaIId = schemaIId;
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
    
    res.push( indent + '- e(' + entity.getEntityId() + '/' + entity.getEntitySetId() + '/' + entity.cid + ')' );
    indent += '  ';
    for( comDefId in entity.components ){
        com = entity.components[comDefId];
        if( !com )
            continue;
        res.push( indent + 'c' + com.name 
            + ' (' + com.id  + '/' + com.schemaIId + '/' + com.cid 
            + ') ^' + com.getEntityId() 
            + ' ' + com.hash()
            + ' ' + JSON.stringify(_.omit(com.toJSON(),'id') ));
        // com.schemaHash
    }
    return res;
}

function entitySetToString(es, indent){
    var entity;
    var res = [];
    var it;
    it = es.iteratorSync();
    indent || (indent='');
    res.push( indent + '- es(' + es.id + '/' + es.cid + ')' )
    indent = indent + '  ';
    if( es.entityFilters ){
        _.each( es.entityFilters, function(ef){
            res.push( indent + 'ef( ' + ef.toString() + ' )');    
        });
    }
    while( (entity = it.next().value) ){
        res = res.concat( entityToString(entity, indent) );
    }
    return res;
}

function toString(entity){
    var res = [''];
    var e;
    if( _.isArray(entity) ){
        _.each( entity, function(e){
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
