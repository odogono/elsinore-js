/* @flow */

import { Collection, Events } from 'odgn-backbone-model';
import BitField from 'odgn-bitfield';

import Component from '../component';
import Entity from '../entity';
// import EntityFilter from '../entity_filter';
import Query from '../query';
import { clone, hash, isInteger, stringify, isFunction, isObject, isPromise, uniqueId } from '../util';
import { uuid as createUUID } from '../util/uuid';

// import * as CmdBuffer from '../cmd_buffer/sync';
import CmdBuffer from '../cmd_buffer/sync';

let CollectionPrototype = Collection.prototype;

class ComponentCollection extends Collection {}
ComponentCollection.model = Component;

/**
 * An EntitySet is a container for entities
 */
export default class EntitySet extends Collection {
    initialize(entities, options = {}) {
        let cmdBuffer = CmdBuffer;
        this._uuid = options.uuid || createUUID();
        this.cid = uniqueId('es');
        this.components = new ComponentCollection();

        if (options['id']) {
            this.id = options['id'];
        }

        if (options.cmdBuffer) {
            cmdBuffer = options.cmdBuffer;
        }
        this._cmdBuffer = new cmdBuffer();
        this.allowEmptyEntities = options.allowEmptyEntities === void 0 ? true : options.allowEmptyEntities;
    }

    getEntitySetId() {
        return this.id;
    }

    getUuid() {
        return this._uuid;
    }

    getUUID() {
        return this._uuid;
    }

    hash() {
        return EntitySet.hash(this, this.getQuery());
    }

    destroy() {
        this.stopListening();
        // this.entities = null;
        this.storage = null;
        this.registry = null;
    }

    size() {
        return this.length;
    }

    /**
     * 
     */
    toJSON(options: object = {}) {
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
     */
    iterator(options) {
        let nextIndex = 0;
        return {
            next: () => {
                return nextIndex < this.length ? { value: this.at(nextIndex++), done: false } : { done: true };
            },
        };
    }

    /**
     * Create a 'faux' readStream which returns the entitysets
     * components in an asynchronous manner.
     * And by 'faux', it is not compatible with any official
     * readstream implementation.
     * 
     * Each component is emitted with a 'data' event. Once the
     * components have been exhausted, a 'end' event is emitted.
     * 
     */
    createReadStream(options = {}) {
        let index = 0;
        let length = this.length;
        let entity = null;
        let components = null;
        let entityIndex = 0;
        let stream = Object.assign({}, Events);

        const fnIterate = () => {
            // calls -= 1;
            if (index == length) {
                stream.trigger('end');
                return;
            }
            if (!components || entityIndex == components.length) {
                entity = null;
            }

            if (!entity) {
                entity = this.at(index++);
                components = entity.getComponents();
                entityIndex = 0;
            }

            let component = components[entityIndex++];

            stream.trigger('data', component);

            fnResume();
        };

        const fnResume = () => {
            // calls += 1;
            setTimeout(fnIterate, 1);
        };

        fnResume();

        return stream;
    }

    /**
     * Creates a pull-stream sink which accepts either Entity or 
     * Component instances and adds them to the entityset
     * 
     * @param {Object} options
     * @param {function} completeCb called when complete
     * @returns {function}
     */
    createPullStreamSink(options = {}, completeCb) {
        const self = this;
        return function(read) {
            read(null, function next(end, data) {
                if (end === true) {
                    return completeCb();
                }
                if (end) {
                    return completeCb(end);
                }
                let result = null;

                if (Entity.isEntity(data)) {
                    result = self.addEntity(data);
                } else if (Component.isComponent(data)) {
                    result = self.addComponent(data);
                } else {
                    return read(new Error('invalid data', data), completeCb);
                }

                if (isPromise(result)) {
                    result
                        .then(() => {
                            read(null, next);
                        })
                        .catch(err => {
                            read(err, completeCb);
                        });
                } else {
                    read(null, next);
                }
            });
        };
    }

    /**
     * creates a pullstream of components in the entityset
     * 
     * see https://pull-stream.github.io/
     * 
     * @returns {function}
     */
    createPullStreamSource(options = {}) {
        let index = 0;
        const length = this.length;
        let entity = null;
        let components = null;
        let entityIndex = 0;

        return (abort, cb) => {
            if (abort) {
                return cb(abort);
            }
            if (index >= length) {
                return cb(true, null);
            }
            if (!components || entityIndex == components.length) {
                entity = null;
            }
            if (!entity) {
                entity = this.at(index++);
                components = entity.getComponents();
                entityIndex = 0;
            }
            let component = components[entityIndex++];

            return cb(null, component);
        };
    }

    /**
     * 
     */
    setRegistry(registry, options) {
        this._registry = registry;
    }

    /**
     * 
     */
    getRegistry() {
        return this._registry;
    }

    /**
     * 
     */
    getSchemaRegistry() {
        return this.getRegistry().schemaRegistry;
    }

    /**
    *   TODO: move out of here
    */
    attachTo(otherEntitySet, options) {
        // load the start state from this entity set
        otherEntitySet.reset(this);
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent);
    }

