import _ from 'underscore';
import {Events, Collection} from 'odgn-backbone-model'
import BitField  from 'odgn-bitfield';

import {createLog,createUuid} from '../util';
import Entity from '../entity';
import EntitySet from '../entity_set';
import Component from '../component';
import SchemaRegistry from '../schema';
import EntityProcessor from '../entity_processor';
import EntityFilter from '../entity_filter';



// let counter = Date.now() % 1e9;

/**
 * Registry
 * @return {[type]} [description]
 */
const Registry = function(){};

// const Log = createLog('Registry');


_.extend(Registry.prototype, Events, {
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

        // used to instantiate new entities
        this.Entity = Entity;

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

        this.updateLastTime = Date.now();
        this.processors = createProcessorCollection();

        this.schemaRegistry = options.schemaRegistry || SchemaRegistry.create(null,{registry:this});

        this.schemaRegistry.on('all', (...args) => this.trigger.apply(this, args));

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

    /**
    *   Creates a new entity
    */
    createEntity: function(components, options={}){
        // options = _.extend({registry:this},options);
        options.registry = this;
        // let entityId = 0;
        // let entitySetId = 0;
        let attrs = {};
        let idSet = false;

        // if( options.id ){ attrs.id = options.id; }
        if( options['@e'] ){ 
            attrs['@e'] = options['@e']; idSet = true;
        }
        if( options['@es'] ){ 
            attrs['@es'] = options['@es']; idSet = true;
        }

        if( options.comBf ){
            attrs.comBf = options.comBf;
            delete options.comBf;
        }

        if( _.isUndefined(options.id) && !idSet ){
            attrs.id = this.createId();
        } else { 
            attrs.id = options.id; 
        }


        // console.log('create with', attrs, _.keys(options));
        let result = new this.Entity( attrs, options );
        // console.log('created', result);

        // if( _.isUndefined(options.id) && !idSet ){
        //     result.id = this.createId();
        // } else { 
        //     result.id = options.id; 
        // }
        
        // if( options.debug ){
        //     console.log('createEntity', attrs, _.omit(options,'registry') );
        //     console.log('result', result.id, result);
        //     process.exit();
        // }

        if( components ){
            components = this.createComponent(components);
            result.addComponent(components);
        }

        return result;
    },

    createEntityWithId: function( entityId=0, entitySetId=0, options={} ){
        options.registry = this;
        let attrs = {'@e':entityId,'@es':entitySetId};
        if( options.comBf ){
            attrs.comBf = options.comBf;
            delete options.comBf;
        }
        if( options.id ){
            attrs = {id:options.id};
        }
        return new this.Entity( attrs, options );
    },


    

    /**
     * 
     */
    cloneEntity: function( srcEntity, dstEntity, options={} ){
        let ii,len,component,srcComponent;
        const deleteMissing = options.delete;
        const fullCopy = options.full;

        if( !dstEntity ){
            dstEntity = srcEntity.clone();
            dstEntity.setRegistry(this);
        }

        if( !dstEntity && !fullCopy ){
            return dstEntity;
        }

        const srcComponents = srcEntity.getComponents();

        for(ii=0,len=srcComponents.length;ii<len;ii++){
            dstEntity.addComponent( this.cloneComponent(srcComponents[ii]) );
        }

        return dstEntity;

        // if( !dstEntity ){
        //     const result = srcEntity.clone();
        //     result.setRegistry(this);

        //     if( options.full ){
        //         // const components = srcEntity.getComponents();
        //         _.each( srcEntity.getComponents(), com => {
        //             result.addComponent( this.cloneComponent(com) );
        //         });
        //     }

        //     return result;
        // }

        // const srcComponents = srcEntity.getComponents();


        // const returnChanges = options.returnChanges;
        // const returnChanged = options.returnChanged;
        // const deleteMissing = options.delete;
        // let copyList = [];
        // let dstHasChanged = false;

        // if( !srcEntity ){
        //     return returnChanged ? [false,null] : null;
        // }

        // let srcComponents = srcEntity.getComponents();

        // // copy over dst components to new instance
        // if( dstEntity ){
        //     let dstComponents = dstEntity.getComponents();

        //     for(ii=0,len=dstComponents.length;ii<len;ii++){
        //         component = dstComponents[ii];
        //         srcComponent = srcEntity[component.name];
                
        //         if( deleteMissing ){
        //             if( !srcComponent ){
        //                 dstHasChanged = true;
        //                 continue;
        //             }
        //         }
        //         // if the src already has the same component, then don't copy
        //         if( srcComponent ){
        //             // the dst component should have an id
        //             srcComponent.setId( component.getId() );
                    
        //             if( srcComponent.hash() == component.hash() ){
        //                 continue;
        //             } else {
        //                 dstHasChanged = true;
        //             }
        //         }
        //         else {
        //             result.addComponent( this.cloneComponent(component));
        //         }
        //     }    
        // }

        // // iterate over src components, copying them to the result
        // for(ii=0,len=srcComponents.length;ii<len;ii++){
        //     result.addComponent(this.cloneComponent(srcComponents[ii]));
        // }

        // return returnChanged ? [result,dstHasChanged] : result;
    },


    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent: function( data, options={} ){
        const schemaRegistry = this.schemaRegistry;
        
        if( options.fromES ){
            options.throwOnExists = false;
        }

        return Promise.resolve( schemaRegistry.register(data,options) )
            .then( componentDefs => {
                if( !_.isArray(componentDefs) ){ componentDefs = [componentDefs]; }
                return _.reduce( this._entitySets, (current, es) => {
                    return current = current.then( () => {
                        // log.debug('registering componentDefs with es ' + es.cid);
                        return this._registerComponentDefsWithEntitySet( es, componentDefs, options );
                    })
                }, Promise.resolve() )
                .then( () => componentDefs )
            });
    },

    /**
     * Returns an array of all the Component Defs that have been registered
     */
    getComponentDefs: function(){
        return this.schemaRegistry.getAll();
    },

    /**
    *   Registers the array of component def schemas with the given entitySet
    */
    _registerComponentDefsWithEntitySet: function( entitySet, componentDefs, options ){
        options = _.extend( {}, options, {fromRegistry:true, fromES:false} );
        
        // memory based entitysets do not need to register component defs,
        // as they are tied directly to the registry/schemaRegistry
        if( entitySet.isMemoryEntitySet ){
            return Promise.resolve();
        }
        return _.reduce( componentDefs, (current, cdef) => {
            return current = current.then( () => {
                // log.debug('registering cdef ',cdef );
                return entitySet.registerComponentDef( cdef, options );
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
        let ii, len, name, defaults, entityId, result, defKey;
        
        options || (options={});
        defKey = options.defKey || '@c';

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
            if( componentDef[defKey] ){
                // attrs are pulled out of the 1st arg
                attrs = _.extend( {}, _.omit(componentDef,defKey ), attrs );
                componentDef = componentDef[defKey];
            }
            return this.schemaRegistry.createComponent( componentDef, attrs, options, cb );
        }
    },

    /**
     * Produces a copy of a component
     */
    cloneComponent: function( srcComponent, attrs, options ){
        const result = srcComponent.clone();
        // let result = new srcComponent.constructor(srcComponent.attributes);
        // result.setId( srcComponent.getId() );
        // result.id = srcComponent.id;
        result.name = srcComponent.name;
        result.setDefDetails(
            srcComponent.getDefId(),
            srcComponent.getUri(),
            srcComponent.getDefHash(),
            srcComponent.getDefName() );
        result.registry = this;
        if( attrs ){
            result.set( attrs, options );
        }
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
    createEntitySet: function( options={} ){
        let id, uuid;
        let result;
        let instanceClass=EntitySet;
        
        options.uuid = options.uuid || createUuid();
        if( options.instanceClass ){
            instanceClass = options.instanceClass;
        }

        
        // create a 20 bit 
        id = options['@es'] || this.createId();
        result = new instanceClass( null, _.extend( {}, options,{id}) );
        result.setRegistry( this );
        
        // if( options.register !== false ){
        //     // log.debug('options.register was ' + options.register );
        //     this.addEntitySet( result );

        //     // TODO: if this is a non-memory ES, then register all existing
        //     // entity sets with it
        // }

        // TODO : there has to be a better way of identifying entitysets
        if( result.isMemoryEntitySet ){//} result.isMemoryEntitySet && !result.open ){
            // console.log('this is a memory es');
            // NOTE: setting the id to 0 means that entity ids would be shifted up
            result.id = 0;

            if( options['@e'] ){
                let components = _.map( options['@e'], com => this.createComponent(com) )
                result.addComponent( components );
            }

            if( options.register === false ){
                return result;
            }
            // return result;
        }

        return this.addEntitySet( result, options );

        // opening the ES will cause it to register its existing componentDefs
        // with the registry
        // return result.open( options )
        //     .then( () => {
        //         const schemas = this.schemaRegistry.getAll();
        //         return this._registerComponentDefsWithEntitySet( result, schemas, options )
        //             .then( () => result )
        //     });

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
        if( options.sync || !entitySet.isAsync ){
            entitySet.setRegistry( null );
            this._entitySets = _.without( this.entitySets, entitySet );
            delete this._entitySetUUIDs[ entitySet.getUuid() ];
            return entitySet;
        }

        return entitySet.close(options).then( () => this.removeEntitySet(entitySet,{sync:true}));

        // let closeFn = entitySet.isMemoryEntitySet ? Promise.resolve(true) : entitySet.close();
        // return closeFn.then( () => {
        //     entitySet.setRegistry( null );
        //     this._entitySets = _.without( this.entitySets, entitySet );
        //     delete this._entitySetUUIDs[ entitySet.getUuid() ];
        //     return entitySet;
        // });
    },

    /**
    *   
    */
    addEntitySet: function( entitySet, options={} ){
        if( !entitySet ){ return null; }

        entitySet.setRegistry(this);
        
        if( options.sync || !entitySet.isAsync ){
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
        }
        
        console.log('opening', entitySet.type,entitySet.getUuid());

        return entitySet.open(options).then( () => {
            this.addEntitySet(entitySet,{sync:true})

            const schemas = this.schemaRegistry.getAll();
            return this._registerComponentDefsWithEntitySet( entitySet, schemas, options )
                .then( () => entitySet ) 
        });
        // return entitySet;
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
    let result = new Collection();
    result.comparator = (procA, procB) => {
        // the entriy in the collection might be a record referencing a processor
        procA = procA.get('processor') || procA;
        procB = procB.get('processor') || procB;
        return procA.get('priority') < procB.get('priority');
    };
    return result;
}

Registry.isRegistry = function( registry ){
    return registry && registry.isRegistry;
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