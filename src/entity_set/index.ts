import { Base, BaseOptions } from '../base';
import { COMPONENT_URI, ComponentDefID, ENTITY_ID, EntityEvent, EntityID } from '../types';
import { Entity, cloneEntity } from '../entity';
import { Query, QueryExecuteOptions } from '../query';
import { isComponent, isEntity, isEntityID, isInteger, isMemoryEntitySet, isObject, isPromise } from '../util/is';

import { SyncCmdBuffer as CmdBuffer } from '../cmd_buffer/sync';
import { Collection } from '../util/collection';
import { Component } from '../component';
import { ComponentRegistry } from '../schema';
import { PullStreamSink } from './sink';
import { PullStreamSource } from './source';
import { componentsFromCollections } from '../util/array/value';
import { hash } from '../util/hash';
import { stringify } from '../util/stringify';
import { uniqueID } from '../util/unique_id';
import { valueArray } from '../util/array/value';

export interface EntitySetOptions extends BaseOptions {
    cmdBuffer?;
    indexByEntityID?:boolean;
    allowEmptyEntities?:boolean;
}


interface JSONOptions {
    mapCdefUri?:boolean;
    flatEntity?:boolean;
    cdefMap?:Map<number,string>;
};


/**
 * An EntitySet is a container for entities
 */
export class EntitySet extends Base {
    
    readonly type:string = 'EntitySet';
    
    readonly isMemoryEntitySet:boolean = true;
    
    readonly isEntitySet:boolean = true;
    
    readonly isAsync:boolean = false;
    
    views = null;

    _entities:Collection<Entity> = null;
    _entitiesByID:Collection<Entity>;
    _components:Collection<Component>;

    _cmdBuffer;

    _cmdBufferType = CmdBuffer;

    indexByEntityID: boolean;
    allowEmptyEntities: boolean = true;
    

    constructor(entities, options:EntitySetOptions = {}){
        super();

        if (options.cmdBuffer) {
            this._cmdBufferType = options.cmdBuffer;
        }

        // entities can either be indexed by their full id or by the entityID part of
        // the supplied id
        this.indexByEntityID = options.indexByEntityID;
        
        this.allowEmptyEntities = options.allowEmptyEntities === void 0 ? true : options.allowEmptyEntities;

        this.initialize(entities, options);
    }

    initialize(entities, options = {}) {
        // this collection of entities indexes by the entity ids
        this._entities = new Collection();
        this._entitiesByID = new Collection(null, { debug: true, idAttribute: e => (e ? e.getEntityID() : undefined) });
        this._components = new Collection();

        this._cmdBuffer = new this._cmdBufferType();
    }

    /**
     * Returns the id of the entitySet
     */
    getEntitySetID() {
        return this.id;
    }

    /**
     * Returns a prefix which is attached to the instances cid
     */
    getCIDPrefix() : string {
        return 'es';
    }
    

    // hash() : number {
    //     let result = super.hash();
    //     let query = this.getQuery();
    //     if( query ){
    //         result += query.hash();
    //     }
    //     return result;
    // }

    destroy() {
        this.stopListening();
    }

    /**
     * Returns the entity at index
     *
     * @param {number} index
     */
    at(index) {
        return this._entities.at(index);
    }

    /**
     * Returns an entity by its id
     *
     * @param {number} entityID
     */
    getByEntityID(entityID) {
        return this._entitiesByID.get(entityID);
    }

    /**
     * Returns the number of entities in this set
     */
    size() {
        return this._entities.size();
    }

    /**
     * Returns an array containing all the entities
     * in this set
     */
    getEntities() {
        return this._entities.models;
    }


    /**
     *
     */
    toJSON(options:JSONOptions = {}) {
        if (!isObject(options)) {
            options = {};
            // return {uuid:this._uuid, msg:options};
            // console.log(`what deal with`, this, options);
            // throw new Error(`what deal with ${options}`, this, typeof this);
        }
        let result = { uuid: this.getUUID() };
        // { cid:this.cid };
        if (options.mapCdefUri) {
            options.cdefMap = this.getRegistry().componentRegistry.getComponentDefUris();
        }
        options.flatEntity = true;

        // if( !this.models ){
        //     console.log('[toJSON]', 'hey what', this.cid, this );
        // }
        result[ENTITY_ID] = this._entities.reduce((acc, e) => {
            return acc.concat(e.toJSON(options));
        }, []);

        return result;
    }

