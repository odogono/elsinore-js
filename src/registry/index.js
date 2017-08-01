import { Events, Collection } from 'odgn-backbone-model';

import arrayDifference from '../util/array/difference';
import arrayWithout from '../util/array/without';
import {isBoolean} from '../util/is';
import omit from '../util/omit';
import createUUID from '../util/uuid';

import Entity from '../entity';
import EntitySet from '../entity_set';
import Component from '../component';
import SchemaRegistry from '../schema';

// const Log = createLog('Registry');
export default class Registry {
    constructor(options = {}) {
        Object.assign(this, Events);

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
        this._entitySets = [];
        // a map of entityset uuids to entityset instances
        this._entitySetUUIDs = {};

        // a map of hashes to entity views
        this._entityViews = {};

        this.updateLastTime = Date.now();

        this.schemaRegistry = options.schemaRegistry || SchemaRegistry.create(null, { registry: this });

        this.schemaRegistry.on('all', (...args) => this.trigger.apply(this, args));
    }

    /**
    *
    */
    createId() {
        // https://github.com/dfcreative/get-uid
        // let counter = Date.now() % 1e9;
        // return (Math.random() * 1e9 >>> 0) + (counter++ + '__')
        return ++this.sequenceCount;
    }


    /**
    *   Creates a new entity
    */
    createEntity(components, options = {}) {
        options.registry = this;
        let attrs = {};
        let idSet = false;

        if (options['@e']) {
            attrs['@e'] = options['@e'];
            idSet = true;
        }
        if (options['@es']) {
            attrs['@es'] = options['@es'];
            idSet = true;
        }

        if (components) {
            components = this.createComponent(components);

            // check to see whether the entity id is set on the component.
            const first = Array.isArray(components) ? components[0] : components;
            const reportedEntityId = first.getEntityId();
            if (reportedEntityId !== void 0) {
                // attrs['@e'] = getEntityIdFromId(reportedEntityId);
                // attrs['@es'] = getEntitySetIdFromId(reportedEntityId);
                options.id = reportedEntityId;
                idSet = false;
            }
        } else if (options.comBf) {
            attrs.comBf = options.comBf;
            delete options.comBf;
        }

        if (options.id === void 0 && !idSet) {
            attrs.id = this.createId();
        } else {
            attrs.id = options.id;
        }

        let result = new this.Entity(attrs, options);

        if (components) {
            result.addComponent(components);
        }

        return result;
    }

    /**
     * 
     */
    createEntityWithId(entityId = 0, entitySetId = 0, options = {}) {
        options.registry = this;
        let attrs = { '@e': entityId, '@es': entitySetId };
        if (options.comBf) {
            attrs.comBf = options.comBf;
            delete options.comBf;
        }
        if (options.id) {
            attrs = { id: options.id };
        }
        return new this.Entity(attrs, options);
    }

    /**
     * Registers a new Component Def from data
     *
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent(data, options = {}) {
        if (options.notifyRegistry) {
            options.throwOnExists = false;
        }

        return Promise.resolve(this.schemaRegistry.register(data, options)).then(componentDefs => {
            if (!Array.isArray(componentDefs)) {
                componentDefs = [ componentDefs ];
            }

            return this._entitySets
                .reduce(
                    (current, es) => {
                        return current = current.then(() => {
                            // log.debug('registering componentDefs with es ' + es.cid);
                            return this._registerComponentDefsWithEntitySet(es, componentDefs, options);
                        });
                    },
                    Promise.resolve()
                )
                .then(() => componentDefs);
        });
    }

    /**
     * Returns an array of all the Component Defs that have been registered
     */
    getComponentDefs() {
        return this.schemaRegistry.getComponentDefs();
    }

    getComponentDef(ident) {
        return this.schemaRegistry.getComponentDef(ident);
    }

    /**
    *   Registers the array of component def schemas with the given entitySet
    */
    _registerComponentDefsWithEntitySet(entitySet, componentDefs, options = {}) {
        options = { ...options, fromRegistry: true, fromES: false };

        // memory based entitysets do not need to register component defs,
        // as they are tied directly to the registry/schemaRegistry
        if (entitySet.isMemoryEntitySet) {
            return Promise.resolve();
        }
        return componentDefs.reduce(
            (current, cdef) => {
                return current = current.then(() => {
                    return entitySet.registerComponentDef(cdef, options);
                });
            },
            Promise.resolve(),
        );
    }

