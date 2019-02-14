import { EntitySet, EntitySetOptions } from './index';
import { AsyncCmdBuffer as CmdBuffer } from '../cmd_buffer/async';
import { ReusableID } from '../util/reusable_id';
import { Component } from '../component';
import { Collection } from '../util/collection';
import { Entity, cloneEntity } from '../entity';
import {
    setEntityIDFromID,
    getEntityIDFromID,
    getEntitySetIDFromID
} from '../util/id';
import { toInteger } from '../util/to';
import { createLog } from '../util/log';
import { propertyResult } from '../util/result';
import {
    ComponentNotFoundError,
    EntityNotFoundError,
    ComponentDefNotFoundError
} from '../error';
import { ComponentRegistry } from '../schema';
import { toString as entityToString } from '../util/to_string';

import {
    ENTITY_ID,
    ENTITY_SET_ID,
    EntityID,
    ComponentDefID,
    State
} from '../types';
import { BitField } from 'odgn-bitfield';
import { Registry } from 'src/registry';

const Log = createLog('AsyncEntitySet');

interface AsyncEntitySetOptions extends EntitySetOptions {
    entityIDStart?: number;
    componentIDStart?: number;
}

function processOptions(options: AsyncEntitySetOptions = {}): EntitySetOptions {
    options.cmdBuffer = CmdBuffer;
    options.indexByEntityID = true;
    return options;
}

// AsyncEntitySet.prototype.type = 'AsyncEntitySet';
// AsyncEntitySet.prototype.isAsyncEntitySet = true;
// AsyncEntitySet.prototype.isMemoryEntitySet = false;
// AsyncEntitySet.prototype.isAsync = true;
// AsyncEntitySet.prototype.cidPrefix = 'aes';

// AsyncEntitySet.isAsyncEntitySet = function(obj) {
//     return obj && obj.isAsyncEntitySet;
// };

/**
 * An In-memory Async (Promise-based) entityset
 *
 * Notes:
 *
 * the aim should be to resolve updates into a series of commands which precisely describes what should be
 * added/removed updated
 */
export class AsyncEntitySet extends EntitySet {
    readonly type: string = 'AsyncEntitySet';
    readonly isAsyncEntitySet: boolean = true;
    readonly isMemoryEntitySet: boolean = false;
    readonly isAsync: boolean = true;

    _status: State = State.Closed;

    // maps external and internal component def ids
    _componentDefInternalToExternal = [];
    _componentDefExternalToInternal = [];

    componentDefs: ComponentRegistry = new ComponentRegistry();

    entityID: ReusableID;
    componentID: ReusableID;

    constructor(entities, options: AsyncEntitySetOptions = {}, ...rest) {
        super(entities, processOptions(options));

        // in a persistent es, these ids would be initialised from a backing store
        this.entityID = new ReusableID(options.entityIDStart || 1);
        this.componentID = new ReusableID(options.componentIDStart || 1);
    }

    getCIDPrefix(): string {
        return 'aes';
    }

    /**
     * Opens the entity set so that it is ready to be used.
     * During the open process, any component defs registered with this entityset are
     * registered with the Registry
     */
    open(options = {}) : Promise<EntitySet> {
        const registry = this.getRegistry();
        this._status = State.Opening;

        // get existing defs and give them to the registry
        return this.getComponentDefs()
            .then(defs =>
                registry.registerComponent(defs, {
                    notifyRegistry: true,
                    fromES: this
                })
            )
            .then(() => {
                this._status = State.Open;
                return this;
            });
    }

    /**
     *
     */
    isOpen() : boolean {
        return this._status === State.Open;
    }

    /**
     *
     */
    close() : Promise<EntitySet> {
        this._status = State.Closed;
        return Promise.resolve(this);
    }

    /**
     * Removes all data associated with this entityset
     *
     * @param {*} options
     */
    destroy(options = {}) : Promise<EntitySet> {
        return Promise.resolve(this);
    }