    // iterator: function(options){
    //     let self = this;
    //     let nextIndex = 0;
    //     return {
    //         next: function(){
    //             return new Promise( function(resolve, reject){
    //                 if( nextIndex < self.entities.length ){
    //                     return resolve( self.entities.at(nextIndex++) );
    //                 }
    //                 return reject({done:true});
    //             });
    //         }
    //     };
    // },

    /**
     *
     * @param {*} options
     */
    // iterator(options) {
    //     let nextIndex = 0;
    //     return {
    //         next: () => {
    //             return nextIndex < this.size() ? { value: this.at(nextIndex++), done: false } : { done: true };
    //         }
    //     };
    // }

    /**
     * Returns a Pull-Stream source
     *
     * see https://pull-stream.github.io/
     *
     * @param {*} options
     */
    source(options) {
        return PullStreamSource(this, options);
    }

    /**
     * Returns a Pull-Stream sink
     *
     * @param {*} options
     */
    sink(options, completeCb) {
        return PullStreamSink(this, options, completeCb);
    }



    /**
     * Adds a component to this set
     * Returns the entities that were added or updated as a result
     * @param {*} component
     * @param {*} options
     */
    addComponent(component, options?) {
        // conveniently create a component instance if raw data is passed
        if (component[COMPONENT_URI] || Array.isArray(component)) {
            component = this.getRegistry().createComponent(component);
        }
        return this._cmdBuffer.addComponent(this, component, options);
    }

    /**
     * Returns the components that were added or updated in the last
     * operation
     */
    getUpdatedComponents() {
        return componentsFromCollections(
            this._cmdBuffer.entitiesAdded,
            // this._cmdBuffer.entitiesUpdated,
            this._cmdBuffer.componentsAdded,
            this._cmdBuffer.componentsUpdated
        );
    }

    /**
     *
     */
    getRemovedComponents() {
        return componentsFromCollections(this._cmdBuffer.entitiesRemoved, this._cmdBuffer.componentsRemoved);
    }

    /**
     * Returns the entities that were added or updated in the last operation
     */
    getUpdatedEntities() {
        return valueArray(this._cmdBuffer.entitiesAdded, this._cmdBuffer.entitiesUpdated);
    }

    /**
     *
     */
    getRemovedEntities() {
        return valueArray(this._cmdBuffer.entitiesRemoved);
    }

    /**
     * Returns an existing component instance (if it exists)
     *
     * @param {*|integer} component
     * @returns {*} a component instance
     */
    getComponent(component) {
        let componentID = component;
        if (isComponent(component)) {
            componentID = component.id;
        }

        // console.log('[EntitySet][getComponent]', this.cid, componentID, this._components.get(componentID) );

        return this._components.get(componentID);
    }

    /**
     * Returns a component by its entityid and def id
     *
     * @param {*} entityID
     * @param {*} componentDefID
     */
    getComponentByEntityID(entityID:EntityID, componentDefID:ComponentDefID) : Component {
        // console.log('[getComponentByEntityID]', entityID, componentDefID, this._entities.map(e=>e.id) );
        const entity = this._entities.get(entityID);

        if (entity !== undefined) {
            // console.log('[getComponentByEntityID][found]', entityID, componentDefID, Object.keys(entity.components) );
            return entity.components[componentDefID];
        }

        return null;
    }

    /**
     *
     * @param {*} component
     * @param {*} options
     */
    removeComponent(component, options?) {
        return this._cmdBuffer.removeComponent(this, component, options);
    }

    /**
     *   Flushes any outstanding commands in the buffer
     */
    flush(options) {
        return this._cmdBuffer.flush(this, options);
    }

    /**
     *   Adds an entity with its components to the entityset
     * @param {*} entity - Entity, array of entities, array of raw components
     */
    addEntity(entity, options?) {
        let add = null;
        let isArray = Array.isArray(entity);
        if (isMemoryEntitySet(entity)) {
            entity = entity.models;
            isArray = true;
        }

        if (isArray) {
            if (entity.length <= 0) {
                return;
            }
            if (isEntity(entity[0])) {
                add = entity;
            }
        } else if (isEntity(entity)) {
            add = entity;
        }

        if (!add) {
            add = this.getRegistry().createEntity(entity);
        }

        let result = this._cmdBuffer.addEntity(this, add, options);
        return result;
    }

    /**
     *
     * @param {*} entity
     * @param {*} options
     */
    removeEntity(entity, options?) {
        if (isMemoryEntitySet(entity)) {
            entity = entity.models;
        }
        return this._cmdBuffer.removeEntity(this, entity, options);
    }

