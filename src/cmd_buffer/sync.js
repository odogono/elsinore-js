import { Component } from '../component';
import { Entity } from '../entity';
import { Collection } from '../util/collection';

import { cloneComponent, cloneEntity } from '../util/clone';
import { isInteger } from '../util/is';
import { toInteger } from '../util/to';
import { componentsFromCollections } from '../util/array/value';
import { valueArray } from '../util/array/value';
import { entityToString } from '../util/to_string';
import { stringify } from '../util/stringify';
import { isComponent, isEntity } from '../util/is';
import { arrayDifference } from '../util/array/difference';

import {
    ENTITY_ID,
    COMPONENT_UPDATE,
    COMPONENT_REMOVE,
    ENTITY_REMOVE,
    COMPONENT_ADD,
    ENTITY_UPDATE,
    ENTITY_ADD,
    CMD_ENTITY_ADD,
    CMD_ENTITY_REMOVE,
    CMD_ENTITY_UPDATE,
    CMD_COMPONENT_ADD,
    CMD_COMPONENT_REMOVE,
    CMD_COMPONENT_UPDATE,
    OP_CREATE_FROM_EXISTING_ID,
    OP_CREATE_NEW,
    OP_UPDATE_EXISTING
} from '../constants';





// import {createLog} from '../util/log';
// const Log = createLog('CmdBufferSync');

export function SyncCmdBuffer() {
    this.cmds = {};
    // TODO: explain why specifically we use the cid attribute as the key
    this.entitiesAdded = new Collection(); //null,{idAttribute:'cid'});
    this.entitiesUpdated = new Collection(); //null,{idAttribute:'cid'});
    this.entitiesRemoved = new Collection(); //null,{idAttribute:'cid'});
    this.componentsAdded = new Collection(); //null,{idAttribute:'cid'});
    this.componentsUpdated = new Collection(); //null,{idAttribute:'cid'});
    this.componentsRemoved = new Collection(); //null,{idAttribute:'cid'});
}

