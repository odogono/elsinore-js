import { Component, setComponentID, cloneComponent } from '../component';
import { Entity, cloneEntity } from '../entity';
import { EntitySet } from '../entity_set';
import { Collection } from '../util/collection';

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
    EntityEvent,
    Command,
    EntityCommand,
    EntityCommandBuffer
} from '../types';


export interface CommandBufferOptions {
    entity?:Entity;
    execute?:boolean;
    batch?:boolean;
    removeEmptyEntity?:boolean;
    silent?:boolean;
    debug?:boolean;
}



// import {createLog} from '../util/log';
// const Log = createLog('CmdBufferSync');


export class SyncCmdBuffer {

    readonly type:string = 'SyncCmdBuffer';
    readonly isCmdBuffer:boolean = true;

    cmds:EntityCommandBuffer = {};
    entitiesAdded:Collection<Entity> = new Collection();
    entitiesUpdated:Collection<Entity> = new Collection();
    entitiesRemoved:Collection<Entity> = new Collection();
    componentsAdded:Collection<Component> = new Collection();
    componentsUpdated:Collection<Component> = new Collection();
    componentsRemoved:Collection<Component> = new Collection();

    /**
     * Adds a component to the entityset
     *
     */
    addComponent(entitySet:EntitySet, component:Component, options:CommandBufferOptions = {}) {
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
                    this.addCommand( Command.ComponentRemove, existing.getEntityID(), component, options);
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
            this.addCommand(Command.EntityAdd, entityID, undefined, options);
            this.addCommand(Command.ComponentAdd, entityID, component, options);
        } else {
            existingCom = entity.components[component.getDefID()];

            // existingCom = entitySet.getComponentFromEntity(component, entity);

            // does the existing entity have this component?
            if (!existingCom) {
                this.addCommand(Command.ComponentAdd, entityID, component, options);
            } else {
                // is the existing component different?
                this.addCommand(Command.ComponentUpdate, entityID, component, options);
            }
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, options);
        }

        return result;
    }

    /**
     *
     * @param {*} entitySet
     * @param {*} component
     * @param {*} options
     */
    removeComponent(entitySet, component, options:CommandBufferOptions = {}) {
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
                this.addCommand(Command.ComponentRemove, entityID, component, options);
            }
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
        }

        return true;
    }

    /**
     * Adds an entity with its components to the entityset
     *
     * @param {*} entitySet
     * @param {*} entity
     * @param {*} options
     */
    addEntity(entitySet, entity, options:CommandBufferOptions = {}) {
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
    }

    /**
     *
     * @param {*} entitySet
     * @param {*} entity
     * @param {*} options
     */
    removeEntity(entitySet, entity, options:CommandBufferOptions = {}) {
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
            this.addCommand(Command.ComponentRemove, entityID, existingEntity.components[comDefID]);
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
        }

        return true;
    }

    /**
     *
     * @param {*} entitySet
     * @param {*} options
     */
    execute(entitySet, options?:CommandBufferOptions) {
        let ii, ie, len, cmds:EntityCommand[];
        let ocom, defID, query, componentExists: boolean, existingComponent;
        let existingEntity, tEntity, registry;
        let removeEmptyEntity;
        let debug;
        let silent;

        if (options) {
            removeEmptyEntity = options.removeEmptyEntity;
            debug = options.debug;
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
                
                let [ cmdType, entityID, component, options ] = cmds[ii];
                
                existingComponent =
                    tEntity !== undefined && component !== undefined ? tEntity.getComponentByIID(component.getDefID()) : null;
                componentExists = !!existingComponent; // tEntity !== undefined && com !== undefined && tEntity.hasComponent(com);

                // if( debug )console.log('cmd ' + JSON.stringify(cmd) );

                switch (cmdType) {
                    // add an entity
                    case Command.EntityAdd:
                        if (!existingEntity) {
                            // if( debug )console.log('create entity with ' + JSON.stringify(entityID) );
                            tEntity = entitySet._createEntity(entityID, false, options);
                            // console.log('[CmdBufferSync][execute]', 'adding', tEntity.id, tEntity.cid );
                            this.entitiesAdded.add(tEntity);

                            // if (debug)
                            //     console.log(
                            //         '[CmdBufferSync][execute][Command.EntityAdd]',
                            //         'adding entity',
                            //         entityToString(tEntity)
                            //     );
                        }
                        break;

                    case Command.ComponentAdd:
                        // if (debug)
                        //     console.log(
                        //         '[CmdBufferSync][execute][Command.ComponentAdd]',
                        //         entitySet.cid,
                        //         entityID,
                        //         com.id,
                        //         com.getDefID(),
                        //         stringify(com)
                        //     );

                        
                        // if (debug) console.log('[CmdBufferSync][execute][Command.ComponentAdd]', 'clone', com.toJSON());

                        if (component.id === 0) {

                            // if the component has no id, then assign on either from the existing component, or by generation

                            if (componentExists) {
                                // if (debug)
                                //     console.log(
                                //         '[CmdBufferSync][execute][Command.ComponentAdd]',
                                //         'new (exists) com id',
                                //         com.id
                                //     );

                                component = setComponentID( existingComponent.id, component );
                                // com.set({ id: existingComponent.id });
                                // the following is a bit hacky - basically the component is a new instance but didnt get
                                // created with the existing component id, and so it is an addition not an update
                                componentExists = false;
                            } else {
                                // com.set({ id: entitySet._createComponentID() });
                                component = setComponentID( entitySet._createComponentID(), component );
                            }
                        } else {
                            component = cloneComponent(component);
                        }

                        tEntity._addComponent(component);

                        // if( debug ) console.log('[CmdBufferSync][execute][Command.ComponentAdd]', tEntity );

                        // console.log('[CmdBufferSync][execute]', 'checking for', tEntity.id, tEntity.cid, this.entitiesAdded );
                        // console.log('NOT GOING TO WORK BECAUSE THE ENTITIY IS KEYED BY CID NOT ID', this.entitiesAdded.has(tEntity.id) );
                        // console.log('ADD THE ABILITY TO SET ARBITRARY INDEXES ON THE COLLEcTION CLASS');
                        
                        
                        // if we are dealing with a new entity, then no need to record a new or updated component
                        if (this.entitiesAdded.has(tEntity.id)) {
                            // console.log('[CmdBufferSync][execute]', `yes this component is being added`);
                            break;
                        }

                        if (componentExists) {
                            // if (debug) console.log('[CmdBufferSync][execute][Command.ComponentAdd]', 'exists', com.id);
                            if (!existingComponent.compare(component)) {
                                this.componentsUpdated.add(component);
                            }
                        } else {
                            // if (debug) console.log('[CmdBufferSync][execute][Command.ComponentAdd]', 'component not exists', com.id);
                            this.componentsAdded.add(component);
                        }

                        this.entitiesUpdated.add(existingEntity);

                        break;
                    case Command.ComponentRemove:
                        if (componentExists) {
                            // if (debug)
                            //     console.log('[CmdBufferSync][execute][Command.ComponentRemove]', com.id, 'from', entityID);

                            let existingEntity = existingComponent._entity;

                            tEntity._removeComponent(component);

                            // if (debug)
                            //     console.log(
                            //         '[CmdBufferSync][execute][Command.ComponentRemove]',
                            //         'from',
                            //         existingEntity.cid,
                            //         'com count',
                            //         tEntity.getComponentBitfield().count()
                            //     );

                            this.componentsRemoved.add(component);
                            // check that the entity still has components left
                            if (tEntity.getComponentBitfield().count() <= 0) {
                                // console.log('[CmdBufferSync][execute][Command.ComponentRemove]', 'remove ent', tEntity.id);
                                this.entitiesRemoved.add(tEntity);
                                this.entitiesUpdated.remove(tEntity);

                                // remove all componentsRemoved components belonging to this entity
                            } else {
                                // console.log('[CmdBufferSync][execute][Command.ComponentRemove]', 'update ent', existingEntity.id);
                                this.entitiesUpdated.add(existingEntity);
                            }
                        }

                        break;

                    case Command.ComponentUpdate:
                        // if (debug) {
                        //     console.log(
                        //         '[CmdBufferSync][execute][Command.ComponentUpdate]',
                        //         'exists?',
                        //         componentExists,
                        //         JSON.stringify(com)
                        //     );
                        // }

                        tEntity._addComponent(component);

                        if (componentExists) {
                            if (!existingComponent.compare(component)) {
                                this.componentsUpdated.add(component);
                                this.entitiesUpdated.add(existingComponent._entity);
                            } else {
                                // if (debug) {
                                //     console.log(
                                //         '[CmdBufferSync][execute][Command.ComponentUpdate]',
                                //         'same',
                                //         JSON.stringify(existingComponent),
                                //         JSON.stringify(com)
                                //     );
                                // }
                            }
                        } else {
                            this.componentsAdded.add(component);
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
    }

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
    }

    /**
     *
     * @param {*} type
     * @param {*} entityID
     * @param {*} component
     * @param {*} options
     */
    addCommand(type = Command.EntityAdd, entityID:number = 0, component:Component, options = {}) {
        const entityBuffer = this.cmds[entityID] || [];

        if (type == Command.EntityAdd) {
            // this command should always be the first in the list - check
            if (entityBuffer.length > 0 && entityBuffer[0][0] == Command.EntityAdd) {
                return;
            }
            // add to top of list
            entityBuffer.unshift([type, entityID, component, options]);
        } else {
            entityBuffer.push([type, entityID, component, options]);
        }

        this.cmds[entityID] = entityBuffer;

        return this;
    }

    

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
            // Log.debug('[findEntityAddID]', entityID, cmd, Command.EntityAdd );
            if (cmd == Command.EntityAdd) {
                return entityID;
            }
        }

        return -1;
    }

    /**
     *
     * @param {*} source
     */
    triggerEvents(source, options) {
        options.cid = source.cid;
        triggerEvent(source, EntityEvent.ComponentUpdate, this.componentsUpdated, options);
        triggerEvent(source, EntityEvent.ComponentRemove, this.componentsRemoved, options);
        triggerEvent(source, EntityEvent.EntityRemove, this.entitiesRemoved, options);
        triggerEvent(source, EntityEvent.ComponentAdd, this.componentsAdded, options);
        triggerEvent(source, EntityEvent.EntityUpdate, this.entitiesUpdated, options);
        triggerEvent(source, EntityEvent.EntityAdd, this.entitiesAdded, options);
    }
}



function triggerEvent(source, name, collection, options) {
    if (collection.size() > 0) {
        source.emit(name, collection.models, options);
    }
}