    /**
     * Registers a component def with this entityset.
     */
    registerComponentDef(
        data,
        options: { fromRegistry?: boolean; debug?: boolean } = {}
    ) {
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

        const hash = propertyResult(data, 'hash');

        return this.getComponentDefByHash(hash)
            .then(existing => {
                // this.log('already have existing cdef for', hash, existing.esid);
                // this._cacheComponentDef( data, existing.esid );
                return existing;
            })
            .catch(err => {
                if (err instanceof ComponentDefNotFoundError) {
                    return this._registerComponentDef(data);
                }
                return Promise.reject(err);
            });
    }

    /**
     *
     */
    _registerComponentDef(cdef) {
        return new Promise((resolve, reject) => {
            // Log.debug('_registerComponentDef adding', cdef.getUri(), cdef.id, cdef.cid, cdef.hash(), options );
            // const clonedDef = cdef.clone();
            // TODO : should use a reusableID here
            this.componentDefs.register(cdef, { throwOnExists: false });
            // console.log('_registerComponentDef added', clonedDef.getUri(), clonedDef.id, clonedDef.cid, clonedDef.hash() );
            return resolve(this);
        });
    }

    /**
     *   Returns a component def by its id/uri
     */
    getComponentDef(cdefID, isCached = true) {
        return new Promise((resolve, reject) => {
            const def = this.componentDefs.getComponentDef(cdefID);

            if (!def) {
                return reject(new ComponentDefNotFoundError(cdefID));
            }
            return resolve(def);
        });
    }

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
    }

    /**
     *   Reads component defs into local structures
     *   Returns a promise for an array of registered schemas
     */
    getComponentDefs(options = {}) {
        return Promise.resolve(this.componentDefs.getComponentDefs());
    }

    /**
     * Returns an entity
     * @param {*} entityID
     * @param {*} options
     */
    getEntityAsync(
        entityID,
        options: {
            componentBitFieldOnly?: boolean;
            throwsOnError?: boolean;
        } = {}
    ) {
        // const throwsOnError = options.throwsOnError === undefined ? true : options.throwsOnError;
        if (options.componentBitFieldOnly) {
            return this.getEntityBitField(entityID);
        }

        // console.log('[AsyncEntitySet][getEntity]', entityID, setEntityIDFromID(entityID, this.id), this._entities);

        return Promise.resolve(
            this._entities.get(setEntityIDFromID(entityID, this.id))
        );
    }

    /**
     * Returns a bitfield for the specified entityid
     */
    getEntityBitField(entityID, throwsOnError = true): Promise<BitField> {
        let e = this._entities.get(entityID);

        if (e) {
            return Promise.resolve(e.getComponentBitfield());
        }
        if (!throwsOnError) {
            return Promise.resolve(null);
        }
        return Promise.reject(new EntityNotFoundError(entityID));
    }

    /**
     * Returns an entity specified by its id
     */
    getEntityByID(entityID, throwsOnError = true) {
        const esID = getEntitySetIDFromID(entityID);
        const eID = getEntityIDFromID(entityID);
        let e = this._entities.get(entityID);

        if (!e) {
            // attempt to retrieve the entity using a composite id
            e = this._entities.get(setEntityIDFromID(entityID, this.id));
        }

        // console.log('[AsyncEntitySet][getEntityByID]', entityID, setEntityIDFromID(entityID, this.id), this._entities);
        if (e) {
            return Promise.resolve(e);
        }

        if (esID != this.id) {
            if (!throwsOnError) {
                return Promise.resolve(null);
            }
            return Promise.reject(
                new EntityNotFoundError(
                    entityID,
                    `entity ${eID} does not belong to this entityset (${esID})`
                )
            );
        }
        // console.log(`looking for eid ${eID} / ${esID}`);

        // this.each( m => console.log('entity model id', m.id) );

        let entity = this._entities.get(eID);

        if (entity) {
            return Promise.resolve(entity);
        }

        if (!throwsOnError) {
            return Promise.resolve(null);
        }

        return Promise.reject(new EntityNotFoundError(entityID));
    }

    /**
     * Returns a component by its entityid and def id
     */
    getComponentByEntityIDAsync(
        entityID: EntityID,
        componentDefID: ComponentDefID
    ): Promise<Component> {
        const result = EntitySet.prototype.getComponentByEntityID.call(
            this,
            entityID,
            componentDefID
        );
        if (result) {
            return Promise.resolve(result);
        }
        return Promise.reject(
            new ComponentNotFoundError(entityID, componentDefID)
        );
    }

    /**
     * Takes an (array) of entityIDs and returns entity instances with
     * their component bitfields populated, but no components retrieved
     */
    getEntitySignatures(entityIDs) {
        const registry = this.getRegistry();

        return new Promise((resolve, reject) => {
            const result = entityIDs.map(eID => {
                eID = toInteger(eID);
                let entity = this._entities.get(eID);
                if (entity) {
                    // return a copy of the entity bf
                    return registry.createEntity(null, {
                        id: eID,
                        comBf: entity.getComponentBitfield()
                    });
                }
                return registry.createEntity(null, { id: eID });
            });
            return resolve(result);
        });
    }

    /**
     *
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(
        entitiesAdded: Collection<Entity>,
        entitiesUpdated: Collection<Entity>,
        entitiesRemoved: Collection<Entity>,
        componentsAdded: Collection<Component>,
        componentsUpdated: Collection<Component>,
        componentsRemoved: Collection<Component>,
        options: { debug?: boolean } = {}
    ) {
        let debug = options.debug;

        if (debug)
            console.log(
                '[AsyncEntitySet][update]',
                this.cid,
                '-',
                entitiesAdded.models.length,
                entitiesUpdated.models.length,
                entitiesRemoved.models.length,
                componentsAdded.models.length,
                componentsUpdated.models.length,
                componentsRemoved.models.length
            );

        if (debug && entitiesAdded.models.length)
            console.log(
                '[AsyncEntitySet][update]',
                '[entitiesAdded]',
                entitiesAdded.map(e => e.id)
            );
        if (debug && entitiesUpdated.models.length)
            console.log(
                '[AsyncEntitySet][update]',
                '[entitiesUpdated]',
                entitiesUpdated.map(e => e.id)
            );
        if (debug && entitiesRemoved.models.length)
            console.log(
                '[AsyncEntitySet][update]',
                '[entitiesRemoved]',
                entitiesRemoved.map(e => e.id)
            );

        if (debug && componentsAdded.models.length)
            console.log(
                '[AsyncEntitySet][update]',
                '[componentsAdded]',
                this.id,
                componentsAdded.map(e => e.toJSON())
            );
        if (debug && componentsUpdated.models.length)
            console.log(
                '[AsyncEntitySet][update]',
                '[componentsUpdated]',
                componentsUpdated.map(e => e.toJSON())
            );
        if (debug && componentsRemoved.models.length)
            console.log(
                '[AsyncEntitySet][update]',
                '[componentsRemoved]',
                componentsRemoved.map(e => e.id)
            );

        // const debug = options.debug;

        // extract entities added which need new ids
        let unknownEntities = entitiesAdded.models.reduce(
            (result, e) => {
                // console.log('[async][update] we got,', this.id, this.getUuid(), e.getEntitySetID(), 'for', this.id );
                if (e.getEntitySetID() !== this.id) {
                    result.push(e);
                } else {
                    // console.log('ALERT! entitiesAdded contains already added entity', e.toJSON() );
                }
                return result;
            },
            <Entity[]>[]
        );

        // console.log('new entities', entityToString(entitiesAdded));
        // console.log('[AsyncEntitySet][update]', entitiesUpdated );

        // retrieve ids for the new entities
        return (
            this.entityID
                .getMultiple(unknownEntities.length)
                .then(newIDs => {
                    // console.log('new entity ids', newIDs);

                    // apply the new ids to the entities. this will
                    // also update the components entity ids
                    unknownEntities.forEach((e, ii) =>
                        e.clone({
                            [ENTITY_ID]: newIDs[ii],
                            [ENTITY_SET_ID]: this.getEntitySetID()
                        })
                    );
                })
                // retrieve ids for the new components
                .then(() =>
                    this.componentID.getMultiple(componentsAdded.models.length)
                )
                .then(componentIDs => {
                    // console.log('new component ids', componentIDs);
                    componentsAdded.forEach((com, ii) =>
                        com.set({ id: componentIDs[ii] })
                    );
                    // console.log('new components', entityToString(componentsAdded));
                })
                .then(() =>
                    this._applyUpdate(
                        unknownEntities,
                        entitiesUpdated.models,
                        entitiesRemoved.models,
                        componentsAdded.models,
                        componentsUpdated.models,
                        componentsRemoved.models,
                        options
                    )
                )
        );
    }

    /**
     *
     */
    _applyUpdate(
        entitiesAdded:Array<Entity>,
        entitiesUpdated:Array<Entity>,
        entitiesRemoved:Array<Entity>,
        componentsAdded:Array<Component>,
        componentsUpdated:Array<Component>,
        componentsRemoved:Array<Component>,
        options: { debug?: boolean } = {}
    ) {
        const debug = options.debug;
        let ii:number, len:number, component:Component, entity:Entity;

        const addOptions = { silent: true };
        if (entitiesAdded && entitiesAdded.length > 0) {
            if (debug) {
                Log.debug(
                    'entitiesAdded',
                    entitiesAdded.length,
                    entityToString(entitiesAdded)
                );
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

            entity = this._entities.get(component.getEntityID());

            if (entity) {
                if (debug)
                    console.log(
                        '[AsyncEntitySet][_applyUpdate]🦊 A entity coms',
                        entity.cid,
                        entity.getComponentBitfield().toValues()
                    );

                // entity.addComponent(component, { silent: true });

                // if (debug) console.log( '[AsyncEntitySet][_applyUpdate]🦊 B entity coms', entity.cid, entity.getComponentBitfield().toValues(), entity.components );
                this._addComponent(component);

                // if(debug) console.log('[AsyncEntitySet][_addComponent] existing', this._components.map(c=>[c.id,c.cid,c.getDefID()]));

                if (debug)
                    console.log(
                        `[AsyncEntitySet][_applyUpdate]🦊 added com ${
                            component.cid
                        } ${JSON.stringify(
                            component
                        )} ${component.getEntityID()}`
                    );
            }
        }

        for (ii = 0, len = componentsUpdated.length; ii < len; ii++) {
            component = componentsUpdated[ii];

            entity = this._entities.get(component.getEntityID());

            if (debug)
                console.log(
                    `[AsyncEntitySet][_applyUpdate]🦊 updated com ${
                        component.cid
                    } ${JSON.stringify(component)} ${component.getEntityID()}`
                );

            const existing = EntitySet.prototype.getComponentByEntityID.call(
                this,
                component.getEntityID(),
                component.getDefID()
            );

            // let existing = this.components.get( component );
            if (existing) {
                // if( debug ) console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityID()}`);
                existing.apply(component, { silent: true });
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityID()}`);
            } else {
                if (debug)
                    console.log(
                        `!!!ES!!! adding new component ${
                            component.cid
                        } ${JSON.stringify(component)}`
                    );
                this._addComponent(component);
            }
        }

        for (ii = 0, len = componentsRemoved.length; ii < len; ii++) {
            component = componentsRemoved[ii];
            entity = this._entities.get(component.getEntityID());
            if (entity) {
                entity.addComponent(component, { silent: true });
                this._removeComponent(component);
                // if(debug){console.log('UPDATE/ADD', componentsAdded[ii].getEntityID(), JSON.stringify(component) );}
            }
        }

        if (debug)
            console.log(
                '[AsyncEntitySet][_applyUpdate]🦊 entitiesUpdated',
                entityToString(entitiesUpdated)
            );

        return Promise.resolve({
            entitiesAdded,
            entitiesUpdated,
            entitiesRemoved,
            componentsAdded,
            componentsUpdated,
            componentsRemoved
        });
    }
}
