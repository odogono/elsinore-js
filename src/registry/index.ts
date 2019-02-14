import { arrayDifference } from '../util/array/difference';
import { arrayWithout } from '../util/array/without';
import { isBoolean } from '../util/is';
import { omit } from '../util/omit';
import { createUUID } from '../util/uuid';
import { isComponent, isEntity, isEntitySet } from '../util/is';
import { Entity, EntityOptions } from '../entity';
import { EntitySet } from '../entity_set';
import { Base, BaseOptions } from '../base';
import { Component } from '../component';
import { ComponentRegistry, ComponentDefIDs } from '../schema';

import { ENTITY_ID, ENTITY_SET_ID, COMPONENT_ID, COMPONENT_URI, EntityEvent } from '../types';



export interface RegistryOptions extends BaseOptions {
    sequenceCount?:number;
    componentRegistry?:ComponentRegistry;
}

interface CreateEntityOptions extends EntityOptions {
    id?:number;
    [ENTITY_ID]?:number;
    [ENTITY_SET_ID]?:number;
}

interface CreateEntitySetOptions extends CreateEntityOptions {
    type?:any;
    register?:boolean;
    allowEmptyEntities?:boolean;
}

export class Registry extends Base {

    readonly type:string = 'Registry';

    readonly isRegistry:boolean = true;


    _initialized:boolean = false;

    _entityViews:object;

    updateLastTime: number;

    componentRegistry: ComponentRegistry;

    sequenceCount: number;

    _entitySets:Array<EntitySet>;

    _entitySetUUIDs:object;


    constructor(options:RegistryOptions={}){
        super( options );

        this.initialize(options);
    }

    initialize(options:RegistryOptions = {}) {

        this._initialized = true;

        // a number used to assign id numbers to things - entities, components, entitysets
        this.sequenceCount = options.sequenceCount || 0;

        // an array of entitysets created and active
        this._entitySets = [];
        // a map of entityset uuids to entityset instances
        this._entitySetUUIDs = {};

        // a map of hashes to entity views
        this._entityViews = {};

        this.updateLastTime = Date.now();

        this.componentRegistry = options.componentRegistry || new ComponentRegistry(null, { registry: this });

        this.componentRegistry.on('all', (...args) => this.trigger.apply(this, args));
    }

    /**
     * Returns a prefix which is attached to the instances cid
     */
    getCIDPrefix() : string {
        return 'r';
    }

    /**
     *
     */
    createID() {
        // https://github.com/dfcreative/get-uid
        // let counter = Date.now() % 1e9;
        // return (Math.random() * 1e9 >>> 0) + (counter++ + '__')
        return ++this.sequenceCount;
    }

    

    /**
     *   Creates a new entity
     */
    createEntity(components?, options:CreateEntityOptions = {}) : Entity {
        let idSet = false;

        options.registry = this;

        if (options[ENTITY_ID]) {
            idSet = true;
        }
        if (options[ENTITY_SET_ID]) {
            idSet = true;
        }

        if (components) {
            components = this.createComponent(components);

            // check to see whether the entity id is set on the component.
            const first = Array.isArray(components) ? components[0] : components;

            const reportedEntityID = first.getEntityID();

            if (reportedEntityID !== 0 && reportedEntityID !== undefined) {
                options.id = reportedEntityID;
                idSet = false;
            }
        }

        // if( options.debug ){ console.log('[Registry][createEntity]', 'create with', idSet, attrs ); }

        if (options.id === undefined && !idSet) {
            options.id = this.createID();
        }

        let result = new Entity(options); //this.Entity.create(options);

        if (components) {
            result.addComponent(components);
        }

        return result;
    }