    /**
    *   TODO: move out of here
    */
    onEntitySetEvent(evt, ...args) {
        switch (evt) {
            // case 'entity:add':
            // return this.add.apply( this, args );
            case 'component:add':
                args[1] = { ...args[1], clone: true };
                return this.addComponent.apply(this, args);
            case 'component:remove':
                return this.removeComponent.apply(this, args);
            // case 'entity:remove':
            // return this.remove.apply( this, args );
            case 'reset':
                return this.reset.apply(this, args);
            default:
                break;
        }
        return this;
    }

    /**
    * Adds a component to this set
    */
    addComponent(component, options) {
        // conveniently create a component instance if raw data is passed
        if (component['@c']) {
            component = this.getRegistry().createComponent(component);
        }
        return this._cmdBuffer.addComponent(this, component, options);
    }

    /**
     * Returns an existing component instance (if it exists)
     */
    getComponent(component) {
        let componentId;
        if (isInteger(component)) {
            componentId = component;
        } else if (Component.isComponent(component)) {
            componentId = component.id;
        }

        return this.components.get(componentId);
    }

    /**
     * Returns a component by its entityid and def id
     */
    getComponentByEntityId(entityId, componentDefId) {
        const entity = this.get(entityId);
        if (entity) {
            return entity.components[componentDefId];
        }
        return null;
    }

    /**
    *
    */
    removeComponent(component, options) {
        return this._cmdBuffer.removeComponent(this, component, options);
    }

    // add: function( entity, options ){
    //     // 
    // },
    _addModels(models, options) {
        return CollectionPrototype.call(this, entity, options);
    }

    /**
    *   Flushes any outstanding commands in the buffer
    */
    flush(options) {
        return this._cmdBuffer.flush(this, options);
    }

