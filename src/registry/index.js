import _ from 'underscore';
import {Events, Collection} from 'odgn-backbone-model'
import BitField  from 'odgn-bitfield';

import {uuid as createUUID} from '../util/uuid';
import {createLog} from '../util/log';
import {getEntityIdFromId,getEntitySetIdFromId} from '../util';
import Entity from '../entity';
import EntitySet from '../entity_set';
import Component from '../component';
import SchemaRegistry from '../schema';
import EntityProcessor from '../entity_processor';
import EntityFilter from '../entity_filter';



// let counter = Date.now() % 1e9;

// const Log = createLog('Registry');



export default class Registry {

    constructor( options={} ){
        _.extend(this, Events);

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
        // this.processors = createProcessorCollection();

        this.schemaRegistry = options.schemaRegistry || SchemaRegistry.create(null,{registry:this});

        this.schemaRegistry.on('all', (...args) => this.trigger.apply(this, args));
    }

    /**
    *
    */
    createId(){
        // https://github.com/dfcreative/get-uid
        // let counter = Date.now() % 1e9;
        // return (Math.random() * 1e9 >>> 0) + (counter++ + '__')
        return ++this.sequenceCount;
    }

    /**
     * Returns a new component def instance
     */
    createComponentDef( attrs, options ){
        const result = new ComponentDef(attrs,options);
        return result;
    }


    /**
    *   Creates a new entity
    */
    createEntity(components, options={}){
        options.registry = this;
        let attrs = {};
        let idSet = false;

        if( options['@e'] ){ 
            attrs['@e'] = options['@e']; idSet = true;
        }
        if( options['@es'] ){ 
            attrs['@es'] = options['@es']; idSet = true;
        }

        if( components ){
            components = this.createComponent(components);

            // check to see whether the entity id is set on the component.
            const first = Array.isArray(components) ? components[0] : components;
            const reportedEntityId = first.getEntityId();
            if( reportedEntityId !== void 0 ){
                // attrs['@e'] = getEntityIdFromId(reportedEntityId);
                // attrs['@es'] = getEntitySetIdFromId(reportedEntityId);
                options.id = reportedEntityId;
                // console.log('setting eid from component', reportedEntityId);
                idSet = false;
            }
        }
        else if( options.comBf ){
            attrs.comBf = options.comBf;
            delete options.comBf;
        }

        if( options.id === void 0 && !idSet ){
            attrs.id = this.createId();
        } else { 
            attrs.id = options.id; 
        }

        let result = new this.Entity( attrs, options );

        if( components ){
            // components = this.createComponent(components);
            result.addComponent(components);
        }

        return result;
    }

    /**
     * 
     */
    createEntityWithId( entityId=0, entitySetId=0, options={} ){
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
    }


    

    /**
     * Returns a clone of the srcEntity, or if dstEntity is supplied
     * copies the components of srcEntity into dstEntity.
     */
    cloneEntity( srcEntity, dstEntity, options={} ){
        let ii,len,component,srcComponent;
        const deleteMissing = options.delete;
        const returnChanged = options.returnChanged;
        const fullCopy = options.full;
        let dstHasChanged = false;

        if( !srcEntity ){
            return returnChanged ? [false,null] : null;
        }

        if( !dstEntity ){
            dstEntity = srcEntity.clone();
            dstEntity.setRegistry(this);
        }

        if( !dstEntity && !fullCopy ){
            return dstEntity;
        }

        if( deleteMissing ){
            const srcBitfield = srcEntity.getComponentBitfield();
            const dstBitfield = dstEntity.getComponentBitfield();
            const removeDefIds = _.difference(dstBitfield.toJSON(),srcBitfield.toJSON());
            for(ii=0,len=removeDefIds.length;ii<len;ii++){
                dstEntity.removeComponent(dstEntity.components[removeDefIds[ii]]);
                dstHasChanged = true;
            }
        }

        const srcComponents = srcEntity.getComponents();

        for(ii=0,len=srcComponents.length;ii<len;ii++){
            srcComponent = srcComponents[ii];
            component = dstEntity.components[srcComponent.getDefId()]; 
            if( component ){
                // the dst entity already has this component
                if( srcComponent.hash() == component.hash() ){
                    continue;
                } else {
                    dstHasChanged = true;
                }
            } else {
                dstHasChanged = true;
            }
            dstEntity.addComponent( this.cloneComponent(srcComponents[ii]) );
            
        }

        return returnChanged ? [dstEntity,dstHasChanged] : dstEntity;
    }


    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent( data, options={} ){
        if( options.notifyRegistry ){
            options.throwOnExists = false;
        }

        return Promise.resolve( this.schemaRegistry.register(data,options) )
            .then( componentDefs => {
                if( !Array.isArray(componentDefs) ){ componentDefs = [componentDefs]; }
                return _.reduce( this._entitySets, (current, es) => {
                    return current = current.then( () => {
                        // log.debug('registering componentDefs with es ' + es.cid);
                        return this._registerComponentDefsWithEntitySet( es, componentDefs, options );
                    })
                }, Promise.resolve() )
                .then( () => componentDefs )
            });
    }