    /**
     *
     */
    createEntityWithID(entityID = 0, entitySetID = 0, options = {}) {
        return this.createEntity(null, { ...options, [ENTITY_ID]: entityID, [ENTITY_SET_ID]: entitySetID });
        // return this.createEntity(null, { ...options, ENTITY_ID: entityID, ENTITY_SET_ID: entitySetID });
    }

    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent(data, options:{fromES?:EntitySet, notifyRegistry?:boolean, throwOnExists?:boolean} = {}) {
        if (options.notifyRegistry) {
            options.throwOnExists = false;
        }

        return Promise.resolve(this.componentRegistry.register(data, options)).then(componentDefs => {
            if (!Array.isArray(componentDefs)) {
                componentDefs = [componentDefs];
            }

            return this._entitySets
                .reduce((current, es) => {
                    return (current = current.then(() => {
                        // log.debug('registering componentDefs with es ' + es.cid);
                        return this._registerComponentDefsWithEntitySet(es, componentDefs, options);
                    }));
                }, Promise.resolve())
                .then(() => componentDefs);
        });
    }

    /**
     * Returns an array of all the Component Defs that have been registered
     */
    getComponentDefs() {
        return this.componentRegistry.getComponentDefs();
    }

    /**
     * 
     */
    getComponentDef(ident) {
        return this.componentRegistry.getComponentDef(ident);
    }

    /**
     *   Registers the array of component def schemas with the given entitySet
     */
    _registerComponentDefsWithEntitySet(entitySet, componentDefs, options = {}) {
        options = { ...options, fromRegistry: true, fromES: false };

        // memory based entitysets do not need to register component defs,
        // as they are tied directly to the registry/componentRegistry
        if (entitySet.isMemoryEntitySet) {
            return Promise.resolve();
        }
        return componentDefs.reduce((current, cdef) => {
            return (current = current.then(() => {
                return entitySet.registerComponentDef(cdef, options);
            }));
        }, Promise.resolve());
    }

    /**
     * TODO: name this something better, like 'getComponentIID'
     */
    getIID(componentIDs:ComponentDefIDs, options?:(boolean|{}) ) : number| Array<number> {
        let iidOptions = (options && isBoolean(options)) ? {forceArray:true} : options;
        
        return this.componentRegistry.getIID(componentIDs, iidOptions );
    }

    /**
     * Creates a new component instance
     *
     *
     *   There is never really a case where we are creating multiple instances of a single
     *   ComponentDef
     *
     * @param  {[type]} schemaUri [description]
     * @return {[type]}          [description]
     */
    createComponent(componentDef, attrs?, options?) {
        let entityID, defKey;

        options || (options = {});
        defKey = options.defKey || COMPONENT_URI;

        entityID = options.entity || options.entityID || options.eid;

        if (isEntity(attrs)) {
            entityID = Entity.toEntityID(attrs);
            attrs = {};
        }

        if (entityID) {
            attrs[ENTITY_ID] = entityID;
        }

        // Obtain a component schema
        if (Array.isArray(componentDef)) {
            // recurse each entry
            return Array.prototype.concat.apply([], componentDef.map(s => this.createComponent(s, attrs, options)));
        } else if (isComponent(componentDef)) {
            // maybe clone instead of just returning?
            return componentDef;
        } else {
            if (componentDef[defKey]) {
                // attrs are pulled out of the 1st arg
                attrs = Object.assign({}, omit(componentDef, defKey), attrs);
                componentDef = componentDef[defKey];
            }
            return this.componentRegistry.createComponent(componentDef, attrs, options);
        }
    }

    destroyComponent(component, options) {}

    /**
     * Converts an entity id to an entity instance
     *
     * @param  {[type]} entityID [description]
     * @return {[type]}          [description]
     */
    toEntity(entityID:number) : Entity {
        return new Entity({ [ENTITY_ID]: entityID, registry:this });
    }

    /**
     * Creates a new EntitySet instance.
     * @param  {[type]}   components [description]
     * @param  {[type]}   options    [description]
     * @param  {Function} callback   [description]
     * @return {[type]}              [description]
     */
    createEntitySet(options:CreateEntitySetOptions = {}) {
        let id:number;
        let result;
        let entitySetType = EntitySet;

        if (options.type) {
            entitySetType = options.type;
        }

        // create a 20 bit
        id = options[ENTITY_SET_ID] || options['id'] || this.createID();
        
        result = new entitySetType(null, { id });

        result.setRegistry(this);
        
        // TODO : there has to be a better way of identifying entitysets
        if (result.isMemoryEntitySet) {
            // NOTE: setting the id to 0 means that entity ids would be shifted up
            result.id = 0;

            let eIDs = options[ENTITY_ID];
            if (Array.isArray(eIDs)) {
                let components = eIDs.map(com => this.createComponent(com));
                result.addComponent(components);
            }

            if (options.register === false) {
                return result;
            }
        }
        
        return this.addEntitySet(result);
    }

