import { EntitySet } from './index';
import { AsyncCmdBuffer as CmdBuffer } from '../cmd_buffer/async';
import { ReusableId } from '../util/reusable_id';
import { setEntityIdFromId, getEntityIdFromId, getEntitySetIdFromId } from '../util/id';
import { toInteger } from '../util/to';
import { createLog } from '../util/log';
import { ComponentNotFoundError, EntityNotFoundError, ComponentDefNotFoundError } from '../error';
import { ComponentRegistry } from '../schema';
import { toString as entityToString } from '../util/to_string';

const Log = createLog('AsyncEntitySet');

/**
 * An In-memory Async (Promise-based) entityset
 *
 * Notes:
 *
 * the aim should be to resolve updates into a series of commands which precisely describes what should be
 * added/removed updated
 */
export function AsyncEntitySet(entities, options = {}, ...rest) {
    options.cmdBuffer = CmdBuffer;

    options.indexByEntityId = true;
    EntitySet.call(this, entities, options);
    // maps external and internal component def ids
    this._componentDefInternalToExternal = [];
    this._componentDefExternalToInternal = [];

    this.componentDefs = new ComponentRegistry();
    // this.componentDefs = new ComponentDefCollection();

    // in a persistent es, these ids would be initialised from a backing store
    this.entityId = new ReusableId(options.entityIdStart || 1);
    this.componentId = new ReusableId(options.componentIdStart || 1);
}