    /**
     * Returns an array of all the Component Defs that have been registered
     */
    getComponentDefs(){
        return this.schemaRegistry.getComponentDefs();
    }

    getComponentDef(ident){
        return this.schemaRegistry.getComponentDef(ident);
    }

    /**
    *   Registers the array of component def schemas with the given entitySet
    */
    _registerComponentDefsWithEntitySet( entitySet, componentDefs, options ){
        options = _.extend( {}, options, {fromRegistry:true, fromES:false} );
        
        // memory based entitysets do not need to register component defs,
        // as they are tied directly to the registry/schemaRegistry
        if( entitySet.isMemoryEntitySet ){
            return Promise.resolve();
        }
        return _.reduce( componentDefs, (current, cdef) => {
            return current = current.then( () => {
                return entitySet.registerComponentDef( cdef, options );
            })
        }, Promise.resolve() );
    }

    

    /**
    * TODO: name this something better, like 'getComponentIID'
    */
    getIId(componentIDs, options){
        if( options && _.isBoolean(options) ){
            options = {forceArray:true};
            
        }
        // console.log('Registry.getIId:', componentIDs, options );
        return this.schemaRegistry.getIId( componentIDs, options );
    }

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
    createComponent( componentDef, attrs, options, cb ){
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
        if( Array.isArray(componentDef) ){
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
    }

    /**
     * Produces a copy of a component
     */
    cloneComponent( srcComponent, attrs, options ){
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
    }

    destroyComponent( component, options ){

    }


    /**
     * Converts an entity id to an entity instance
     * 
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    toEntity(entityId){
        let result = Entity.toEntity(entityId);
        if( result )
            result.registry = this;
        return result;
    }


    /**
     * Creates a new EntitySet instance.
     * @param  {[type]}   components [description]
     * @param  {[type]}   options    [description]
     * @param  {Function} callback   [description]
     * @return {[type]}              [description]
     */
    createEntitySet( options={} ){
        let id, uuid;
        let result;
        let entitySetType=EntitySet;
        
        options.uuid = options.uuid || createUUID();
        if( options.type ){
            entitySetType = options.type;
        }
        if( options.instanceClass ){
            entitySetType = options.instanceClass;
        }

        
        // create a 20 bit 
        
        id = options['@es'] || options['id'] || this.createId();
        // console.log('createEntitySet', id, options);
        result = new entitySetType( null, _.extend( {}, options,{id}) );
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
        //         const schemas = this.schemaRegistry.getComponentDefs();
        //         return this._registerComponentDefsWithEntitySet( result, schemas, options )
        //             .then( () => result )
        //     });

        // return result;
    }


    removeAllEntitySets( options ){
        return Promise.all( 
            this._entitySets.map(es => this.removeEntitySet(es, options)) );
    }

    /**
    *   Returns a Promise to removes an entitySet from the registry
    *   
    */
    removeEntitySet( entitySet, options={} ){
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
    }

    /**
    *   
    */
    addEntitySet( entitySet, options={} ){
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
        
        // Log.debug('opening', entitySet.type,entitySet.getUuid());

        return entitySet.open(options).then( () => {
            
            const schemas = this.schemaRegistry.getComponentDefs();
            return this._registerComponentDefsWithEntitySet( entitySet, schemas, options )
                .then( () => {
                    // perform the normal sync adding
                    this.addEntitySet(entitySet,{sync:true})

                    return entitySet; 
                });
        });
    }

    /**
    *
    */
    getEntitySet( uuid ){
        let es;
        if( (es = this._entitySetUUIDs[uuid]) ){
            return es;
        }
        return null;
    }

    /**
    *
    */
    destroyEntitySet( entitySet ){
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
    }

    triggerEntityEvent( name, entity ){
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
    }
}

Registry.prototype.type = 'Registry';
Registry.prototype.isRegistry = true;


class ProcessorCollection extends Collection{
    // add(models,options){
    //     return Collection.prototype.add.apply(this,arguments);
    // }    
}

function createProcessorCollection(){
    
    let result = new ProcessorCollection();
    result.comparator = (recordA, recordB) => {
        // the entity in the collection might be a record referencing a processor
        const procA = recordA.get('processor') || recordA;
        const procB = recordB.get('processor') || recordB;
        return procA.getPriority() < procB.getPriority();
    };
    return result;
}

// Registry.isRegistry = function( registry ){
//     return registry && registry.isRegistry;
// }

/**
 * creates a new registry instance
 * 
 * @param  {[type]}   options  [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
// Registry.create = function create(options={}){
//     let result = new Registry();
//     result.initialize(options);
//     return result;
// };


// export default Registry;