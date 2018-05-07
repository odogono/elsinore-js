'use strict';

import { Entity } from '../entity';
import { Collection } from '../util/collection';
import { InvalidEntityError } from '../error';

import { getEntitySetIdFromId } from '../util/id';
import { isEntity } from '../util/is';
import { valueArray } from '../util/array/value';

import { SyncCmdBuffer} from './sync';

import { CMD_ENTITY_ADD, CMD_COMPONENT_ADD, CMD_COMPONENT_REMOVE } from '../constants';

// import {createLog} from '../util/log';
// const Log = createLog('CmdBufferSync');

export function AsyncCmdBuffer() {
    SyncCmdBuffer.call(this);
    // these collections are keyed by cid, since entities and components do not
    // have an id assigned until they hit the entityset
    this.entitiesAdded = new Collection(null, { idAttribute: 'cid' });
    this.entitiesUpdated = new Collection(null, { idAttribute: 'cid' });
    this.entitiesRemoved = new Collection(null, { idAttribute: 'cid' });
    this.componentsAdded = new Collection(null, { idAttribute: 'cid' });
    this.componentsUpdated = new Collection(null, { idAttribute: 'cid' });
    this.componentsRemoved = new Collection(null, { idAttribute: 'cid' });
}

Object.assign(AsyncCmdBuffer.prototype, SyncCmdBuffer.prototype, {
    /**
     * Adds a component to this set
     */
    addComponent(entitySet, component, options = {}) {
        let execute;

        // silent = options.silent;
        // entity = options.entity;
        // listenTo = options.listen;
        execute = options.execute === undefined ? true : options.execute;

        if (!component) {
            return [];
        }

        // handle an array of components
        if (Array.isArray(component)) {
            if (options.batch === undefined) {
                options.batch = true;
                options.execute = false;
                if (execute !== false) {
                    execute = true;
                }
            }

            return Promise.all(component.map(c => this.addComponent(entitySet, c, options))).then(() => {
                if (!execute) {
                    return this;
                }

                // console.log('[AsyncCmdBuffer][addComponent]','isArray');

                return this.execute(entitySet, options).then(() => {
                    // console.log('[addComponent]', 'outcome', execute, this.componentsAdded, this.componentsUpdated );
                    return valueArray(this.componentsAdded, this.componentsUpdated);
                });
            });
        } else {
            if (execute) {
                this.reset();
            }
        }

        // log.debug('consider component ' + JSON.stringify(component) );

        // determine whether we have this component registered already
        // entityId = component.getEntityId();

        this.addCommand(CMD_COMPONENT_ADD, component.getEntityId(), component);

        // execute any outstanding commands

        if (execute) {
            return this.execute(entitySet, options).then(() => {
                return valueArray(this.componentsAdded, this.componentsUpdated);
            });
        }
        return [];
    },

    /**
     *
     */
    removeComponent(entitySet, component, options = {}) {
        let execute, entityId;
        execute = options.execute === undefined ? true : options.execute;

        if (!component) {
            return this;
        }

        // handle an array of components
        if (Array.isArray(component)) {
            if (options.batch === void 0) {
                options.batch = true;
                options.execute = false;
                if (execute !== false) {
                    execute = true;
                }
            }

            this.reset();

            return Promise.all(component.map(c => this.removeComponent(entitySet, c, options))).then(() => {
                if (execute) {
                    return this.execute(entitySet, options);
                }
                return this;
            });
        } else {
            if (execute) {
                this.reset();
            }
        }

        entityId = component.getEntityId();

        if (!entityId || getEntitySetIdFromId(entityId) !== entitySet.id) {
            // log.debug(
            //     'entity ' +
            //         entityId +
            //         ' does not exist in es ' +
            //         entitySet.id +
            //         ' (' +
            //         getEntitySetIdFromId(entityId) +
            //         ')'
            // );
            return Promise.resolve([]);
        }

        this.addCommand(CMD_COMPONENT_REMOVE, entityId, component);

        return !execute ? this : this.execute(entitySet, options).then(() => valueArray(this.componentsRemoved));
    },

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity(entitySet, entity, options = {}) {
        let execute;
        let addOptions = { batch: true, execute: false };

        execute = options.execute === void 0 ? true : options.execute;

        if (Array.isArray(entity)) {
            if (options.batch === void 0) {
                options.batch = true;
                options.execute = false;
                if (execute !== false) {
                    execute = true;
                }
            }

            if (execute !== false) {
                this.reset();
            }

            return entity
                .reduce(
                    (current, ine) => current.then(() => this.addEntity(entitySet, ine, options)),
                    Promise.resolve()
                )
                .then(() => {
                    if (!execute) {
                        return this;
                    }
                    return this.execute(entitySet, options).then(() => valueArray(this.entitiesAdded));
                });
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (!isEntity(entity)) {
            throw new InvalidEntityError('entity instance not passed');
        }

        return this.addComponent(entitySet, entity.getComponents(), { ...options, ...addOptions }).then(() => {
            if (!execute) {
                return this;
            }

            // execute any outstanding commands
            return this.execute(entitySet, options).then(() => {
                return valueArray(this.entitiesAdded, this.entitiesUpdated);
            });
        });
    },

    /**
     * Executes any outstanding add/remove commands
     */
    flush(entitySet, options = {}) {
        return this.execute(entitySet, options).then(() => {
            this.reset();
            return this;
        });
    },

    /**
     *
     */
    removeEntity(entitySet, entity, options = {}) {
        let execute;
        let removeOptions = { batch: true, execute: false };

        if (!entity) {
            return this;
        }

        execute = options.execute === void 0 ? true : options.execute;
        // executeOptions = {...options, removeEmptyEntity:true};

        // if we are dealing with an array of entities, ensure they all get executed in
        // a single batch
        if (Array.isArray(entity)) {
            if (options.batch === void 0) {
                options.batch = true;
                options.execute = false;
                if (execute !== false) {
                    execute = true;
                }
            }

            if (execute !== false) {
                this.reset();
            }

            return entity
                .reduce((current, ine) => {
                    return current.then(() => self.removeEntity(entitySet, ine));
                }, Promise.resolve())
                .then(() => {
                    if (execute) {
                        return this.execute(entitySet, options);
                    }
                    return this;
                });
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (!isEntity(entity)) {
            throw new InvalidEntityError('entity instance not passed');
        }

        return this.removeComponent(entitySet, entity.getComponents(), { ...options, ...removeOptions }).then(() => {
            // execute any outstanding commands
            if (execute) {
                return this.execute(entitySet, options).then(() => valueArray(this.entitiesRemoved));
            }
            return this;
        });
    },

    /**
     *
     */
    _executeEntityCommand(entity, componentBitfield, cmdType, component, options = {}) {
        // if( !component.getDefId ){
        //     Log.debug('[_executeEntityCommand]', component );
        // }
        const componentDefId = component.getDefId();
        const entityHasComponent = !!componentBitfield.get(componentDefId);

        switch (cmdType) {
            case CMD_ENTITY_ADD:
                this.entitiesAdded.add(entity);
                // console.log('add entity', entity.id );
                // if( true ){
                //     console.log('cmd: adding entity ' +
                //         entity.getEntityId() + '/' + entity.cid + '/' + entity.getEntitySetId() );
                // }
                break;
            case CMD_COMPONENT_ADD:
                // console.log('add component', component.id, component.cid, componentDefId,'to', entity.id, component.toJSON() );

                if (entityHasComponent) {
                    this.componentsUpdated.add(component);

                    this.entitiesUpdated.add(entity);
                } else {
                    entity.addComponent(component);

                    if (!this.entitiesAdded.has(entity)) {
                        // if (!this.entitiesAdded.get(entity)) {
                        this.entitiesUpdated.add(entity);
                        // console.log('entity', entity.id, 'was not added, updating');
                    }
                    this.componentsAdded.add(component);
                }
                break;

            case CMD_COMPONENT_REMOVE:
                // console.log('component remove', componentDefId,'from', entity.getEntityId(), entityHasComponent);
                if (!entityHasComponent) {
                    break;
                }

                this.componentsRemoved.add(component);

                // update the bitfield to remove the component
                componentBitfield.set(componentDefId, false);

                // if the bitfield is now empty, then we can remove the entity
                if (componentBitfield.count() <= 0) {
                    this.entitiesRemoved.add(entity);
                    // const eIndex = this.entitiesUpdated.indexOf(entity);
                    // if( eIndex !== -1 ){
                    //     this.entitiesUpdated.slice(eIndex,1);
                    // }
                    this.entitiesUpdated.remove(entity);
                    // this.entitiesUpdated.remove(entity, { silent: true });
                    // console.log('add component to remove', JSON.stringify(component));
                } else {
                    this.entitiesUpdated.add(entity);
                }

                break;
            default:
                break;
        }
    },

    /**
     *
     * execute resolves a list of cmds into more concrete instructions
     *
     */
    execute(entitySet, options) {
        let ii, len;

        let silent = options.silent === void 0 ? false : options.silent;

        // convert the incoming entity ids into entity instances which
        // have their bitfields resolved from the database, so that we
        // can easily test for component membership
        return entitySet.getEntitySignatures(Object.keys(this.cmds)).then(entities => {
            entities.forEach(entity => {
                const bf = entity.getComponentBitfield();
                let cmds = this.cmds[entity.id];
                // console.log( '[execute] entity coms', entity.cid, bf.toValues(), entity.components );

                if (entity.id === 0) {
                    this.entitiesAdded.add(entity);
                } else if (entity.getEntitySetId() != entitySet.id) {
                    this.entitiesAdded.add(entity);
                    // if(true){console.log('entity', entity.id,'does not exist in es', entitySet.id);}
                } else {
                    // if(debug){console.log('entity', entity.id,'exists in es', entitySet.id);}
                }

                for (ii = 0, len = cmds.length; ii < len; ii++) {
                    let cmd = cmds[ii];
                    let commandType = cmd[0];
                    let entityId = cmd[1];
                    let component = cmd[2];
                    let cmdOptions = cmd[3];

                    this._executeEntityCommand(entity, bf, commandType, component, cmdOptions, options);
                }
            });

            if (options.debug) {
                console.log('[components][added]', this.componentsAdded.map(c => c.toJSON()));
            }

            // console.log('[AsyncCmdBuffer][execute]', this.entitiesUpdated );

            return entitySet
                .update(
                    this.entitiesAdded,
                    this.entitiesUpdated,
                    this.entitiesRemoved,
                    this.componentsAdded,
                    this.componentsUpdated,
                    this.componentsRemoved,
                    options
                )
                .then(updateResult => {
                    if (updateResult.entitiesAdded) {
                        // this.entitiesAdded.set(updateResult.entitiesAdded);
                    }
                    if (updateResult.entitiesUpdated) {
                        // this.entitiesUpdated.set(updateResult.entitiesUpdated);
                    }
                    if (updateResult.entitiesRemoved) {
                        // this.entitiesRemoved.set(updateResult.entitiesRemoved);
                    }
                    if (updateResult.componentsAdded) {
                        // this.componentsAdded.set(updateResult.componentsAdded);
                    }
                    if (updateResult.componentsUpdated) {
                        // this.componentsUpdated.set(updateResult.componentsUpdated);
                    }
                    if (updateResult.componentsRemoved) {
                        // this.componentsRemoved.set(updateResult.componentsRemoved);
                    }
                    if (updateResult && updateResult.silent !== void 0) {
                        silent = updateResult.silent;
                    }

                    if (!silent) {
                        this.triggerEvents(entitySet, options);
                    }
                    return this;
                });
        });
    }
});

AsyncCmdBuffer.prototype.type = 'AsyncCmdBuffer';
AsyncCmdBuffer.prototype.isAsyncCmdBuffer = true;

AsyncCmdBuffer.create = function() {
    let result = new AsyncCmdBuffer();
    return result;
};