    /**
     *
     * @param {*} entityID
     * @param {*} returnID
     * @param {*} options
     */
    _createEntity(entityID, returnID, options = {}) {
        let result;
        const registry = this.getRegistry();

        entityID = parseInt(entityID, 10) || 0;

        if (entityID <= 0) {
            entityID = registry.createID();
        }

        if (returnID) {
            return entityID;
        }

        result = registry.createEntity(null, { id: entityID });
        // make sure we don't set the entityset id - memory entitysets retain
        // the original entityset id
        result.setEntitySet(this, false);

        return result;
    }

    /**
     *
     */
    _createComponentID() {
        return this.getRegistry().createID();
    }

    /**
     *
     * @param {*} entity
     */
    _addEntity(entity) {
        // check whether we are using the entire id or just the entity part of the id to index
        const entityID = this.indexByEntityID ? entity.getEntityID() : entity.id;

        // check for an existing
        let existing = this._entitiesByID.get(entityID);

        if (existing) {
            // console.log('[_addEntity][existing]', existing !== undefined, this._entitiesByID.map(e=>[e.id,e.cid,Object.keys(e.components)]) );
            // console.log('[_addEntity][existing]', Object.keys(this._entitiesByID._objectsByID) );

            let components = entity.getComponents();

            // components.forEach( existing._addComponent( existing );
            components.forEach(c => existing._addComponent(c));

            this._addComponent(components);

            // console.log('[_addEntity]', existing.cid, entityID, Object.keys(existing.components) );
            // console.log('[_addEntity]', existing.cid, entityID, Object.keys(existing.components) );

            return existing;
        } else {
            entity.setRegistry(this.getRegistry());

            if (entity.id === 0) {
                throw new Error('attempting to add invalid entity');
            }

            this._entities.add(entity);
            this._entitiesByID.add(entity);

            // console.log('[_addEntity][added]', entityID, Object.keys(this._entities._objectsByID), Object.keys(this._entitiesByID._objectsByID) );
        }

        // no need for us to issue add events as well as entity:add
        // this.add(entity, { silent: true });

        // ensure that the entities components are indexed separately
        this._addComponent(entity.getComponents());

        return entity;
    }

    /**
     *
     * @param {*} entity
     */
    _removeEntity(entity) {
        this._entities.remove(entity);
        this._entitiesByID.remove(entity);

        // remove component references
        this._removeComponent(entity.getComponents());

        return entity;
    }

    /**
     *
     * @param {*} component
     */
    _addComponent(component) {
        // console.log('[EntitySet][_addComponent] exist', this.cid, this._components.map(c=>[c.id,c.cid]));
        // console.log('[EntitySet][_addComponent]      ', this.cid, component.map(c=>[c.id,c.cid]));
        this._components.add(component);
    }

    /**
     *
     * @param {*} component
     */
    _removeComponent(component) {
        this._components.remove(component);
    }

    /**
     *
     */
    getEntity(entity : EntityID|Entity) : Entity {
        if (isEntity(entity)) {
            entity = (<Entity>entity).getEntityID();
        }
        if (isEntityID(entity)) {
            return this._entities.get(<number>entity);
        }
        return undefined;
    }

    /**
     *
     * @param {*} entity
     */
    hasEntity(entity) : boolean {
        // console.log('[hasEntity]', entity);// this._entities._objectsByID[entity] !== undefined, entity);
        return this._entities.has(entity);
    }

