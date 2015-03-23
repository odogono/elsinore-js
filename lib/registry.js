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
var EntityFilter = require('./entity_filter');
var Utils = require('./utils');




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
        this._entitySets = new Backbone.Collection();

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

        if( Entity.isEntity(components) ){
            return components;
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

    cloneEntity: function( entity, options ){
        var comClone;
        var result = Entity.create( entity.getEntityId() );
        // clone each of the attached components
        for( var comId in entity.components ){
            comClone = this.cloneComponent( entity.components[comId] );
            result.addComponent( comClone );
            // this.addComponentToEntity( comClone, result );
        }
        result.registry = this;
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
        var doRegister = false;
        var entityId;
        var schemaIId;
        var result;
        var schemaKey;

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

        options || (options={});

        if( options.EntitySet ){
            instanceClass = options.EntitySet;
            delete options.EntitySet;
        }

        // create a 20 bit 
        // var id = (Math.random()*0x3fffff)>>>0;
        id = this.createId();
        result = instanceClass.create(_.extend( {}, options, {id:id} ));

        // store the entityset against its id
        this._entitySets.add( result );
        
        result.setRegistry( this );

        if( !_.isUndefined(options.filter) ){
            result.setEntityFilter( options.filter, options.defs );
        }

        this.trigger('entityset:add', result );

        return result;
    },

    /**
    *
    */
    destroyEntitySet: function( entitySet ){
        var processors, removeList;
        if( !entitySet ){ return null; }

        entitySet.setRegistry( null );
        this._entitySets.remove( entitySet );
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

    createEntityFilter: function( entityFilter, options ){
        var args;
        var componentIds;
        var filterType;
        var result;
        var self = this;

        if( EntityFilter.isEntityFilter(entityFilter) ){
            return entityFilter;
        }

        // the registry maintains a map of entityfilter hash(int) to entityfilter instances
        // this.entityFilters || (this.entityFilters={});

        args = Array.prototype.slice.call( arguments );

        // extract the options if neccesary
        if( !_.isArray( args[args.length-1] ) && _.isObject(args[ args.length-1 ]) ){
            options = args.pop();
        }

        if( _.isArray( args[0] ) ){
            // the possibility that we have been passed an array of arrays
            if( _.isArray(args[0][0]) ){
                // flatten out by a single level
                args = _.flatten( args, true );
            }

            // we have multiple entityfilter definitions being passed in
            args = _.map( args, function(filterDef){
                var filterType, componentIds;
                if( _.isFunction(filterDef) ){ return filterDef; }
                filterType = filterDef[0];
                componentIds = self.getIId.apply( self, filterDef.slice(1) );
                return [filterType].concat( componentIds );
            });

            result = EntityFilter.create.call( null, args );

        } else if( EntityFilter.isEntityFilter(entityFilter) ) {
            result = entityFilter;
        } else {

            filterType = args[0];
            args = _.flatten( args.slice(1) );
            componentIds = this.getIId.apply( this, args );

            result = EntityFilter.create( filterType, componentIds );
            this.trigger('entityfilter:create', result );
        }

        return result;
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
        
        var priority;
        var updateable;

        // var entitySet;
        options || (options = {});
        processorId = this.createId(); //processorModel.id || options.id;
        priority = _.isUndefined(options.priority) ? 0 : options.priority;
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

        processor.registry = this;

        // create the entity filter(s) specified by the processor
        this._mapEntitySetToProcessor( entitySet, processor );

        // if the processor has event listeners defined, connect those to the entityset
        this._attachEntitySetEventsToProcessor( entitySet, processor );

        self.processors.add( processor );

        self.trigger('processor:add', processor );
        
        return processor;
    },

    /**
        creates a mapping between the entityset and the processor.
        the processor may specify a filter for the given entityset, so
        a view can be generated in that case.
        The given entitySet may also specify that it is not optimal for
        an update, so in that case a view will also be generated.

        Entity views are stored according to their hash, so that
        multiple processors may operate on the same set.

        - generate a hash for the required entitySet/entityFilter combination
        - if the hash already exists, then retrieve the mapping and add the
            processor to the list
        - if the hash doesn't exist, create the view from the src entityset
    */
    _mapEntitySetToProcessor: function( entitySet, processor ){
        var filter;
        var hash;
        var view;
        var entitySetProcessors;

        var record = new Backbone.Model({
            id: processor.id,
            entitySet: entitySet,
            processor: processor
        });

        // decide on which view (if any) to use with the processor
        if( processor.entityFilter ){
            // convert the supplied directives into entityFilter instances
            filter = this.createEntityFilter( processor.entityFilter );

            // do we already have a view for this filter?
            hash = EntitySet.hash( entitySet, filter );

            if( this._entityViews[ hash ] ){
                view = this._entityViews[ hash ];
            } else {
                // TODO: replace this with: entitySet.where( filter, {createView:true} )
                view = entitySet.where( filter, null, {view:true});
                this._entityViews[ hash ] = view;
                this.trigger('view:create', view);
                // log.debug('new view ' + view.hash() + ' has ' + entitySet.models.length + ' entities for ' + processor.name );
            }

            record.set('view', view);
            processor.set({
                view: view,
                entityFilter: filter,
                entitySet: entitySet
            });
        } else {
            record.set('view', entitySet);
            processor.set({
                'entitySet': entitySet,
                'view': entitySet
            });
        }

        processor.entitySet = entitySet;
        processor.view = view || entitySet;
        processor.entityFilter = filter;

        this.entitySetProcessors.add( record );

        // store the mapping between the entityset and the processor
        // an entityset can have multiple processors
        // entitySetProcessors = this.entitySetProcessors[ entitySet.id ] || createProcessorCollection();
        // entitySetProcessors.add( processor );
        // this.entitySetProcessors[ entitySet.id ] = entitySetProcessors;
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

    

    // update: function( callback ){
    //     var self = this;
    //     var now = Date.now();
    //     var dt = now - this.updateLastTime;
    //     this.updateLastTime = now;
    //     this.updateStartTime += dt;
    //     var updateOptions = {};

    //     this.trigger('processor:update:start', this);

    //     var current = Promise.fulfilled();

    //     return Promise.all( 
    //         this.processors.models.map( function(processor){
    //             return current = current.then(function() {
    //                 // log.debug('calling update ' + dt );
    //                 return processor.update( dt, self.updateStartTime, now, updateOptions );
    //             });
    //         })).then( function( results ){
    //             self.trigger('processor:update:finish', self );
    //         });
    // },

    update: function( timeMs, options ){
        var debug;
        options || (options={});
        debug = options.debug;

        return _.reduce( this.entitySetProcessors, function(current, record){
            return current.then(function(){
                var processor = record.get('processor');
                var view = processorRecord.get('view');
                var entityArray = view.models;

                return processor.onUpdate( entityArray, timeMs )
                    .then( function(){
                        return processor.applyChanges();
                    })
                    .then( function(){
                        if( view.isModified ){
                            return view.applyEvents();
                        }
                        return processor;
                    });
            });
        }, Promise.resolve() );
    },

    /**
    *   Updates the processors attached to each entityset
    */
    updateSync: function( timeMs, options ){
        var entitySet;
        var entitySetId;
        var entitySetProcessors;
        var debug;
        var i,l;

        options || (options={});
        debug = options.debug;
        
        if(debug){ log.debug('> registry.updateSync'); }

        // iterate through each of the entitysets which have processors
        this.entitySetProcessors.each( function(processorRecord){
            var processor = processorRecord.get('processor');
            var view = processorRecord.get('view');
            var entityArray = view.models;

            
            // dispatch any events that the processor has collected
            // from the last update loop
            if( processor.isListeningAsync ){
                processor.isReleasingEvents = true;
                processor.releaseAsync();
                processor.isReleasingEvents = false;
            }

            // if the view needs updating due to entities or components being 
            // added/updated/removed, then do so now
            // the view is updated /before/ it is updated - previously it was
            // after, but this might lead to dependent views/sets getting out of
            // sync
            view.applyEvents();
            
            // execute any queued events that the processor has received
            if( debug ){ log.debug('executing processor ' + processor.type + ' ' + processor.get('priority') + ' with ' + view.cid +'/'+ view.hash() + ' ' + entityArray.length + ' entities'); }
            

            // allow the processor to process the entities
            processor.onUpdate( entityArray, timeMs );

            // apply any changes to the entitySet that the processor may have queued
            // changes involve adding/removing entities and components
            // NOTE: this includes creating and destroying entities - do we want to leave these ops till after all processors have run?
            processor.applyChanges();
        });
    },


    triggerEntityEvent: function( entity, name ){
        var entitySet, bf;

        var args = _.toArray( arguments ).slice(2);

        bf = entity.getComponentBitfield();

        // 1. the bitfield for this entity is extracted

        // 2. check against all registered entitysets/view to determine whether this entity is accepted

        // 3. if accepted, and the es has the entity, trigger that event on that entityset

        // the trick is to only trigger on entitySets that have the entity

        if( entitySet ){
            entitySet.trigger.apply( entitySet, [name,entity].concat( args ) );
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