    /**
     * 
     * @param {*} options 
     */
    removeAllEntitySets(options) {
        return Promise.all(this._entitySets.map(es => this.removeEntitySet(es, options)));
    }

    

    /**
     * Returns a Promise to removes an entitySet from the registry
     * 
     * @param {*} entitySet 
     * @param {*} options 
     */
    removeEntitySet(entitySet, options:{sync?:boolean} = {}) {
        if (!entitySet) {
            return null;
        }
        if (options.sync || !entitySet.isAsync) {
            entitySet.setRegistry(null);
            this._entitySets = arrayWithout(this._entitySets, entitySet);
            delete this._entitySetUUIDs[entitySet.getUUID()];
            // delete this._entitySetIDs[entitySet.getEntitySetID()];
            return entitySet;
        }

        return entitySet.close(options).then(() => this.removeEntitySet(entitySet, { sync: true }));
    }

    
    /**
     * adds an entity set to the registry
     * @param {*} entitySet 
     * @param {*} options 
     */
    addEntitySet(entitySet, options:{sync?:boolean} = {}) {
        if (!entitySet) {
            return null;
        }

        entitySet.setRegistry(this);

        if (options.sync || !entitySet.isAsync) {

            // do we already have this entitySet
            if (this._entitySets.indexOf(entitySet) !== -1) {
                return null;
            }

            if (this._entitySetUUIDs[entitySet.getUUID()]) {
                throw new Error(`entityset with uuid ${entitySet.getUUID()} already exists`);
            }

            // store the entityset against its id
            this._entitySets.push(entitySet);
            this._entitySetUUIDs[entitySet.getUUID()] = entitySet;
            // this._entitySetIDs[entitySet.getEntitySetID()] = entitySet;

            entitySet.setRegistry(this);

            this.trigger( EntityEvent.EntitySetAdd, entitySet);

            return entitySet;
        }

        // Log.debug('opening', entitySet.type,entitySet.getUUID());
        return entitySet.open(options).then(() => {
            const defs = this.getComponentDefs();
            return this._registerComponentDefsWithEntitySet(entitySet, defs, options).then(() => {
                // perform the normal sync adding
                this.addEntitySet(entitySet, { sync: true });

                return entitySet;
            });
        });
    }

   
    /**
     * 
     * @param {*} uuid 
     */
    getEntitySet(id) {
        return /*this.getEntitySetByID(id) ||*/ this.getEntitySetByUUID(id);
    }

    /**
     * Returns a registered entity set by its UUID
     * 
     * @param {String} uuid 
     */
    getEntitySetByUUID( uuid ){
        return this._entitySetUUIDs[uuid];
    }



    /**
     *
     */
    destroyEntitySet(entitySet) {
        if (!entitySet) {
            return null;
        }

        entitySet.setRegistry(null);
        this._entitySets = arrayWithout(this._entitySets, entitySet);
    }

    /**
     *
     * @param {*} name
     * @param {*} entity
     * @param {*} rest
     */
    triggerEntityEvent(name, entity, ...rest) {
        let entitySet, ii, len;

        // let args = _.toArray( arguments ).slice(2);
        // bf = entity.getComponentBitfield();
        // 1. the bitfield for this entity is extracted
        // 2. check against all registered entitysets/view to determine whether this entity is accepted
        // 3. if accepted, and the es has the entity, trigger that event on that entityset
        // the trick is to only trigger on entitySets that have the entity
        const args = [name, entity, ...rest];

        for (ii = 0, len = this._entitySets.length; ii < len; ii++) {
            entitySet = this._entitySets[ii];

            entitySet.triggerEntityEvent.apply(entitySet, args);
        }
    }
}