    /**
    *   Adds an entity with its components to the entityset
    * @param entity - Entity, array of entities, array of raw components
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
        return this._cmdBuffer.addEntity(this, add, options);
    }

    /**
    *
    */
    removeEntity(entity, options) {
        if (EntitySet.isMemoryEntitySet(entity)) {
            entity = entity.models;
        }
        return this._cmdBuffer.removeEntity(this, entity, options);
    }

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
    }

    _createComponentId() {
        return this.getRegistry().createId();
    }

    _addEntity(entity) {
        entity.setRegistry(this.getRegistry());
        // no need for us to issue add events as well as entity:add
        this.add(entity, { silent: true });
        return entity;
    }

    _removeEntity(entity) {
        // let entityId = Entity.toEntityId(entity);
        // no need for us to issue remove events as well as entity:remove
        this.remove(entity, { silent: true });
        return entity;
    }

    getEntity(entity, options) {
        return this.get(entity, options);
    }

    hasEntity(entity) {
        return this.get(entity) !== undefined;
    }

    /**
     * TODO: finish
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved) {
        let ii, len, component;

        for (ii = 0, len = componentsAdded.length; ii < len; ii++) {
            this.components.add(componentsAdded[ii]);
            // console.log('UPDATE/ADD', componentsAdded[ii].getEntityId() );
        }
        for (ii = 0, len = componentsUpdated.length; ii < len; ii++) {
            component = componentsUpdated[ii];
            // console.log(`!!ES!! updated com ${JSON.stringify(component)} ${component.getEntityId()}`);
            let existing = this.getComponentByEntityId(component.getEntityId(), component.getDefId());
            // let existing = this.components.get( component );
            if (existing) {
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
                existing.apply(component, { silent: true });
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
            } else {
                // console.log(`!!!ES!!! adding component update ${JSON.stringify(component)}`);
                this.components.add(component);
            }
        }
        for (ii = 0, len = componentsRemoved.length; ii < len; ii++) {
            this.components.remove(componentsRemoved[ii]);
        }
    }

    /**
     * Replaces the entitySets entities with the specified entities
     */
    reset(entities, options) {
        let ii, len, entity;
        if (entities && entities.isEntitySet) {
            // console.log('reset from',entities.cid,'to',this.cid,'count', entities.models.length);
            entities = entities.models;
        }

        const query = this.getQuery();

        if (!query || query.isEmpty()) {
            // console.log('reset - no query');
            return CollectionPrototype.reset.call(this, entities);
        }

        // console.log('reset - using query', query );
        CollectionPrototype.reset.call(this, null, { silent: true });

        for (ii = 0, len = entities.length; ii < len; ii++) {
            entity = entities[ii];
            if (this.isEntityOfInterest(entity, query)) {
                this.add(entity);
            }
        }

        return entities;
    }

    /**
     * 
     * 
     * @param {string} name
     * @param entity
     */
    triggerEntityEvent(name, entity, ...rest) {
        // const args = [name,entity,...rest];
        let q = this.getQuery();

        if (q && !q.execute(entity)) {
            return false;
        }

        // log.debug('accepting EE on ' + this.cid+'/'+this.id );
        if (Array.isArray(this.views)) {
            this.views.forEach(view => {
                if ((q = view.getQuery()) && q.execute(entity)) {
                    // NOTE: wierd, but it seems that arguments gets clobbered by the time it gets here - don't yet know why
                    view.triggerEntityEvent.apply(view, [ name, entity, view, ...rest ]);
                }
            });
        }

        // console.log(`[entitySet][triggerEntityEvent]`, JSON.stringify(args));
        return this.trigger.apply(this, [ name, entity, this, ...rest ]);
    }

    listenToEntityEvent(entityOrFilter, name, callback, context) {
        if (!this._entityEvents) {
            this._entityEvents = clone(Events);
            // this._entityEvents.on('all', function(){
            //     log.debug('eevt: ' + JSON.stringify(arguments) );
            // })
        }

        this._entityEvents.listenTo(this._entityEvents, name, callback);
    }

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
    }

    // TODO: remove
    removeComponentFromEntity(component, entity, options) {
        entity.removeComponent(component);

        this.getRegistry().destroyComponent(component);

        return this;
    }

    // TODO: remove
    getComponentFromEntity(component, entity, options) {
        return entity.components[component.getDefId()];
    }

    // TODO: remove
    doesEntityHaveComponents(entity, options) {
        let bf = entity.getComponentBitfield();
        if (bf.count() > 0) {
            return true;
        }
        let size = Object.keys(entity.components).length;
        return size > 0;
    }


    /**
     * Sets a query against this entityset.
     * All entities which are added to the ES are
     * passed through the query for validity
     */
    setQuery(query, options = {}) {
        this._query = null;
        if (!query) {
            return;
        }
        if (query instanceof Query) {
            if (query.isEmpty()) {
                return;
            }
            this._query = new Query(query);
            return;
        }
        if (isFunction(query)) {
            this._query = new Query(query);
        }

        // check that entities are still allowed to belong to this set
        this.evaluateEntities();

        return this._query;
    }

    getQuery() {
        return this._query;
    }

    /**
     * Executes a query against this entityset
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
    }

    /**
    *   Removes the entities identified by the query
    */
    removeByQuery(query, options = {}) {
        options = { ...options, registry: this.getRegistry() };
        const result = Query.exec(query, this, options);
        return this.removeEntity(result);
    }

    isEntityOfInterest(entity, options) {
        if (!this._query) {
            return true;
        }
        const tEntity = this._query.execute(entity);
        return tEntity ? true : false;
    }

    /**
    *   Checks through all contained entities, ensuring that they
    *   are still valid members of this entitySet according to the
    *   query
    */
    evaluateEntities(entityIdArray, options = {}) {
        let ii, len, entity;
        // let entities;
        let removed = [];

        if (!this._query) {
            return removed;
        }

        if (entityIdArray) {
            for (ii = 0, len = entityIdArray.length; ii < len; ii++) {
                entity = this.get(entityIdArray[ii]);
                if (entity && !this._query.execute(entity)) {
                    removed.push(entity);
                }
            }
        } else {
            // entities = this.entities || this;
            for (ii = this.length - 1; ii >= 0; ii--) {
                entity = this.at(ii);
                if (entity && !this._query.execute(entity)) {
                    removed.push(entity);
                }
            }
        }

        if (removed.length > 0) {
            return this.removeEntity(removed, options);
        }
        return removed;
    }

    /**
    *   Transfers entities from src to dst whilst applying the filter
    *   The query is then set on the dstEntitySet
    */
    map(query, dstEntitySet, options = {}) {
        // let entity;
        dstEntitySet.reset();

        if (query) {
            dstEntitySet.setQuery(query);
        }

        dstEntitySet.addEntity(this);

        return dstEntitySet;
    }
}

EntitySet.prototype.type = 'EntitySet';
EntitySet.prototype.isMemoryEntitySet = true;
EntitySet.prototype.isEntitySet = true;
EntitySet.prototype.isAsync = false;
EntitySet.prototype.cidPrefix = 'es';
EntitySet.prototype.views = null;

EntitySet.hash = function(entitySet, query) {
    let str = stringify(entitySet.toJSON());
    query = query || this._query;
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
