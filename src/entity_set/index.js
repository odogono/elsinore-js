import Base from '../base';
import Collection from '../util/collection';
import BitField from 'odgn-bitfield';
import Component from '../component';
import Entity from '../entity';

import Query from '../query';
import stringify from '../util/stringify';
import { isInteger, isPromise } from '../util/is';
import uniqueId from '../util/unique_id';
import valueArray from '../util/array/value';
import {componentsFromCollections} from '../util/array/value';
import { isObject } from '../util/is';
import createUUID from '../util/uuid';
import hash from '../util/hash';
import { cloneEntity } from '../util/clone';

import CmdBuffer from '../cmd_buffer/sync';

import {PullStreamSource} from './source';
import {PullStreamSink} from './sink';

export default function EntitySet(entities, options = {}) {
    this.initialize(entities, options);
}

/**
 * An EntitySet is a container for entities
 */
Object.assign(EntitySet.prototype, Base.prototype, {
    initialize(entities, options = {}) {
        // this collection of entities indexes by the entity ids
        this._entities = new Collection();
        this._entitiesById = new Collection(null, {debug:true, idAttribute: e => e ? e.getEntityId() : undefined});
        this._components = new Collection();

        let cmdBufferType = CmdBuffer;
        this._uuid = options.uuid || createUUID();
        this.cid = uniqueId('es');

        if (options['id']) {
            this.id = options['id'];
        }

        if (options.cmdBuffer) {
            cmdBufferType = options.cmdBuffer;
        }
        this._cmdBuffer = new cmdBufferType();
        this.allowEmptyEntities = options.allowEmptyEntities === void 0 ? true : options.allowEmptyEntities;
    },

    /**
     * Returns the id of the entitySet
     */
    getEntitySetId() {
        return this.id;
    },

    getUuid() {
        return this._uuid;
    },

    getUUID() {
        return this._uuid;
    },

    hash() {
        return EntitySet.hash(this, this.getQuery());
    },

    destroy() {
        this.stopListening();
        // this.entities = null;
        this.storage = null;
        this.registry = null;
    },

    /**
     * Returns the entity at index
     * 
     * @param {number} index
     */
    at(index) {
        return this._entities.at(index);
    },

    /**
     * Returns an entity by its id
     * 
     * @param {number} entityId 
     */
    getByEntityId( entityId ){
        return this._entitiesById.get( entityId );
    },

    /**
     * Returns the number of entities in this set
     */
    size() {
        return this._entities.size();
    },

    /**
     * Returns an array containing all the entities
     * in this set
     */
    getEntities() {
        return this._entities.models;
    },

    /**
     * 
     */
    toJSON(options = {}) {
        if (!isObject(options)) {
            options = {};
            // return {uuid:this._uuid, msg:options};
            // console.log(`what deal with`, this, options);
            // throw new Error(`what deal with ${options}`, this, typeof this);
        }
        let result = { uuid: this._uuid };
        // { cid:this.cid };
        if (options.mapCdefUri) {
            options.cdefMap = this.getSchemaRegistry().getComponentDefUris();
        }
        options.flatEntity = true;

        result['@e'] = this.models.reduce((acc, e) => {
            return acc.concat(e.toJSON(options));
        }, []);

        return result;
    },

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
    iterator(options) {
        let nextIndex = 0;
        return {
            next: () => {
                return nextIndex < this.size() ? { value: this.at(nextIndex++), done: false } : { done: true };
            }
        };
    },

    /**
     * Returns a Pull-Stream source
     * 
     * see https://pull-stream.github.io/
     * 
     * @param {*} options 
     */
    source(options) {
        return PullStreamSource(this, options);
    },

    /**
     * Returns a Pull-Stream sink
     * 
     * @param {*} options 
     */
    sink(options, completeCb) {
        return PullStreamSink(this, options, completeCb);
    },

    /**
     * 
     * @param {*} registry 
     * @param {*} options 
     */
    setRegistry(registry, options) {
        this._registry = registry;
    },

    /**
     * 
     */
    getRegistry() {
        return this._registry;
    },

    /**
     * 
     */
    getSchemaRegistry() {
        return this.getRegistry().schemaRegistry;
    },

    /**
     * Adds a component to this set
     * Returns the entities that were added or updated as a result
     * @param {*} component 
     * @param {*} options 
     */
    addComponent(component, options) {
        // conveniently create a component instance if raw data is passed
        if (component['@c'] || Array.isArray(component)) {
            component = this.getRegistry().createComponent(component);
        }
        return this._cmdBuffer.addComponent(this, component, options);
    },

    /**
     * Returns the components that were added or updated in the last
     * operation
     */
    getUpdatedComponents() {
        return componentsFromCollections(
            this._cmdBuffer.entitiesAdded,
            this._cmdBuffer.entitiesUpdated,
            this._cmdBuffer.componentsAdded,
            this._cmdBuffer.componentsUpdated
        );
    },

    /**
     * 
     */
    getRemovedComponents(){
        return componentsFromCollections( this._cmdBuffer.entitiesRemoved, this._cmdBuffer.componentsRemoved );
    },

    /**
     * Returns the entities that were added or updated in the last operation
     */
    getUpdatedEntities(){
        return valueArray( this._cmdBuffer.entitiesAdded, this._cmdBuffer.entitiesUpdated);
    },

    /**
     * 
     */
    getRemovedEntities(){
        return valueArray( this._cmdBuffer.entitiesRemoved );
    },

    /**
     * Returns an existing component instance (if it exists)
     * 
     * @param {*|integer} component
     * @returns {*} a component instance
     */
    getComponent(component) {
        let componentId = component;
        if (Component.isComponent(component)) {
            componentId = component.id;
        }

        // console.log('[EntitySet][getComponent]', this.cid, componentId, this._components.get(componentId) );

        return this._components.get(componentId);
    },

    /**
     * Returns a component by its entityid and def id
     * 
     * @param {*} entityId 
     * @param {*} componentDefId 
     */
    getComponentByEntityId(entityId, componentDefId) {
        const entity = this._entities.get(entityId);
        if (entity !== undefined) {
            return entity.components[componentDefId];
        }
        return null;
    },

    /**
     * 
     * @param {*} component 
     * @param {*} options 
     */
    removeComponent(component, options) {
        return this._cmdBuffer.removeComponent(this, component, options);
    },

    /**
    *   Flushes any outstanding commands in the buffer
    */
    flush(options) {
        return this._cmdBuffer.flush(this, options);
    },

    /**
    *   Adds an entity with its components to the entityset
    * @param {*} entity - Entity, array of entities, array of raw components
    */
    addEntity(entity, options) {
        let add = null;
        let isArray = Array.isArray(entity);
        if (EntitySet.isMemoryEntitySet(entity)) {
            entity = entity.models;
            isArray = true;
        }

        if (isArray) {
            if (entity.length <= 0) {
                return;
            }
            if (Entity.isEntity(entity[0])) {
                add = entity;
            }
        } else if (Entity.isEntity(entity)) {
            add = entity;
        }

        if (!add) {
            add = this.getRegistry().createEntity(entity);
        }

        let result = this._cmdBuffer.addEntity(this, add, options);
        return result;
    },

    
    /**
     * 
     * @param {*} entity 
     * @param {*} options 
     */
    removeEntity(entity, options) {
        if (EntitySet.isMemoryEntitySet(entity)) {
            entity = entity.models;
        }
        return this._cmdBuffer.removeEntity(this, entity, options);
    },

    /**
     * 
     * @param {*} entityId 
     * @param {*} returnId 
     * @param {*} options 
     */
    _createEntity(entityId, returnId, options = {}) {
        let result;
        const registry = this.getRegistry();

        entityId = parseInt(entityId, 10) || 0;

        if (entityId <= 0) {
            entityId = registry.createId();
        }

        if (returnId) {
            return entityId;
        }

        result = registry.createEntity(null, { id: entityId });
        // make sure we don't set the entityset id - memory entitysets retain
        // the original entityset id
        result.setEntitySet(this, false);

        return result;
    },

    /**
     * 
     */
    _createComponentId() {
        return this.getRegistry().createId();
    },

    /**
     * 
     * @param {*} entity 
     */
    _addEntity(entity) {
        entity.setRegistry(this.getRegistry());
        // no need for us to issue add events as well as entity:add
        // this.add(entity, { silent: true });

        if (entity.id === 0) {
            throw new Error('attempting to add invalid entity');
        }

        this._entities.add(entity);
        this._entitiesById.add(entity);

        // ensure that the entities components are indexed separately
        this._addComponent(entity.getComponents());

        return entity;
    },

    /**
     * 
     * @param {*} entity 
     */
    _removeEntity(entity) {
        this._entities.remove(entity);
        this._entitiesById.remove(entity);

        // remove component references
        this._removeComponent(entity.getComponents());

        return entity;
    },

    /**
     * 
     * @param {*} component 
     */
    _addComponent(component) {
        // console.log('[EntitySet][_addComponent] exist', this.cid, this._components.map(c=>[c.id,c.cid]));
        // console.log('[EntitySet][_addComponent]      ', this.cid, component.map(c=>[c.id,c.cid]));
        this._components.add(component);
    },

    /**
     * 
     * @param {*} component 
     */
    _removeComponent(component) {
        this._components.remove(component);
    },

    /**
     * 
     * @param {*} entity 
     * @param {*} options 
     */
    getEntity(entity, options) {
        if (Entity.isEntity(entity)) {
            entity = entity.getEntityId();
        }
        if (isInteger(entity)) {
            return this._entities.get(entity);
        }
        return undefined;
    },

    hasEntity(entity) {
        console.log('[hasEntity]', entity);// this._entities._objectsById[entity] !== undefined, entity);
        return this._entities.has(entity);
    },

    /**
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(
        entitiesAdded,
        entitiesUpdated,
        entitiesRemoved,
        componentsAdded,
        componentsUpdated,
        componentsRemoved,
        options
    ) {
        let ii, len, component;
        let debug = options.debug;
        entitiesAdded = entitiesAdded.models;
        entitiesUpdated = entitiesUpdated.models;
        entitiesRemoved = entitiesRemoved.models;
        componentsAdded = componentsAdded.models;
        componentsUpdated = componentsUpdated.models;
        componentsRemoved = componentsRemoved.models;
        if (debug)
            console.log(
                '[EntitySet][update]', this.cid,
                entitiesAdded.length,
                entitiesUpdated.length,
                entitiesRemoved.length,
                componentsAdded.length,
                componentsUpdated.length,
                componentsRemoved.length
            );

        if (debug && entitiesAdded.length)
            console.log('[EntitySet][update]', '[entitiesAdded]', entitiesAdded.map(e => e.id));
        if (debug && entitiesUpdated.length)
            console.log('[EntitySet][update]', '[entitiesUpdated]', entitiesUpdated.map(e => e.id));
        if (debug && entitiesRemoved.length)
            console.log('[EntitySet][update]', '[entitiesRemoved]', entitiesRemoved.map(e => e.id));

        if (debug && componentsAdded.length)
            console.log('[EntitySet][update]', '[componentsAdded]', this.id, componentsAdded.map(e => e.id));
        if (debug && componentsUpdated.length)
            console.log('[EntitySet][update]', '[componentsUpdated]', componentsUpdated.map(e => e.id));
        if (debug && componentsRemoved.length)
            console.log('[EntitySet][update]', '[componentsRemoved]', componentsRemoved.map(e => e.id));

        for (ii = 0, len = componentsAdded.length; ii < len; ii++) {
            this._addComponent(componentsAdded[ii]);
            // console.log('UPDATE/ADD', componentsAdded[ii].getEntityId(), componentsAdded[ii].id );
        }

        for (ii = 0, len = componentsUpdated.length; ii < len; ii++) {
            component = componentsUpdated[ii];
            // console.log(`!!ES!! updated com ${JSON.stringify(component)} ${component.getEntityId()}`);
            let existing = this.getComponentByEntityId(component.getEntityId(), component.getDefId());

            if (existing) {
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
                existing.apply(component, { silent: true });
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
            } else {
                // console.log(`!!!ES!!! adding component update ${JSON.stringify(component)}`);
                this._addComponent(component);
            }
        }

        for (ii = 0, len = componentsRemoved.length; ii < len; ii++) {
            this._removeComponent(componentsRemoved[ii]);
            // console.log('[EntitySet][update]', 'component:remove', componentsRemoved );
        }

        for (ii = 0, len = entitiesAdded.length; ii < len; ii++) {
            let entity = entitiesAdded[ii];
            this._addEntity(entity);
            // console.log('[EntitySet][update]', 'entity:add', entity.id );
        }

        for (ii = 0, len = entitiesUpdated.length; ii < len; ii++) {
            let entity = entitiesUpdated[ii];
            this._addEntity(entity);
            // console.log('[EntitySet][update]', 'entity:update', entity.id );
        }

        for (ii = 0, len = entitiesRemoved.length; ii < len; ii++) {
            let entity = entitiesRemoved[ii];
            this._removeEntity(entity);
            // console.log('[EntitySet][update]', 'entity:remove', entity.id );
        }
    },

    /**
     * 
     * 
     * @param {string} name
     * @param entity
     */
    triggerEntityEvent(name, entity, ...rest) {
        // log.debug('accepting EE on ' + this.cid+'/'+this.id );
        // console.log('[triggerEntityEvent]', 'view', this._views);
        if (Array.isArray(this._views)) {
            Object.values(this._views).forEach(view => {
                if ((q = view.getQuery()) && q.execute(entity)) {
                    // NOTE: wierd, but it seems that arguments gets clobbered by the time it gets here - don't yet know why
                    view.triggerEntityEvent.apply(view, [name, entity, view, ...rest]);
                }
            });
        }

        return this.trigger.apply(this, [name, entity, this, ...rest]);
    },

    /**
     * 
     * @param {*} entityOrFilter 
     * @param {*} name 
     * @param {*} callback 
     * @param {*} context 
     */
    listenToEntityEvent(entityOrFilter, name, callback, context) {
        if (!this._entityEvents) {
            this._entityEvents = Object.assign({}, Events);
            // this._entityEvents.on('all', function(){
            //     log.debug('eevt: ' + JSON.stringify(arguments) );
            // })
        }

        this._entityEvents.listenTo(this._entityEvents, name, callback);
    },

    // TODO: remove
    doesEntityHaveComponent(entityId, componentId, options) {
        let entity;
        if (isInteger(entityId)) {
            entity = this.at(entityId);
        }

        if (!entity) {
            throw new Error('entity not found: ' + entityId);
        }

        let bf = entity.getComponentBitfield();
        if (BitField.isBitField(componentId)) {
            return BitField.and(componentDef, bf);
        }
        // let componentDefId = ComponentDef.getId( componentDef );
        return bf.get(componentId);
        // return entity.hasComponent( componentId );
    },

    // TODO: remove
    removeComponentFromEntity(component, entity, options) {
        entity.removeComponent(component);

        this.getRegistry().destroyComponent(component);

        return this;
    },

    // TODO: remove
    getComponentFromEntity(component, entity, options) {
        return entity.components[component.getDefId()];
    },

    // TODO: remove
    doesEntityHaveComponents(entity, options) {
        let bf = entity.getComponentBitfield();
        if (bf.count() > 0) {
            return true;
        }
        let size = Object.keys(entity.components).length;
        return size > 0;
    },

    /**
     * Executes a query against this entityset
     * 
     * @param {*} query 
     * @param {*} options 
     */
    query(query, options = {}) {
        options.registry = this.getRegistry();

        if (!query) {
            query = Q => Q.root(); // Query.root();
        }
        if (query instanceof Query) {
            return query.execute(this, options);
        }
        return Query.exec(query, this, options);
    },

    /**
     * Removes the entities identified by the query
     * @param {*} query 
     * @param {*} options 
     */
    removeByQuery(query, options = {}) {
        options = { ...options, registry: this.getRegistry() };
        const result = Query.exec(query, this, options);
        return this.removeEntity(result);
    }
});

EntitySet.prototype.type = 'EntitySet';
EntitySet.prototype.isMemoryEntitySet = true;
EntitySet.prototype.isEntitySet = true;
EntitySet.prototype.isAsync = false;
EntitySet.prototype.cidPrefix = 'es';
EntitySet.prototype.views = null;

EntitySet.hash = function(entitySet, query) {
    let str = stringify(entitySet.toJSON());
    // query = query || this._query;
    if (query) {
        str += query.hash();
    }

    return hash(str, true);
};

EntitySet.isEntitySet = function(es) {
    return es && es.isEntitySet;
};

EntitySet.isMemoryEntitySet = function(es) {
    return EntitySet.isEntitySet(es) && es.isMemoryEntitySet;
};
