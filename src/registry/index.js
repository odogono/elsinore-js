import _ from 'underscore';
import Backbone from 'backbone';

import BitField  from 'odgn-bitfield';
import Entity from '../entity';
import EntitySet from '../entity_set';
import Component from '../component';
import SchemaRegistry from '../schema';
import SchemaProperties from '../schema/properties';
import EntityProcessor from '../entity_processor';
import EntityFilter from '../entity_filter';
import * as Utils from '../util';
import {copyComponent} from '../util/copy';
import {uuid as createUuid} from '../util/uuid';
import {getPropertiesObject, getProperties} from '../schema/properties';

// let counter = Date.now() % 1e9;

/**
 * Registry
 * @return {[type]} [description]
 */
 const Registry = function(){};


_.extend(Registry.prototype, Backbone.Events, {
    type: 'Registry',
    isRegistry: true,

    /**
     * Initialises the entity store
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    initialize: function(options={}){
        this._initialized = true;

        this.schemaRegistry = options.schemaRegistry || SchemaRegistry.create();

        // listen to when the schema registry registers and unregisters schemas
        // this.listenTo( this.schemaRegistry, 'schema:add', this.schemaAdded );
        // this.listenTo( this.schemaRegistry, 'schema:remove', this.schemaRemoved );

        this.schemaRegistry.on('all', (...args) => this.trigger.apply(this, args));

        // a number used to assign id numbers to things - entities, components, entitysets
        this.sequenceCount = options.sequenceCount || 0;

        this.entitySetCount = options.entitySetCount || 0;

        // number of entity sets added - this also serves as
        // a way of assigning ids to entitysets
        this.entitySetCount = 0;

        // an array of entitysets created and active
        this._entitySets = []; //new Backbone.Collection();
        // a map of entityset uuids to entityset instances
        this._entitySetUUIDs = {};

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
        // let counter = Date.now() % 1e9;
        // return (Math.random() * 1e9 >>> 0) + (counter++ + '__')
        return ++this.sequenceCount;
    },


    schemaAdded: function( schemaUri, schemaHash, schema ){
        // log.debug('schema ' + schemaUri + ' added to registry');
        // derive an id for this schema
        // let componentDefId = this._componentDefId++;
        // this._componentDefsBySchemaHash[ componentDefId ] = schemaHash;
        // this._schemaHashComponentDefIds[ schemaHash ] = componentDefId;
    },

    schemaRemoved: function( schemaUri, schemaHash, schema ){
        // log.debug('schema ' + schemaUri + ' removed from registry');
        // let componentDefId = this._schemaHashComponentDefIds[ schemaHash ];
        // if( componentDefId ){
            // delete this._schemaHashComponentDefIds[ schemaHash ];
            // this._componentDefsBySchemaHash[ componentDefId ] = undefined;
        // }
    },


    createEntity: function( components, options={} ){
        let entityId;
        let entity;
        let ii;

        if( options.createId ){
            return this.createId();
        }

        if( options.id ){
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

        // if( options.debug ){ console.log('creating entity with', options); }
        entity = Entity.toEntity(entityId) || Entity.create();
        entity.setRegistry( this );


        
        if( options.esid ){
            entity.setEntitySetId( options.esid );
        }

        // log.debug('createEntity '+ entity.id + ' ' + entity.getEntityId() );
        // if( options.debug ){ console.log('created entity', entity.id); }
        if( !components ){
            return entity;
        }

        components = this.createComponent( components );
        
        if( _.isArray(components) ){
            for( ii in components ) {
                entity.addComponent( components[ii] );
            }
        } else {
            entity.addComponent( components ); 
        }
        
        return entity;
    },

    // cloneEntity: function( entity, options ){
    //     let comId, comClone;
    //     let result = this.createEntity( null, {entity:entity});
    //     // clone each of the attached components
    //     for( comId in entity.components ){
    //         comClone = copyComponent( this, entity.components[comId] );
    //         result.addComponent( comClone );
    //     }
    //     result.registry = this;
    //     return result;
    // },

    destroyEntity: function( entity, options ){
        entity.removeComponents();

        return entity;
    },

    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent: function( data, options ){
        const schemaRegistry = this.schemaRegistry;
        // console.log('registering', data);
        return new Promise( resolve => resolve(schemaRegistry.register(data,options)) )
            .then( schemas => {
                return _.reduce( this._entitySets, (current, es) => {
                    return current = current.then( () => {
                        // log.debug('registering schemas with es ' + es.cid);
                        return this._registerComponentDefsWithEntitySet( es, schemas, options );
                    })
                }, Promise.resolve() )
                .then( () => schemas )
            });
    },

    /**
    *   Registers the array of component def schemas with the given entitySet
    */
    _registerComponentDefsWithEntitySet: function( entitySet, schemas, options ){
        options = _.extend( {}, options, {fromRegistry:true, fromES:false} );
        
        // memory based entitysets do not need to register component defs,
        // as they are tied directly to the registry/schemaRegistry
        if( entitySet.isMemoryEntitySet ){
            return Promise.resolve();
        }
        return _.reduce( schemas, (current, schema) => {
            return current = current.then( () => {
                // log.debug('registering cdef schema ' + JSON.stringify(schema) );
                return entitySet.registerComponentDef( schema, options );
            })
        }, Promise.resolve() );
    },

    

    /**
    * TODO: name this something better, like 'getComponentIID'
    */
    getIId: function(componentIDs, options){
        if( options && _.isBoolean(options) ){
            options = {forceArray:true};
            
        }
        // console.log('Registry.getIId:', componentIDs, options );
        return this.schemaRegistry.getIId( componentIDs, options );
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
    createComponent: function( componentDef, attrs, options, cb ){
        let ii, len, name, schema, defaults, entityId, schemaIId, result, schemaKey;
        
        options || (options={});
        schemaKey = options.schemaKey || '@c';

        entityId = options.entity || options.entityId || options.eid;

        if( Entity.isEntity(attrs) ){
            entityId = Entity.toEntityId( attrs );
            attrs = {};
            // log.debug('create with entity id ' + entityId );
            // attrs = null;
        }

        if( entityId ){
            attrs['@e'] = entityId;
        }

        // Obtain a component schema
        if( _.isArray(componentDef) ){
            // recurse each entry
            return Array.prototype.concat.apply( [], 
                componentDef.map( (s) => this.createComponent(s, attrs, options) ));
        }
        else if( Component.isComponent(componentDef) ){
            // maybe clone instead of just returning?
            return componentDef;
        }
        else {
            if( componentDef[schemaKey] ){
                // attrs are pulled out of the 1st arg
                attrs = _.extend( {}, _.omit(componentDef,schemaKey ), attrs );
                componentDef = componentDef[schemaKey];
            }

            // console.log('creating with ', attrs);
            return this.schemaRegistry.createComponent( componentDef, attrs, options, cb );
        }
        
        // if( SchemaRegistry.isSchema(componentDef) ){
        //     schema = componentDef;
        //     componentDef = null;
        // }
        // else if( _.isObject(componentDef) ){
        //     if( componentDef[schemaKey] ){
        //         schema = componentDef[schemaKey];
        //         if( !attrs ){
        //             attrs = _.omit( componentDef, schemaKey );
        //         }
        //     }

        //     // attempt to retrieve existing already
        //     if( schema ){
        //         schema = this.schemaRegistry.get( schema, null, {full:true} );
        //     }
        // }
        // else {
        //     schema = this.schemaRegistry.get(componentDef, null, {full:true});
        // }

        // if( !schema ){
        //     if( cb ){
        //         return cb( 'no schema found for component ' + Utils.stringify(componentDef) );
        //     }
        //     throw new Error('no schema found for component ' + Utils.stringify(componentDef) );
        // }

        // schemaIId = schema.iid;
        // name = this.schemaRegistry.componentNameFromSchema( schema.hash );
        
        // // obtain default properties from the schema
        // defaults = getPropertiesObject( this.schemaRegistry, schema.uri );

        // if( _.isArray(attrs) ){
        //     result = [];

        //     for( ii=0,len=attrs.length;ii<len;ii++ ){
        //         result.push( this._createComponent( schemaIId, name, schema, defaults, attrs[ii], entityId, options ) );
        //     }

        // } else {
        //     result = this._createComponent( schemaIId, name, schema, defaults, attrs, entityId, options );    
        // }

        // if( cb ){
        //     return cb(null, result);
        // }
        // return result;
    },

    /**
    *   Create a component instance from the supplied 
    */
    // _createComponent: function( schemaIId, name, schema, defaults, data, entityId, options ){
    //     let component;
    //     let datum;

    //     datum = _.extend({}, defaults, data );

    //     component = Component.create( datum, _.extend({},options,{parse:true}) );

    //     component.schemaUri = schema.uri;

    //     component.name = name;
    //     component.setSchemaId( schemaIId );
    //     component.schemaHash = schema.hash;

    //     if( entityId ){
    //         component.setEntityId( entityId );
    //     }

    //     this.trigger('component:create', component.schemaUri, component );

    //     return component;
    // },


    destroyComponent: function( component, options ){

    },


    /**
     * Converts an entity id to an entity instance
     * 
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    toEntity: function(entityId){
        let result = Entity.toEntity(entityId);
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
        let id, uuid;
        let result;
        
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

        options.uuid = options.uuid || createUuid();

        // create a 20 bit 
        id = this.createId();
        result = instanceClass.create(_.extend( {}, options, {id:id} ));
        result.cid = _.uniqueId('es');
        result.setRegistry( this );
        
        if( options.register !== false ){
            // log.debug('options.register was ' + options.register );
            this.addEntitySet( result );

            // TODO: if this is a non-memory ES, then register all existing
            // entity sets with it
        }

        if( result.isMemoryEntitySet ){
            // NOTE: setting the id to 0 means that entity ids would be shifted up
            result.id = 0;
            return result;
        }

        // opening the ES will cause it to register its existing componentDefs
        // with the registry
        return result.open( options )
            .then( () => {
                let schemas = this.schemaRegistry.getAll();
                return this._registerComponentDefsWithEntitySet( result, schemas, options )
                    .then( () => result )
            });

        // return result;
    },


    removeAllEntitySets: function( options ){
        return Promise.all( 
            this._entitySets.map(es => this.removeEntitySet(es, options)) );
    },

    /**
    *   Returns a Promise to removes an entitySet from the registry
    *   
    */
    removeEntitySet: function( entitySet, options={} ){
        if( !entitySet ){ return null; }
        let closeFn = entitySet.isMemoryEntitySet ? Promise.resolve(true) : entitySet.close();
        return closeFn.then( () => {
            entitySet.setRegistry( null );
            this._entitySets = _.without( this.entitySets, entitySet );
            delete this._entitySetUUIDs[ entitySet.getUuid() ];
            return entitySet;
        });
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

        if( this._entitySetUUIDs[ entitySet.getUuid() ] ){
            throw new Error(`entityset with uuid ${entitySet.getUuid()} already exists`);
        }

        // store the entityset against its id
        this._entitySets.push( entitySet );
        this._entitySetUUIDs[ entitySet.getUuid() ]  = entitySet;
        
        entitySet.setRegistry( this );

        this.trigger('entityset:add', entitySet );

        return entitySet;
    },

    /**
    *
    */
    getEntitySet: function( uuid ){
        let es;
        if( (es = this._entitySetUUIDs[uuid]) ){
            return es;
        }
        return null;
    },

    /**
    *
    */
    destroyEntitySet: function( entitySet ){
        let processors, removeList;
        if( !entitySet ){ return null; }

        entitySet.setRegistry( null );
        this._entitySets = _.without( this.entitySets, entitySet );
        // this._entitySetIds.remove( entitySet );

        // remove  the records
        removeList = this.entitySetProcessors.filter( record => (record.get('entitySet') == entitySet) );

        // TODO: destroy any views attached to the entitySets
        _.each( removeList, es => {} );

        processors.remove( removeList );

        // processors = this.entitySetProcessors[ entitySet.id ];

        // if( processors ){
        //     processors.reset();
        //     this.entitySetProcessors[ entitySet.id ] = null;
        // }
    },

    triggerEntityEvent: function( name, entity ){
        let entitySet, bf, ii, len, trigger;

        // let args = _.toArray( arguments ).slice(2);

        // bf = entity.getComponentBitfield();

        // 1. the bitfield for this entity is extracted

        // 2. check against all registered entitysets/view to determine whether this entity is accepted

        // 3. if accepted, and the es has the entity, trigger that event on that entityset

        // the trick is to only trigger on entitySets that have the entity

        for( ii=0,len=this._entitySets.length; ii < len; ii++ ){
            entitySet = this._entitySets[ii];
            entitySet.triggerEntityEvent.apply( entitySet, arguments );
        }
    },
});


function createProcessorCollection(){
    let result = new Backbone.Collection();
    result.comparator = (procA, procB) => {
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
Registry.create = function create(options={}){
    let result = new Registry();
    result.initialize(options);
    return result;
};


export default Registry;