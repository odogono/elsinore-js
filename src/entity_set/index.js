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
import {isObject} from '../util/is';
import createUUID from '../util/uuid';
import hash from '../util/hash';
import {cloneEntity} from '../util/clone';

import CmdBuffer from '../cmd_buffer/sync';

import PullStreamSource from './source';
import PullStreamSink from './sink';


// let CollectionPrototype = Collection.prototype;

// class ComponentCollection extends Collection {}
// ComponentCollection.model = Component;

export default function EntitySet(entities, options={}){
    this.initialize(entities,options);
}

/**
 * An EntitySet is a container for entities
 */
Object.assign( EntitySet.prototype, Base.prototype, {

    initialize(entities, options = {}) {

        this._entities = new Collection();
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
    at(index){
        return this._entities.at(index);
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
    getEntities(){
        return this._entities.models;
    },

    /**
     * 
     */
    toJSON(options= {}) {
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
            },
        };
    },

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
    // createReadStream(options = {}) {
    //     let index = 0;
    //     let length = this.length;
    //     let entity = null;
    //     let components = null;
    //     let entityIndex = 0;
    //     let stream = Object.assign({}, Events);

    //     const fnIterate = () => {
    //         // calls -= 1;
    //         if (index == length) {
    //             stream.trigger('end');
    //             return;
    //         }
    //         if (!components || entityIndex == components.length) {
    //             entity = null;
    //         }

    //         if (!entity) {
    //             entity = this.at(index++);
    //             components = entity.getComponents();
    //             entityIndex = 0;
    //         }

    //         let component = components[entityIndex++];

    //         stream.trigger('data', component);

    //         fnResume();
    //     };

    //     const fnResume = () => {
    //         // calls += 1;
    //         setTimeout(fnIterate, 1);
    //     };

    //     fnResume();

    //     return stream;
    // }

    /**
     * Creates a pull-stream sink which accepts either Entity or 
     * Component instances and adds them to the entityset
     * 
     * @param {Object} options
     * @param {function} completeCb called when complete
     * @returns {function}
     */
    // createPullStreamSink(options = {}, completeCb) {
    //     const self = this;
    //     return function(read) {
    //         read(null, function next(end, data) {
    //             if (end === true) {
    //                 return completeCb();
    //             }
    //             if (end) {
    //                 return completeCb(end);
    //             }
    //             let result = null;

    //             if (Entity.isEntity(data)) {
    //                 result = self.addEntity(data);
    //             } else if (Component.isComponent(data)) {
    //                 result = self.addComponent(data);
    //             } else {
    //                 return read(new Error('invalid data', data), completeCb);
    //             }

    //             if (isPromise(result)) {
    //                 result
    //                     .then(() => {
    //                         read(null, next);
    //                     })
    //                     .catch(err => {
    //                         read(err, completeCb);
    //                     });
    //             } else {
    //                 read(null, next);
    //             }
    //         });
    //     };
    // }

    /**
     * creates a pullstream of components in the entityset
     * 
     * see https://pull-stream.github.io/
     * 
     * @returns {function}
     */
    // createPullStreamSource(options = {}) {
    //     let index = 0;
    //     const length = this.length;
    //     let entity = null;
    //     let components = null;
    //     let entityIndex = 0;

    //     return (abort, cb) => {
    //         if (abort) {
    //             return cb(abort);
    //         }
    //         if (index >= length) {
    //             return cb(true, null);
    //         }
    //         if (!components || entityIndex == components.length) {
    //             entity = null;
    //         }
    //         if (!entity) {
    //             entity = this.at(index++);
    //             components = entity.getComponents();
    //             entityIndex = 0;
    //         }
    //         let component = components[entityIndex++];

    //         return cb(null, component);
    //     };
    // }

    /**
     * Returns a Pull-Stream source
     * 
     * see https://pull-stream.github.io/
     * 
     * @param {*} options 
     */
    source(options){
        return PullStreamSource(this,options);
    },

    /**
     * Returns a Pull-Stream sink
     * 
     * @param {*} options 
     */
    sink(options, completeCb){
        return PullStreamSink( this, options, completeCb);
    },

    /**
     * 
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
    */
    addComponent(component, options) {
        // conveniently create a component instance if raw data is passed
        if (component['@c'] || Array.isArray(component) ) {
            component = this.getRegistry().createComponent(component);
        }
        return this._cmdBuffer.addComponent(this, component, options);
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

        // console.log('[EntitySet][getComponent]', componentId, this._components );

        return this._components.get(componentId);
    },

    /**
     * Returns a component by its entityid and def id
     */
    getComponentByEntityId(entityId, componentDefId) {
        const entity = this._entities.get(entityId);
        if (entity !== undefined ) {
            return entity.components[componentDefId];
        }
        return null;
    },

    /**
    *
    */
    removeComponent(component, options) {
        return this._cmdBuffer.removeComponent(this, component, options);
    },

    // add: function( entity, options ){
    //     // 
    // },
    // _addModels(models, options) {
    //     return CollectionPrototype.call(this, entity, options);
    // }

    /**
    *   Flushes any outstanding commands in the buffer
    */
    flush(options) {
        return this._cmdBuffer.flush(this, options);
    },

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

        let result = this._cmdBuffer.addEntity(this, add, options);
        return result;
    },

    /**
    *
    */
    removeEntity(entity, options) {
        if (EntitySet.isMemoryEntitySet(entity)) {
            entity = entity.models;
        }
        return this._cmdBuffer.removeEntity(this, entity, options);
    },

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

        if( entity.id === 0 ){
            throw new Error('attempting to add invalid entity');
        }

        this._entities.add( entity );

        // ensure that the entities components are indexed separately 
        this._addComponent( entity.getComponents() );

        return entity;
    },

    /**
     * 
     * @param {*} entity 
     */
    _removeEntity(entity) {
        this._entities.remove( entity );

        // remove component references
        this._removeComponent( entity.getComponents() );

        // console.log('[_removeEntity]', 'remove entity',entity.id);
        // let existing = this._entities.get(entity.id);

        // if( existing ){
        //     delete this._entitiesMap[entity.id];
        //     delete this._entitiesById[entity.id];

        //     let index = this._entities.indexOf(entity);
        //     this._entities.splice( index,1 );
        // } else {
        //     // console.log('could not find', entity.cid, this._entitiesMap );
        //     // throw new Error('stop');
        // }

        // let entityId = Entity.toEntityId(entity);
        // no need for us to issue remove events as well as entity:remove
        // this.remove(entity, { silent: true });
        return entity;
    },

    /**
     * 
     * @param {*} component 
     */
    _addComponent(component){
        this._components.add( component );
    },

    /**
     * 
     * @param {*} component 
     */
    _removeComponent(component){
        this._components.remove(component);
    },


    /**
     * 
     * @param {*} entity 
     * @param {*} options 
     */
    getEntity(entity, options) {
        if( Entity.isEntity(entity) ){
            entity = entity.getEntityId();
        }
        if( isInteger(entity) ){
            return this._entities.get(entity);
        }
        return undefined;
    },

    hasEntity(entity) {
        // console.log('[hasEntity]', this._entities._objectsById[entity] !== undefined, entity);
        return this._entities.has(entity);
    },

    /**
     * TODO: finish
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved, options) {
        let ii, len, component;
        let debug = options.debug;
        entitiesAdded = entitiesAdded.models;
        entitiesUpdated = entitiesUpdated.models;
        entitiesRemoved = entitiesRemoved.models;
        componentsAdded = componentsAdded.models;
        componentsUpdated = componentsUpdated.models;
        componentsRemoved = componentsRemoved.models;
        if(debug) console.log('[EntitySet][update]', entitiesAdded.length, entitiesUpdated.length, entitiesRemoved.length, componentsAdded.length, componentsUpdated.length, componentsRemoved.length );
        
        if( debug && entitiesAdded.length ) console.log('[EntitySet][update]','[entitiesAdded]', entitiesAdded.map( e => e.id) );
        if( debug && entitiesUpdated.length ) console.log('[EntitySet][update]','[entitiesUpdated]', entitiesUpdated.map( e => e.id) );
        if( debug && entitiesRemoved.length ) console.log('[EntitySet][update]','[entitiesRemoved]', entitiesRemoved.map( e => e.id) );

        if( debug && componentsAdded.length ) console.log('[EntitySet][update]','[componentsAdded]', this.id, componentsAdded.map( e => e.id) );
        if( debug && componentsUpdated.length ) console.log('[EntitySet][update]','[componentsUpdated]', componentsUpdated.map( e => e.id) );
        if( debug && componentsRemoved.length ) console.log('[EntitySet][update]','[componentsRemoved]', componentsRemoved.map( e => e.id) );

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
            this._removeComponent( componentsRemoved[ii] );
            // console.log('[EntitySet][update]', 'component:remove', componentsRemoved );
        }
        
        for (ii = 0, len = entitiesAdded.length; ii < len; ii++) {
            let entity = entitiesAdded[ii];
            this._addEntity( entity );
            // console.log('[EntitySet][update]', 'entity:add', entity.id );
        }
        
        for (ii = 0, len = entitiesUpdated.length; ii < len; ii++) {
            let entity = entitiesUpdated[ii];
            this._addEntity( entity );
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
                    view.triggerEntityEvent.apply(view, [ name, entity, view, ...rest ]);
                }
            });
        }

        return this.trigger.apply(this, [ name, entity, this, ...rest ]);
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
            this._entityEvents = Object.assign({},Events);
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
     * NOTE: this functionality is removed in favour
     * of external means of filtering entitysets
     * 
     * Sets a query against this entityset.
     * All entities which are added to the ES are
     * passed through the query for validity
     */
    // setQuery(query, options = {}) {
    //     this._query = null;
    //     if (!query) {
    //         return;
    //     }
    //     if (query instanceof Query) {
    //         if (query.isEmpty()) {
    //             return;
    //         }
    //         this._query = new Query(query);
    //         return;
    //     }
    //     if ( typeof query === 'function' ) {
    //         this._query = new Query(query);
    //     }

    //     // check that entities are still allowed to belong to this set
    //     this.evaluateEntities();

    //     return this._query;
    // }

    // getQuery() {
    //     return this._query;
    // }

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
    },

    /**
    *   Removes the entities identified by the query
    */
    removeByQuery(query, options = {}) {
        options = { ...options, registry: this.getRegistry() };
        const result = Query.exec(query, this, options);
        return this.removeEntity(result);
    },

    // isEntityOfInterest(entity, options) {
    //     if (!this._query) {
    //         return true;
    //     }
    //     const tEntity = this._query.execute(entity);
    //     return tEntity ? true : false;
    // }

    /**
     * NOTE: this functionality is removed in favour of external
     * means of filtering entitysets
     * 
    *   Checks through all contained entities, ensuring that they
    *   are still valid members of this entitySet according to the
    *   query
    */
    // evaluateEntities(entityIdArray, options = {}) {
    //     let ii, len, entity;
    //     // let entities;
    //     let removed = [];

    //     if (!this._query) {
    //         return removed;
    //     }

    //     if (entityIdArray) {
    //         for (ii = 0, len = entityIdArray.length; ii < len; ii++) {
    //             entity = this.get(entityIdArray[ii]);
    //             if (entity && !this._query.execute(entity)) {
    //                 removed.push(entity);
    //             }
    //         }
    //     } else {
    //         // entities = this.entities || this;
    //         for (ii = this.length - 1; ii >= 0; ii--) {
    //             entity = this.at(ii);
    //             if (entity && !this._query.execute(entity)) {
    //                 removed.push(entity);
    //             }
    //         }
    //     }

    //     if (removed.length > 0) {
    //         return this.removeEntity(removed, options);
    //     }
    //     return removed;
    // }

})

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