    /**
    * TODO: name this something better, like 'getComponentIID'
    */
    getIId(componentIDs, options) {
        if (options && isBoolean(options)) {
            options = { forceArray: true };
        }
        return this.schemaRegistry.getIId(componentIDs, options);
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
    createComponent(componentDef, attrs, options, cb) {
        let entityId, defKey;

        options || (options = {});
        defKey = options.defKey || '@c';

        entityId = options.entity || options.entityId || options.eid;

        if (Entity.isEntity(attrs)) {
            entityId = Entity.toEntityId(attrs);
            attrs = {};
        }

        if (entityId) {
            attrs['@e'] = entityId;
        }

        // Obtain a component schema
        if (Array.isArray(componentDef)) {
            // recurse each entry
            return Array.prototype.concat.apply([], componentDef.map(s => this.createComponent(s, attrs, options)));
        } else if (Component.isComponent(componentDef)) {
            // maybe clone instead of just returning?
            return componentDef;
        } else {
            if (componentDef[defKey]) {
                // attrs are pulled out of the 1st arg
                attrs = Object.assign({}, omit(componentDef, defKey), attrs);
                componentDef = componentDef[defKey];
            }
            return this.schemaRegistry.createComponent(componentDef, attrs, options, cb);
        }
    }

    destroyComponent(component, options) {}

    /**
     * Converts an entity id to an entity instance
     * 
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    toEntity(entityId) {
        let result = Entity.toEntity(entityId);
        if (result) {
            result.registry = this;
        }
        return result;
    }

    /**
     * Creates a new EntitySet instance.
     * @param  {[type]}   components [description]
     * @param  {[type]}   options    [description]
     * @param  {Function} callback   [description]
     * @return {[type]}              [description]
     */
    createEntitySet(options = {}) {
        let id;
        let result;
        let entitySetType = EntitySet;

        options.uuid = options.uuid || createUUID();
        if (options.type) {
            entitySetType = options.type;
        }
        if (options.instanceClass) {
            entitySetType = options.instanceClass;
        }

        // create a 20 bit 
        id = options['@es'] || options['id'] || this.createId();
        result = new entitySetType(null, { ...options, id });
        result.setRegistry(this);

        
        // TODO : there has to be a better way of identifying entitysets
        if (result.isMemoryEntitySet) {
            // NOTE: setting the id to 0 means that entity ids would be shifted up
            result.id = 0;

            let eIds = options['@e'];
            if (Array.isArray(eIds)) {
                let components = eIds.map(com => this.createComponent(com));
                result.addComponent(components);
            }

            if (options.register === false) {
                return result;
            }
        }

        return this.addEntitySet(result, options);
    }

    removeAllEntitySets(options) {
        return Promise.all(this._entitySets.map(es => this.removeEntitySet(es, options)));
    }

    /**
    *   Returns a Promise to removes an entitySet from the registry
    *   
    */
    removeEntitySet(entitySet, options = {}) {
        if (!entitySet) {
            return null;
        }
        if (options.sync || !entitySet.isAsync) {
            entitySet.setRegistry(null);
            this._entitySets = arrayWithout(this._entitySets, entitySet);
            delete this._entitySetUUIDs[entitySet.getUUID()];
            return entitySet;
        }

        return entitySet.close(options).then(() => this.removeEntitySet(entitySet, { sync: true }));
    }

    /**
    *   
    */
    addEntitySet(entitySet, options = {}) {
        if (!entitySet) {
            return null;
        }

        entitySet.setRegistry(this);

        if (options.sync || !entitySet.isAsync) {
            // do we already have this entitySet
            if ( this._entitySets.indexOf(entitySet) !== -1) {
                return null;
            }

            if (this._entitySetUUIDs[entitySet.getUUID()]) {
                throw new Error(`entityset with uuid ${entitySet.getUUID()} already exists`);
            }

            // store the entityset against its id
            this._entitySets.push(entitySet);
            this._entitySetUUIDs[entitySet.getUUID()] = entitySet;

            entitySet.setRegistry(this);

            this.trigger('entityset:add', entitySet);

            return entitySet;
        }

        // Log.debug('opening', entitySet.type,entitySet.getUUID());
        return entitySet.open(options).then(() => {
            const schemas = this.getComponentDefs();
            return this._registerComponentDefsWithEntitySet(entitySet, schemas, options).then(() => {
                // perform the normal sync adding
                this.addEntitySet(entitySet, { sync: true });

                return entitySet;
            });
        });
    }

    /**
    *
    */
    getEntitySet(uuid) {
        let es;
        if (es = this._entitySetUUIDs[uuid]) {
            return es;
        }
        return null;
    }

    /**
    *
    */
    destroyEntitySet(entitySet) {
        if (!entitySet) {
            return null;
        }

        entitySet.setRegistry(null);
        this._entitySets = _.without(this._entitySets, entitySet);
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
        const args = [ name, entity, ...rest ];

        for (ii = 0, len = this._entitySets.length; ii < len; ii++) {
            entitySet = this._entitySets[ii];

            entitySet.triggerEntityEvent.apply(entitySet, args);
        }
    }
}

Registry.prototype.type = 'Registry';
Registry.prototype.isRegistry = true;

class ProcessorCollection extends Collection {}

function createProcessorCollection() {
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
Registry.create = function create(options = {}) {
    let result = new Registry(options);
    return result;
};