    /**
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(
        entitiesAdded: Collection<Entity>,
        entitiesUpdated: Collection<Entity>,
        entitiesRemoved: Collection<Entity>,
        componentsAdded: Collection<Component>,
        componentsUpdated: Collection<Component>,
        componentsRemoved: Collection<Component>,
        options
    ) {
        let ii, len, component;
        let debug = options.debug;
        // entitiesAdded = entitiesAdded.models;
        // entitiesUpdated = entitiesUpdated.models;
        // entitiesRemoved = entitiesRemoved.models;
        // componentsAdded = componentsAdded.models;
        // componentsUpdated = componentsUpdated.models;
        // componentsRemoved = componentsRemoved.models;
        // if (debug)
        //     console.log(
        //         '[EntitySet][update]', this.cid,
        //         entitiesAdded.length,
        //         entitiesUpdated.length,
        //         entitiesRemoved.length,
        //         componentsAdded.length,
        //         componentsUpdated.length,
        //         componentsRemoved.length
        //     );

        // if (debug && entitiesAdded.length)
        //     console.log('[EntitySet][update]', '[entitiesAdded]', entitiesAdded.map(e => e.id));
        // if (debug && entitiesUpdated.length)
        //     console.log('[EntitySet][update]', '[entitiesUpdated]', entitiesUpdated.map(e => e.id));
        // if (debug && entitiesRemoved.length)
        //     console.log('[EntitySet][update]', '[entitiesRemoved]', entitiesRemoved.map(e => e.id));

        // if (debug && componentsAdded.length)
        //     console.log('[EntitySet][update]', '[componentsAdded]', this.id, componentsAdded.map(e => e.id));
        // if (debug && componentsUpdated.length)
        //     console.log('[EntitySet][update]', '[componentsUpdated]', componentsUpdated.map(e => e.id));
        // if (debug && componentsRemoved.length)
        //     console.log('[EntitySet][update]', '[componentsRemoved]', componentsRemoved.map(e => e.id));

        for (ii = 0, len = componentsAdded.models.length; ii < len; ii++) {
            this._addComponent(componentsAdded.models[ii]);
            // if( debug ) console.log('UPDATE/ADD', componentsAdded[ii].getEntityID(), componentsAdded[ii] );
        }

        for (ii = 0, len = componentsUpdated.models.length; ii < len; ii++) {
            component = componentsUpdated.models[ii];
            // console.log(`!!ES!! updated com ${JSON.stringify(component)} ${component.getEntityID()}`);
            let existing = this.getComponentByEntityID(component.getEntityID(), component.getDefID());

            if (existing) {
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityID()}`);
                existing.apply(component, { silent: true });
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityID()}`);
            } else {
                // console.log(`!!!ES!!! adding component update ${JSON.stringify(component)}`);
                this._addComponent(component);
            }
        }

        for (ii = 0, len = componentsRemoved.models.length; ii < len; ii++) {
            this._removeComponent(componentsRemoved.models[ii]);
            // console.log('[EntitySet][update]', COMPONENT_REMOVE, componentsRemoved );
        }

        for (ii = 0, len = entitiesAdded.models.length; ii < len; ii++) {
            let entity = entitiesAdded.models[ii];
            this._addEntity(entity);
            // console.log('[EntitySet][update]', ENTITY_ADD, entity.id );
        }

        for (ii = 0, len = entitiesUpdated.models.length; ii < len; ii++) {
            let entity = entitiesUpdated.models[ii];
            this._addEntity(entity);
            // console.log('[EntitySet][update]', ENTITY_UPDATE, entity.id );
        }

        for (ii = 0, len = entitiesRemoved.models.length; ii < len; ii++) {
            let entity = entitiesRemoved.models[ii];
            this._removeEntity(entity);
            // console.log('[EntitySet][update]', ENTITY_REMOVE, entity.id );
        }
    }

    /**
     *
     *
     * @param {string} name
     * @param entity
     */
    triggerEntityEvent(name, entity, ...rest) {
        // console.log('[EntitySet][triggerEntityEvent] accepting EE on ' + this.cid+'/'+this.id );
        // console.log('[triggerEntityEvent]', 'view', this._views);
        // if (Array.isArray(this._views)) {
        //     Object.values(this._views).forEach(view => {
        //         if ((q = view.getQuery()) && q.execute(entity)) {
        //             view.triggerEntityEvent.apply(view, [name, entity, view, ...rest]);
        //         }
        //     });
        // }

        // trigger a entity-event event - which other views can listen to and respond to
        this.trigger.apply(this, [ EntityEvent.EntityEvent, name, entity, this, ...rest]);
        this.trigger.apply(this, [name, entity, this, ...rest]);

        return this;
    }

    /**
     * Executes a query against this entityset
     *
     * @param {*} query
     * @param {*} options
     */
    query(query, options:QueryExecuteOptions = {}) {
        options.registry = this.getRegistry();

        if (!query) {
            query = Q => Q.root(); // Query.root();
        }
        if (query instanceof Query) {
            return query.execute(this, options);
        }
        return Query.exec(query, this, options);
    }

    /**
     * Removes the entities identified by the query
     */
    removeByQuery(query, options = {}) {
        options = { ...options, registry: this.getRegistry() };

        const result = Query.exec(query, this, options);

        return this.removeEntity(result.map(e => e.id));
    }

    /**
     * Applies a map function over the contained entities
     * and returns an array of results
     *
     * @param {*} mapFn
     */
    map(mapFn) {
        return this._entities.map(mapFn);
    }
}



