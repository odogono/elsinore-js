'use strict';

var _ = require('underscore');
var Backbone = require('backbone');

var BitField = require('./bit_field');
var Entity = require('./entity');
var EntitySet = require('./entity_set');
var Component = require('./component');
// var ComponentDef = require('./component_def');
var SchemaRegistry = require('./schema_registry');
var EntityProcessor = require('./entity_processor');
var EntityFilter = require('./entity_filter');
var Utils = require('./utils');


var counter = Date.now() % 1e9;

/**
 * Registry
 * @return {[type]} [description]
 */
var Registry = function(){
};



_.extend(Registry.prototype, Backbone.Events, {
    type: 'Registry',
    isRegistry: true,

    /**
     * Initialises the entity store
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    initialize: function(options){
        var self = this;
        options || (options = {});

        this._initialized = true;

        this.schemaRegistry = options.schemaRegistry || SchemaRegistry.create();

        // listen to when the schema registry registers and unregisters schemas
        // this.listenTo( this.schemaRegistry, 'schema:add', this.schemaAdded );
        // this.listenTo( this.schemaRegistry, 'schema:remove', this.schemaRemoved );

        this.schemaRegistry.on('all', function(){
            self.trigger.apply( self, Array.prototype.slice.call(arguments,0) );
        });

        // a number used to assign id numbers to things - entities, components, entitysets
        this.sequenceCount = options.sequenceCount || 0;

        this.entitySetCount = options.entitySetCount || 0;

        // number of entity sets added - this also serves as
        // a way of assigning ids to entitysets
        this.entitySetCount = 0;

        // an array of entitysets created and active
        this._entitySets = []; //new Backbone.Collection();

        // a map of entitySet ids mapped to a backbone collection of processors
        // for the particular entitySet
        this.entitySetProcessors = createProcessorCollection();// {};    

        // a map of hashes to entity views
        this._entityViews = {};

        // // an object of entity set ids -> instances
        // this._entitySetIds = {};

        // current index of component defs
        // this._componentDefId = 1;
        // an array of component def ids to componentDef objects
        // this._componentDefs = [];

        // a map of componentDef schema ids to componentDef objects
        // this._componentSchemaIds = {};

        // a map of componentDefs keyed by their hash
        // this._componentDefsBySchemaHash = [];
        // this._schemaHashComponentDefIds = {};

        // ComponentDef constant names
        // this.ComponentDef = {};

        this.updateLastTime = Date.now();
        this.processors = createProcessorCollection();

        return this;
    },

    /**
    *
    */
    createId: function(){
        // https://github.com/dfcreative/get-uid
        // var counter = Date.now() % 1e9;
        // return (Math.random() * 1e9 >>> 0) + (counter++ + '__')
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

        options = (options || {});
        // log.debug('createEntity> ' + JSON.stringify(options) );

        if( options.createId ){
            return this.createId();
        }
        if( options.id ){
            // var pId = parseInt(options.id,10);
            // if( pId != options.id ){
            //     throw new Error('mismatch! ' + pId + ' ' + options.id );
            // }
            entityId = options.id;
        }
        else if( options.entity ){
            entityId = options.entity.id;
        }

        if( !entityId ){
            entityId = this.createId();
        }

        if( Entity.isEntity(components) ){
            return components;
        }

        entity = Entity.toEntity(entityId) || Entity.create();
        entity.setRegistry( this );

        // log.debug(' createEntity> ' + entity.cid + ' ' + entity.getEntityId() );

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

    cloneEntity: function( entity, options ){
        var comClone;
        var result = this.createEntity( null, {entity:entity});//Entity.create( entity.getEntityId() );
        // clone each of the attached components
        for( var comId in entity.components ){
            comClone = this.cloneComponent( entity.components[comId] );
            result.addComponent( comClone );
            // this.addComponentToEntity( comClone, result );
        }
        result.registry = this;
        // log.debug('cloned ' + entity.cid + ' into ' + result.cid );
        return result;
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
        return Utils.toPascalCase( name + suffix );
    },

    /**
    * TODO: name this something better, like 'getComponentIID'
    */
    getIId: function(){
        return this.schemaRegistry.getIId.apply( this.schemaRegistry, arguments );
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
        var i, len, name, schema, defaults, entityId, schemaIId, result, schemaKey;
        var doRegister = false;
        
        options || (options = {});

        schemaKey = options.schemaKey || 'id';

        entityId = options.entity || options.entityId || options.eid;

        if( Entity.isEntity(attrs) ){
            entityId = Entity.toEntityId( attrs );
            log.debug('create with entity id ' + entityId );
            attrs = null;
        }

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
        else if( SchemaRegistry.isSchema(componentDef) ){
            schema = componentDef;
            componentDef = null;
        }
        else if( _.isObject(componentDef) ){
            if( componentDef[schemaKey] ){
                schema = componentDef[schemaKey];
                if( !attrs ){
                    attrs = _.omit( componentDef, schemaKey );
                }
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
            }
        }
        else {
            schema = this.schemaRegistry.get(componentDef, null, {full:true});
        }

        if( !schema ){
            // printIns( this );
            throw new Error('no schema found for component ' + JSON.stringify(componentDef) );
        }

        schemaIId = schema.iid;// this._schemaHashComponentDefIds[ schema.hash ];
        name = this.componentNameFromSchema( schema.hash );
        
        // obtain default properties from the schema
        defaults = this.schemaRegistry.getPropertiesObject( schema.uri );

        if( _.isArray(attrs) ){
            result = [];

            for( i=0,len=attrs.length;i<len;i++ ){
                result.push( this._createComponent( schemaIId, name, schema, defaults, attrs[i], entityId, options ) );
            }

            return result;
        }

        return this._createComponent( schemaIId, name, schema, defaults, attrs, entityId, options );
    },

    /**
    *   Create a component instance from the supplied 
    */
    _createComponent: function( schemaIId, name, schema, defaults, data, entityId, options ){
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

        this.trigger('component:create', component.schemaUri, component );

        return component;
    },


    cloneComponent: function( component, options ){
        var result = new component.constructor(component.attributes);
        result.id = component.id;
        result.name = component.name;
        result.schemaIId = component.schemaIId;
        result.schemaUri = component.schemaUri;
        result.schemaHash = component.schemaHash;
        result.registry = this;
        return result;
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
        var id;
        var result;
        // var isAnonymous;

        if( !instanceClass ){
            instanceClass = EntitySet;
        }
        else if( _.isUndefined(options) 
            && !instanceClass.create
            && _.isObject(instanceClass) ){
            options = instanceClass;
            instanceClass = EntitySet;
        }

        options = (options || {})

        if( options.EntitySet ){
            instanceClass = options.EntitySet;
            options.EntitySet = null;
        }

        // create a 20 bit 
        // var id = (Math.random()*0x3fffff)>>>0;
        id = this.createId();
        result = instanceClass.create(_.extend( {}, options, {id:id} ));
        result.setRegistry( this );

        if( options.register !== false ){
            // log.debug('options.register was ' + options.register );
            this.addEntitySet( result );
        }

        return result;
    },

    /**
    *   
    */
    addEntitySet: function( entitySet ){
        if( !entitySet ){ return null; }

        // do we already have this entitySet
        if( _.indexOf(this._entitySets, entitySet) !== -1 ){
            return null;
        }

        // store the entityset against its id
        this._entitySets.push( entitySet );
        
        entitySet.setRegistry( this );

        this.trigger('entityset:add', entitySet );

        return entitySet;
    },

    /**
    *
    */
    destroyEntitySet: function( entitySet ){
        var processors, removeList;
        if( !entitySet ){ return null; }

        entitySet.setRegistry( null );
        this._entitySets = _.without( this.entitySets, entitySet );
        // this._entitySetIds.remove( entitySet );

        // remove  the records
        removeList = this.entitySetProcessors.filter( function(record){
            return record.get('entitySet') == entitySet;
        });

        // TODO: destroy any views attached to the entitySets
        _.each( removeList, function(es){

        });

        processors.remove( removeList );

        // processors = this.entitySetProcessors[ entitySet.id ];

        // if( processors ){
        //     processors.reset();
        //     this.entitySetProcessors[ entitySet.id ] = null;
        // }
    },


    


    triggerEntityEvent: function( name, entity ){
        var entitySet, bf, i, l, trigger;

        // var args = _.toArray( arguments ).slice(2);

        // bf = entity.getComponentBitfield();

        // 1. the bitfield for this entity is extracted

        // 2. check against all registered entitysets/view to determine whether this entity is accepted

        // 3. if accepted, and the es has the entity, trigger that event on that entityset

        // the trick is to only trigger on entitySets that have the entity

        for( i=0,l=this._entitySets.length; i < l; i++ ){
            entitySet = this._entitySets[i];
            // if( !entitySet.entityFilter || entitySet.entityFilter.accept( entity ) ){
            entitySet.triggerEntityEvent.apply( entitySet, arguments );
            // }
        }
    },
});


function createProcessorCollection(){
    var result = new Backbone.Collection();
    result.comparator = function(procA, procB){
        // the entriy in the collection might be a record referencing a processor
        procA = procA.get('processor') || procA;
        procB = procB.get('processor') || procB;
        return procA.get('priority') < procB.get('priority');
    };
    return result;
}


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