Object.assign(SyncCmdBuffer.prototype, {
    /**
     * Adds a component to the entityset
     *
     * @param {*} entitySet
     * @param {*} component
     * @param {*} options
     */
    addComponent(entitySet, component, options = {}) {
        let execute, entityID, entity, existingCom;
        let ii;
        let result;

        // debug = options.debug;
        entity = options.entity;

        execute = options.execute === undefined ? true : options.execute;

        if (!component) {
            return this;
        }

        // if we have been passed an array, then batch all those commands together
        if (Array.isArray(component)) {
            if (options.batch === undefined) {
                options.batch = true;
                options.execute = false;
                if (execute !== false) {
                    execute = true;
                }
            }

            if (execute !== false) {
                this.reset();
            }

            for (ii in component) {
                this.addComponent(entitySet, component[ii], options);
            }

            if (execute) {
                this.execute(entitySet, options);
                // result = componentsFromCollections(this.entitiesAdded, this.entitiesUpdated, this.componentsAdded, this.componentsUpdated);
            }

            return result;
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (!isComponent(component)) {
            // console.log('[CmdBufferSync][addComponent]', 'not component instance', component.type);
            throw new Error('argument is not component instance');
        }

        // determine whether we have this component registered already
        if (options[ENTITY_ID] !== undefined) {
            entityID = options[ENTITY_ID];
        } else {
            entityID = component.getEntityID();
        }

        if (component.id !== 0) {
            // if (options.debug) console.log('[CmdBufferSync][addComponent]', 'component with id', component.id);

            // check for an existing component
            let existing = entitySet.getComponent(component.id);

            if (existing !== undefined) {
                // if( options.debug)console.log('[CmdBufferSync][addComponent]', 'existing entity', existing.toJSON() );
                // a component with the given id already exists, so we have an existing entity
                entityID = existing.getEntityID();
            }

            if (component.getEntityID() !== 0) {
                // console.log('[CmdBufferSync][addComponent]', 'component has entity id', component.getEntityID() );

                entityID = component.getEntityID();

                if (existing !== undefined && existing.getEntityID() !== component.getEntityID()) {
                    // if (options.debug)
                    //     console.log('[CmdBufferSync][addComponent]', 'remove', component.id, 'from', entityID);
                    // remove existing component
                    this.addCommand(CMD_COMPONENT_REMOVE, existing.getEntityID(), component, options);
                }
            }
        }

        // if (entityID === 0 || entityID === undefined) {
        // const existingComponent = entitySet.getComponent(component);
        // if( existingComponent ){
        //     entityID = existingComponent.getEntityID();
        //     // if( debug ){ console.log(`found existing component ${component.id} entityid`, entityID)}
        // }
        // }

        // console.log( '^^ adding component with entity', entityID, Entity.toEntityID(entityID), component.getEntityID() );

        if (entityID === undefined) {
            // do we have a entity add in the queue already?
            entityID = this.findEntityAddID();
            // console.log('entity add id was ', entityID);
            if (entityID === -1) {
                entityID = entitySet._createEntity(null, true);
                // console.log( 'adding component with entity ' + entityID );
            }
        } else {
            // does this entity exist in our es?
            entity = entitySet.getEntity(entityID);
        }

        if (!entity) {
            // if(debug){ console.log('no existing entity found for', entityID); console.log( toString(entitySet)); }
            this.addCommand(CMD_ENTITY_ADD, entityID, undefined, options);
            this.addCommand(CMD_COMPONENT_ADD, entityID, component, options);
        } else {
            existingCom = entity.components[component.getDefID()];

            // existingCom = entitySet.getComponentFromEntity(component, entity);

            // does the existing entity have this component?
            if (!existingCom) {
                this.addCommand(CMD_COMPONENT_ADD, entityID, component, options);
            } else {
                // is the existing component different?
                this.addCommand(CMD_COMPONENT_UPDATE, entityID, component, options);
            }
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, options);
        }

        return result;
    },

    /**
     *
     * @param {*} entitySet
     * @param {*} component
     * @param {*} options
     */
    removeComponent(entitySet, component, options = {}) {
        let execute;
        let executeOptions;
        let ii, result;

        // debug = options.debug;
        // batch = options.batch; // cmds get batched together and then executed
        execute = options.execute === void 0 ? true : options.execute;
        executeOptions = { ...options, removeEmptyEntity: true };

        if (!component) {
            return false;
        }

        // if we have been passed an array, then batch all those commands together
        if (Array.isArray(component)) {
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

            for (ii in component) {
                this.removeComponent(entitySet, component[ii], options);
            }

            if (execute) {
                this.execute(entitySet, executeOptions);
            }

            return true;
        } else {
            if (execute) {
                this.reset();
            }
        }

        // important to resolve the component directly against the entityset
        // the incoming component can either be an id, or it could be a duplicate
        // component from another es, so its vital that we get the right reference
        component = entitySet.getComponent(component);

        // if (isInteger(component)) {
        // console.log('[CmdBufferSync][removeComponent]', entitySet.cid, 'com retrieve by int', component);
        // let cid = component;

        // console.log('[CmdBufferSync][removeComponent]', component);
        // if( !component ){
        // console.log('[CmdBufferSync][removeComponent]', entitySet.cid, 'retrieve by int undefined', cid);
        // console.log('es is', entityToString(entitySet));
        // }
        // }

        if (component) {
            // console.log('[CmdBufferSync][removeComponent]', entitySet.cid, 'but what?', component);

            // if (component.id !== 0) {
            // console.log('[CmdBufferSync][removeComponent]', 'looking for existing component', component.id);
            // }

            // let existing = entitySet.getComponent();

            // if (existing) {
            //     console.log('[CmdBufferSync][removeComponent]', 'found existing component', entityToString(existing));
            // }
            let entityID = component.getEntityID();

            if (entityID === 0 || entityID === undefined) {
                // console.log(
                //     '[CmdBufferSync][removeComponent]',
                //     entitySet.cid,
                //     `remove component ${component.cid} without an entity`,
                //     component
                // );
                // throw new Error('attempting to remove component without an entity');
                // return [];
            } else {
                // console.log('[CmdBufferSync][removeComponent]', entityID, component.toJSON() );
                this.addCommand(CMD_COMPONENT_REMOVE, entityID, component, options);
            }
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
        }

        return true;
    },

    /**
     * Adds an entity with its components to the entityset
     *
     * @param {*} entitySet
     * @param {*} entity
     * @param {*} options
     */
    addEntity(entitySet, entity, options = {}) {
        let entityID, existingEntity;
        let ii, comDefID;
        let execute;
        let result;
        let removeExecute = false;
        let debug = options.debug;

        if (!entity) {
            return false;
        }

        // batch = options.batch; // cmds get batched together and then executed
        execute = options.execute === void 0 ? true : options.execute;

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

            for (ii in entity) {
                this.addEntity(entitySet, entity[ii], options);
            }

            if (execute) {
                this.execute(entitySet, options);
            }

            return false;
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (!isEntity(entity)) {
            throw new Error('entity instance not passed');
        }

        // add components to the entity before removing them - otherwise the entity might
        // get garbage-collected
        // if (debug)
        //     console.log(
        //         '[CmdBufferSync][addEntity]',
        //         entitySet.cid,
        //         'adding components',
        //         entity.getComponentBitfield().toValues()
        //     );

        this.addComponent(entitySet, entity.getComponents(), { ...options, execute });

        // if there is an existing entity, then determine the differences between this new version and
        // the existing
        if (entity.getEntityID() !== 0) {
            const existingEntity = entitySet.getEntity(entity);
            if (existingEntity) {
                const newComponents = entity.getComponentBitfield().toValues();
                const existingComponents = existingEntity.getComponentBitfield().toValues();
                // if (debug)
                //     console.log(
                //         '[CmdBufferSync][addEntity]',
                //         'existing entity',
                //         existingComponents,
                //         'new',
                //         newComponents
                //     );

                // if (debug) console.log('[CmdBufferSync][addEntity]', 'adding', newComponents, existingComponents);

                // if the new version has less components, determine which have been removed
                // if( newComponents.length < existingComponents.length ){
                let remove = [];
                for (ii = 0; ii < existingComponents.length; ii++) {
                    let cid = existingComponents[ii];
                    let component = existingEntity.components[cid];
                    if (newComponents.indexOf(cid) === -1) {
                        remove.push(component.id);
                    }
                }

                if (remove.length > 0) {
                    if (execute === true) {
                        removeExecute = true;
                        execute = false;
                    }

                    // console.log('[CmdBufferSync][addEntity]', 'removing components', remove, this.cmds);
                    this.removeComponent(entitySet, remove, { ...options, execute });
                }
                // console.log('[CmdBufferSync][remove]', execute, component);
                // }
            }
        }

        // console.log('[CmdBufferSync][addEntity]', removeExecute, execute, this.cmds);

        if (removeExecute) {
            this.execute(entitySet, options);
        }

        return true;
    },

    /**
     *
     * @param {*} entitySet
     * @param {*} entity
     * @param {*} options
     */
    removeEntity(entitySet, entity, options = {}) {
        let ii, comDefID, execute, existingEntity, entityID;
        let executeOptions;
        let result;

        if (!entity) {
            return false;
        }

        // batch = options.batch; // cmds get batched together and then executed
        execute = options.execute === void 0 ? true : options.execute;
        executeOptions = { ...options, removeEmptyEntity: true };

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

            for (ii in entity) {
                this.removeEntity(entitySet, entity[ii], options);
            }

            if (execute) {
                this.execute(entitySet, executeOptions);
            }

            return true;
        } else {
            if (execute) {
                this.reset();
            }
        }

        // does this entity exist in our es?
        entityID = Entity.toEntityID(entity);
        existingEntity = entitySet.getEntity(entityID);

        if (!existingEntity) {
            return false;
        }

        for (comDefID in existingEntity.components) {
            // console.log('[CmdBufferSync][removeEntity]', 'remove com', existingEntity.components[comDefID].id);
            this.addCommand(CMD_COMPONENT_REMOVE, entityID, existingEntity.components[comDefID]);
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
        }

        return true;
    },

    /**
     *
     * @param {*} entitySet
     * @param {*} options
     */
    execute(entitySet, options) {
        let ii, ie, len, cmds, cmd;
        let com, ocom, defID, query, componentExists, existingComponent;
        let existingEntity, tEntity, registry;
        let removeEmptyEntity;
        let debug;
        let silent;

        if (options) {
            removeEmptyEntity = options.removeEmptyEntity;
            debug = this.debug || options.debug;
            silent = options.silent;
        }

        registry = entitySet.getRegistry();

        // commands are associated with an entity
        for (ie in this.cmds) {
            cmds = this.cmds[ie];

            const entityID = toInteger(ie); // no integer keys in js :(

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            // console.log('get it', entityID);
            existingEntity = entitySet.getEntity(entityID);
            tEntity = existingEntity;

            // if (existingEntity) {
            //     tEntity = existingEntity;// cloneEntity(existingEntity);
            //     // tEntity.setEntitySetID(entitySet.getEntitySetID());
            // }

            // console.log('[CmdBufferSync][execute] cmds for', entityID, stringify(cmds) );

            // go through the incoming commands
            for (ii = 0, len = cmds.length; ii < len; ii++) {
                cmd = cmds[ii];
                com = cmd[2];

                existingComponent =
                    tEntity !== undefined && com !== undefined ? tEntity.getComponentByIID(com.getDefID()) : null;
                componentExists = !!existingComponent; // tEntity !== undefined && com !== undefined && tEntity.hasComponent(com);

                // if( debug )console.log('cmd ' + JSON.stringify(cmd) );

                switch (cmd[0]) {
                    // add an entity
                    case CMD_ENTITY_ADD:
                        if (!existingEntity) {
                            // if( debug )console.log('create entity with ' + JSON.stringify(entityID) );
                            tEntity = entitySet._createEntity(entityID, false, options);
                            // console.log('[CmdBufferSync][execute]', 'adding', tEntity.id, tEntity.cid );
                            this.entitiesAdded.add(tEntity);

                            // if (debug)
                            //     console.log(
                            //         '[CmdBufferSync][execute][CMD_ENTITY_ADD]',
                            //         'adding entity',
                            //         entityToString(tEntity)
                            //     );
                        }
                        break;

                    case CMD_COMPONENT_ADD:
                        // if (debug)
                        //     console.log(
                        //         '[CmdBufferSync][execute][CMD_COMPONENT_ADD]',
                        //         entitySet.cid,
                        //         entityID,
                        //         com.id,
                        //         com.getDefID(),
                        //         stringify(com)
                        //     );

                        com = cloneComponent(com);
                        // if (debug) console.log('[CmdBufferSync][execute][CMD_COMPONENT_ADD]', 'clone', com.toJSON());

                        if (com.id === 0) {
                            if (componentExists) {
                                // if (debug)
                                //     console.log(
                                //         '[CmdBufferSync][execute][CMD_COMPONENT_ADD]',
                                //         'new (exists) com id',
                                //         com.id
                                //     );
                                com.set({ id: existingComponent.id });
                                // the following is a bit hacky - basically the component is a new instance but didnt get
                                // created with the existing component id, and so it is an addition not an update
                                componentExists = false;
                            } else {
                                com.set({ id: entitySet._createComponentID() });
                            }
                        }

                        tEntity._addComponent(com);

                        // if( debug ) console.log('[CmdBufferSync][execute][CMD_COMPONENT_ADD]', tEntity );

                        // console.log('[CmdBufferSync][execute]', 'checking for', tEntity.id, tEntity.cid, this.entitiesAdded );
                        // console.log('NOT GOING TO WORK BECAUSE THE ENTITIY IS KEYED BY CID NOT ID', this.entitiesAdded.has(tEntity.id) );
                        // console.log('ADD THE ABILITY TO SET ARBITRARY INDEXES ON THE COLLEcTION CLASS');
                        if (this.entitiesAdded.has(tEntity.id)) {
                            // console.log('[CmdBufferSync][execute]', `yes this component is being added`);
                            break;
                        }

                        if (componentExists) {
                            // if (debug) console.log('[CmdBufferSync][execute][CMD_COMPONENT_ADD]', 'exists', com.id);
                            if (!existingComponent.compare(com)) {
                                this.componentsUpdated.add(com);
                            }
                        } else {
                            // if (debug) console.log('[CmdBufferSync][execute][CMD_COMPONENT_ADD]', 'component not exists', com.id);
                            this.componentsAdded.add(com);
                        }

                        this.entitiesUpdated.add(existingEntity);

                        break;
                    case CMD_COMPONENT_REMOVE:
                        if (componentExists) {
                            // if (debug)
                            //     console.log('[CmdBufferSync][execute][CMD_COMPONENT_REMOVE]', com.id, 'from', entityID);

                            let existingEntity = existingComponent._entity;

                            tEntity._removeComponent(com);

                            // if (debug)
                            //     console.log(
                            //         '[CmdBufferSync][execute][CMD_COMPONENT_REMOVE]',
                            //         'from',
                            //         existingEntity.cid,
                            //         'com count',
                            //         tEntity.getComponentBitfield().count()
                            //     );

                            this.componentsRemoved.add(com);
                            // check that the entity still has components left
                            if (tEntity.getComponentBitfield().count() <= 0) {
                                // console.log('[CmdBufferSync][execute][CMD_COMPONENT_REMOVE]', 'remove ent', tEntity.id);
                                this.entitiesRemoved.add(tEntity);
                                this.entitiesUpdated.remove(tEntity);

                                // remove all componentsRemoved components belonging to this entity
                            } else {
                                // console.log('[CmdBufferSync][execute][CMD_COMPONENT_REMOVE]', 'update ent', existingEntity.id);
                                this.entitiesUpdated.add(existingEntity);
                            }
                        }

                        break;

                    case CMD_COMPONENT_UPDATE:
                        // if (debug) {
                        //     console.log(
                        //         '[CmdBufferSync][execute][CMD_COMPONENT_UPDATE]',
                        //         'exists?',
                        //         componentExists,
                        //         JSON.stringify(com)
                        //     );
                        // }

                        tEntity._addComponent(com);

                        if (componentExists) {
                            if (!existingComponent.compare(com)) {
                                this.componentsUpdated.add(com);
                                this.entitiesUpdated.add(existingComponent._entity);
                            } else {
                                // if (debug) {
                                //     console.log(
                                //         '[CmdBufferSync][execute][CMD_COMPONENT_UPDATE]',
                                //         'same',
                                //         JSON.stringify(existingComponent),
                                //         JSON.stringify(com)
                                //     );
                                // }
                            }
                        } else {
                            this.componentsAdded.add(com);
                        }
                        // if(debug){console.log('existing', entity.toJSON()) }
                        // console.log('££ com update', com.getEntityID(), JSON.stringify(com));
                        break;
                    default:
                        break;
                }
            }
        }

        entitySet.update(
            this.entitiesAdded,
            this.entitiesUpdated,
            this.entitiesRemoved,
            this.componentsAdded,
            this.componentsUpdated,
            this.componentsRemoved,
            options
        );

        // if( options.debug ){
        //     console.log('[CmdBufferSync]', '[componentsRemoved]', this.componentsRemoved.map( e => e.id) );
        // }

        if (!silent) {
            this.triggerEvents(entitySet, options);
        }
    },

    /**
     *
     */
    reset() {
        // console.log('[CmdBufferSync][reset]', 'clearing');
        this.cmds = {};
        this.entitiesAdded.reset();
        this.entitiesUpdated.reset();
        this.entitiesRemoved.reset();

        this.componentsAdded.reset();
        this.componentsUpdated.reset();
        this.componentsRemoved.reset();
    },

    /**
     *
     * @param {*} type
     * @param {*} entityID
     * @param {*} componentID
     * @param {*} options
     */
    addCommand(type = CMD_ENTITY_ADD, entityID = 0, componentID = 0, options = {}) {
        const entityBuffer = this.cmds[entityID] || [];
        if (type == CMD_ENTITY_ADD) {
            // this command should always be the first in the list - check
            if (entityBuffer.length > 0 && entityBuffer[0][0] == CMD_ENTITY_ADD) {
                return;
            }
            // add to top of list
            entityBuffer.unshift([type, entityID, componentID, options]);
        } else {
            entityBuffer.push([type, entityID, componentID, options]);
        }

        this.cmds[entityID] = entityBuffer;

        return this;
    },

    /**
     * Returns the entityID of an existing add command in the queue
     */
    findEntityAddID() {
        let cmds;
        let entityID;

        for (entityID in this.cmds) {
            cmds = this.cmds[entityID];
            let cmd = cmds[0][0];
            // if( cmd === CMD_EX ){
            //     cmd = cmds[0][1];
            // }
            // Log.debug('[findEntityAddID]', entityID, cmd, CMD_ENTITY_ADD );
            if (cmd == CMD_ENTITY_ADD) {
                return entityID;
            }
        }

        return -1;
    },

    /**
     *
     * @param {*} source
     */
    triggerEvents(source, options) {
        options.cid = source.cid;
        triggerEvent(source, COMPONENT_UPDATE, this.componentsUpdated, options);
        triggerEvent(source, COMPONENT_REMOVE, this.componentsRemoved, options);
        triggerEvent(source, ENTITY_REMOVE, this.entitiesRemoved, options);
        triggerEvent(source, COMPONENT_ADD, this.componentsAdded, options);
        triggerEvent(source, ENTITY_UPDATE, this.entitiesUpdated, options);
        triggerEvent(source, ENTITY_ADD, this.entitiesAdded, options);
    }
});

SyncCmdBuffer.prototype.type = 'SyncCmdBuffer';
SyncCmdBuffer.prototype.isCmdBuffer = true;

function triggerEvent(source, name, collection, options) {
    if (collection.size() > 0) {
        source.emit(name, collection.models, options);
    }
}

SyncCmdBuffer.create = function() {
    const result = new CmdBuffer();
    return result;
};