Object.assign(AsyncEntitySet.prototype, EntitySet.prototype, {
    /**
     * Opens the entity set so that it is ready to be used.
     * During the open process, any component defs registered with this entityset are
     * registered with the Registry
     */
    open(options = {}) {
        this._open = true;

        return this.getComponentDefs({ notifyRegistry: true }).then(() => {
            // Log.debug(`finished ${this.type} open`);
            return this;
        });
    },

    /**
     *
     */
    isOpen() {
        return this._open;
    },

    /**
     *
     */
    close() {
        this._open = false;
        return Promise.resolve(this);
    },

    /**
     *
     */
    destroy(options = {}) {
        return Promise.resolve(this);
    },

    // /**
    //  * Returns the entities that were added or updated in the last operation
    //  */
    // getUpdatedEntities(){
    //     return valueArray( this._cmdBuffer.entitiesAdded, this._cmdBuffer.entitiesUpdated);
    // },

    /**
     * Registers a component def with this entityset.
     */
    registerComponentDef(data, options = {}) {
        // if this hasn't been called from the registry, then we forward the request
        // on to the registry, which takes care of decomposing the incoming schemas
        // and then notifying each of the entitySets about the new component defs
        if (!options.fromRegistry) {
            if (options.debug) {
                Log.debug('registering with registry');
            }
            return this.getRegistry()
                .registerComponent(data, { fromES: this, ...options })
                .then(() => this);
        }

        return this.getComponentDefByHash(data.hash)
            .then(existing => {
                this.log('already have existing cdef for', data.hash, existing.esid);
                // this._cacheComponentDef( data, existing.esid );
                return existing;
            })
            .catch(err => {
                if (err instanceof ComponentDefNotFoundError) {
                    return this._registerComponentDef(data);
                }
                return Promise.reject(err);
            });
    },

    /**
     *
     */
    _registerComponentDef(cdef, options) {
        return new Promise((resolve, reject) => {
            // Log.debug('_registerComponentDef adding', cdef.getUri(), cdef.id, cdef.cid, cdef.hash(), options );
            // const clonedDef = cdef.clone();
            // TODO : should use a reusableId here
            this.componentDefs.register(cdef, { throwOnExists: false });
            // console.log('_registerComponentDef added', clonedDef.getUri(), clonedDef.id, clonedDef.cid, clonedDef.hash() );
            return resolve(this);
        });
    },

    /**
     *   Returns a component def by its id/uri
     */
    getComponentDef(cdefId, cached) {
        return new Promise((resolve, reject) => {
            const def = this.componentDefs.getComponentDef(cdefId);

            if (!def) {
                return reject(new ComponentDefNotFoundError(cdefId));
            }
            return resolve(def);
        });
    },

    /**
     *   Returns a registered component def by its hash
     */
    getComponentDefByHash(hash) {
        return new Promise((resolve, reject) => {
            const result = this.componentDefs.getComponentDef(hash);
            // const result = this.componentDefs.getByHash(hash);
            if (result) {
                return resolve(result);
            }
            return reject(new ComponentDefNotFoundError(hash));
        });
    },

    /**
     *   Reads component defs into local structures
     *   Returns a promise for an array of registered schemas
     */
    getComponentDefs(options = {}) {
        const componentDefs = this.componentDefs.getComponentDefs(); // this.componentDefs.models;

        if (!options.notifyRegistry) {
            return Promise.resolve(componentDefs);
        }

        // if this hasn't been called from the registry, then we forward the request
        // on to the registry, which takes care of decomposing the incoming schemas
        // and then notifying each of the entitySets about the new component defs
        return this.getRegistry()
            .registerComponent(componentDefs, { notifyRegistry: true, fromES: this })
            .then(() => componentDefs);
    },

    /**
     * Returns an entity
     * @param {*} entityId
     * @param {*} options
     */
    getEntity(entityId, options = {}) {
        // const throwsOnError = options.throwsOnError === undefined ? true : options.throwsOnError;
        if (options.componentBitFieldOnly) {
            return this.getEntityBitField(entityId, throwsOnError);
        }
        // console.log('[AsyncEntitySet][getEntity]', entityId, setEntityIdFromId(entityId, this.id), this._entities);

        return Promise.resolve( this._entities.get(setEntityIdFromId(entityId, this.id)) );
    },

    /**
     * Returns a bitfield for the specified entityid
     */
    getEntityBitField(entityId, throwsOnError = true) {
        let e = this.get(entityId);
        if (e) {
            return Promise.resolve(e.getComponentBitfield());
        }
        if (!throwsOnError) {
            return Promise.resolve(null);
        }
        return Promise.reject(new EntityNotFoundError(entityId));
    },

    /**
     * Returns an entity specified by its id
     */
    getEntityById(entityId, throwsOnError = true) {
        const esId = getEntitySetIdFromId(entityId);
        const eId = getEntityIdFromId(entityId);
        let e = this._entities.get(entityId);

        
        if (!e) {
            // attempt to retrieve the entity using a composite id
            e = this._entities.get(setEntityIdFromId(entityId, this.id));
        }

        // console.log('[AsyncEntitySet][getEntityById]', entityId, setEntityIdFromId(entityId, this.id), this._entities);
        if (e) {
            return Promise.resolve(e);
        }

        if (esId != this.id) {
            if (!throwsOnError) {
                return Promise.resolve(null);
            }
            return Promise.reject(
                new EntityNotFoundError(entityId, `entity ${eId} does not belong to this entityset (${esId})`)
            );
        }
        // console.log(`looking for eid ${eId} / ${esId}`);

        // this.each( m => console.log('entity model id', m.id) );

        let entity = this._entities.get(eId);

        if (entity) {
            return Promise.resolve(entity);
        }

        if (!throwsOnError) {
            return Promise.resolve(null);
        }

        return Promise.reject(new EntityNotFoundError(entityId));
    },

    /**
     * Returns a component by its entityid and def id
     */
    getComponentByEntityId(entityId, componentDefId) {
        const result = EntitySet.prototype.getComponentByEntityId.call(this,entityId, componentDefId);
        if (result) {
            return Promise.resolve(result);
        }
        return Promise.reject(new ComponentNotFoundError(entityId, componentDefId));
    },

    /**
     * Takes an (array) of entityIds and returns entity instances with
     * their component bitfields populated, but no components retrieved
     */
    getEntitySignatures(entityIds) {
        const registry = this.getRegistry();

        return new Promise((resolve, reject) => {
            const result = entityIds.map(eId => {
                eId = toInteger(eId);
                let entity = this._entities.get(eId);
                if (entity) {
                    // return a copy of the entity bf
                    return registry.createEntity(null, { id: eId, comBf: entity.getComponentBitfield() });
                }
                return registry.createEntity(null, { id: eId });
            });
            return resolve(result);
        });
    },

    /**
     *
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(
        entitiesAdded,
        entitiesUpdated,
        entitiesRemoved,
        componentsAdded,
        componentsUpdated,
        componentsRemoved,
        options = {}
    ) {
        let debug = options.debug;
        entitiesAdded = entitiesAdded.models;
        entitiesUpdated = entitiesUpdated.models;
        entitiesRemoved = entitiesRemoved.models;
        componentsAdded = componentsAdded.models;
        componentsUpdated = componentsUpdated.models;
        componentsRemoved = componentsRemoved.models;

        if (debug)
            console.log(
                '[AsyncEntitySet][update]', this.cid, '-',
                entitiesAdded.length,
                entitiesUpdated.length,
                entitiesRemoved.length,
                componentsAdded.length,
                componentsUpdated.length,
                componentsRemoved.length
            );

        if (debug && entitiesAdded.length)
            console.log('[AsyncEntitySet][update]', '[entitiesAdded]', entitiesAdded.map(e => e.id));
        if (debug && entitiesUpdated.length)
            console.log('[AsyncEntitySet][update]', '[entitiesUpdated]', entitiesUpdated.map(e => e.id));
        if (debug && entitiesRemoved.length)
            console.log('[AsyncEntitySet][update]', '[entitiesRemoved]', entitiesRemoved.map(e => e.id));

        if (debug && componentsAdded.length)
            console.log('[AsyncEntitySet][update]', '[componentsAdded]', this.id, componentsAdded.map(e => e.toJSON()));
        if (debug && componentsUpdated.length)
            console.log('[AsyncEntitySet][update]', '[componentsUpdated]', componentsUpdated.map(e => e.toJSON()));
        if (debug && componentsRemoved.length)
            console.log('[AsyncEntitySet][update]', '[componentsRemoved]', componentsRemoved.map(e => e.id));

        // const debug = options.debug;

        // extract entities added which need new ids
        entitiesAdded = entitiesAdded.reduce((result, e) => {
            // console.log('[async][update] we got,', this.id, this.getUuid(), e.getEntitySetId(), 'for', this.id );
            if (e.getEntitySetId() !== this.id) {
                result.push(e);
            } else {
                // console.log('ALERT! entitiesAdded contains already added entity', e.toJSON() );
            }
            return result;
        }, []);

        // console.log('new entities', entityToString(entitiesAdded));
        // console.log('[AsyncEntitySet][update]', entitiesUpdated );

        // retrieve ids for the new entities
        return (
            this.entityId
                .getMultiple(entitiesAdded.length)
                .then(newIds => {
                    // console.log('new entity ids', newIds);

                    // apply the new ids to the entities. this will
                    // also update the components entity ids
                    entitiesAdded.forEach((e, ii) => e.setEntityId(newIds[ii], this.getEntitySetId()));
                })
                // retrieve ids for the new components
                .then(() => this.componentId.getMultiple(componentsAdded.length))
                .then(componentIds => {
                    // console.log('new component ids', componentIds);
                    componentsAdded.forEach((com, ii) => com.set({ id: componentIds[ii] }));
                    // console.log('new components', entityToString(componentsAdded));
                })
                .then(() =>
                    this._applyUpdate(
                        entitiesAdded,
                        entitiesUpdated,
                        entitiesRemoved,
                        componentsAdded,
                        componentsUpdated,
                        componentsRemoved,
                        options
                    )
                )
        );
    },

    /**
     *
     */
    _applyUpdate(
        entitiesAdded,
        entitiesUpdated,
        entitiesRemoved,
        componentsAdded,
        componentsUpdated,
        componentsRemoved,
        options = {}
    ) {
        const debug = options.debug;
        let ii, len, component, entity;

        const addOptions = { silent: true };
        if (entitiesAdded && entitiesAdded.length > 0) {
            if (debug) {
                Log.debug('entitiesAdded', entitiesAdded.length, entityToString(entitiesAdded));
            }
            entitiesAdded.forEach(e => this._addEntity(e));
        }
        
        if (entitiesUpdated && entitiesUpdated.length > 0) {
            if (debug) {
                Log.debug('entitiesUpdated', entityToString(entitiesUpdated));
            }
            entitiesUpdated.forEach(e => this._addEntity(e));
        }
        
        if (entitiesRemoved && entitiesRemoved.length > 0) {
            entitiesRemoved.forEach(e => this._removeEntity(e));
        }

        for (ii = 0, len = componentsAdded.length; ii < len; ii++) {
            
            component = componentsAdded[ii];
            
            entity = this._entities.get(component.getEntityId());
            
            if (entity) {
                
                if (debug) console.log( '[AsyncEntitySet][_applyUpdate]🦊 A entity coms', entity.cid, entity.getComponentBitfield().toValues() );

                // entity.addComponent(component, { silent: true });
                
                // if (debug) console.log( '[AsyncEntitySet][_applyUpdate]🦊 B entity coms', entity.cid, entity.getComponentBitfield().toValues(), entity.components );
                this._addComponent(component);

                // if(debug) console.log('[AsyncEntitySet][_addComponent] existing', this._components.map(c=>[c.id,c.cid,c.getDefId()]));

                if (debug) console.log(`[AsyncEntitySet][_applyUpdate]🦊 added com ${component.cid} ${JSON.stringify(component)} ${component.getEntityId()}`);
            }
        }
        
        for (ii = 0, len = componentsUpdated.length; ii < len; ii++) {
            
            component = componentsUpdated[ii];

            entity = this._entities.get(component.getEntityId());
            
            if (debug) console.log(`[AsyncEntitySet][_applyUpdate]🦊 updated com ${component.cid} ${JSON.stringify(component)} ${component.getEntityId()}`);


            const existing = EntitySet.prototype.getComponentByEntityId.call(
                this,
                component.getEntityId(),
                component.getDefId()
            );

            // let existing = this.components.get( component );
            if (existing) {
                // if( debug ) console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
                existing.apply(component, { silent: true });
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
            } else {
                if( debug ) console.log(`!!!ES!!! adding new component ${component.cid} ${JSON.stringify(component)}`);
                this._addComponent(component);
            }
        }

        for (ii = 0, len = componentsRemoved.length; ii < len; ii++) {
            component = componentsRemoved[ii];
            entity = this._entities.get(component.getEntityId());
            if (entity) {
                entity.addComponent(component, { silent: true });
                this._removeComponent(component);
                // if(debug){console.log('UPDATE/ADD', componentsAdded[ii].getEntityId(), JSON.stringify(component) );}
            }
        }

        if (debug) console.log('[AsyncEntitySet][_applyUpdate]🦊 entitiesUpdated', entityToString(entitiesUpdated) );
        

        return Promise.resolve({
            entitiesAdded,
            entitiesUpdated,
            entitiesRemoved,
            componentsAdded,
            componentsUpdated,
            componentsRemoved
        });
    }
});

AsyncEntitySet.prototype.type = 'AsyncEntitySet';
AsyncEntitySet.prototype.isAsyncEntitySet = true;
AsyncEntitySet.prototype.isMemoryEntitySet = false;
AsyncEntitySet.prototype.isAsync = true;
AsyncEntitySet.prototype.cidPrefix = 'aes';

AsyncEntitySet.isAsyncEntitySet = function(obj) {
    return obj && obj.isAsyncEntitySet;
};
