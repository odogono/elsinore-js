// import {Collection} from 'odgn-backbone-model';
import Component from '../component';
import Entity from '../entity';
import Collection from '../util/collection';

import { cloneComponent, cloneEntity } from '../util/clone';
import { isInteger } from '../util/is';
import { toInteger } from '../util/to';
import valueArray from '../util/array/value';
import { entityToString } from '../util/to_string';
import stringify from '../util/stringify';

import arrayDifference from '../util/array/difference';

export const CMD_ENTITY_ADD = 0;
export const CMD_ENTITY_REMOVE = 1;
export const CMD_ENTITY_UPDATE = 2;
export const CMD_COMPONENT_ADD = 3;
export const CMD_COMPONENT_REMOVE = 4;
export const CMD_COMPONENT_UPDATE = 5;

// export const OP_ENTITY_NEW = 0;

// the entity id is valid, but the entity does not yet exist
export const OP_CREATE_FROM_EXISTING_ID = 1;
// a new entity is being created
export const OP_CREATE_NEW = 2;
// an existing entity is being updated
export const OP_UPDATE_EXISTING = 3;

// import {createLog} from '../util/log';
// const Log = createLog('CmdBufferSync');

export default function CmdBuffer() {
    this.cmds = {};
    // TODO: explain why specifically we use the cid attribute as the key
    this.entitiesAdded = new Collection(); //null,{idAttribute:'cid'});
    this.entitiesUpdated = new Collection(); //null,{idAttribute:'cid'});
    this.entitiesRemoved = new Collection(); //null,{idAttribute:'cid'});
    this.componentsAdded = new Collection(); //null,{idAttribute:'cid'});
    this.componentsUpdated = new Collection(); //null,{idAttribute:'cid'});
    this.componentsRemoved = new Collection(); //null,{idAttribute:'cid'});
}

Object.assign(CmdBuffer.prototype, {
    /**
    * Adds a component to this set
    */
    addComponent(entitySet, component, options = {}) {
        let execute, entityId, entity, existingCom;
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
                result = valueArray(this.componentsAdded);
            }

            return result;
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (!Component.isComponent(component)) {
            console.log('[CmdBufferSync][addComponent]', 'not component instance', component.type);
            throw new Error('argument is not component instance');
        }

        // determine whether we have this component registered already
        entityId = component.getEntityId();

        if (component.id !== 0) {
            if (options.debug) console.log('[CmdBufferSync][addComponent]', 'component with id', component.id);

            // check for an existing component
            let existing = entitySet.getComponent(component.id);

            if (existing !== undefined) {
                // if( options.debug)console.log('[CmdBufferSync][addComponent]', 'existing entity', existing.toJSON() );
                // a component with the given id already exists, so we have an existing entity
                entityId = existing.getEntityId();
            }

            if (component.getEntityId() !== 0) {
                // console.log('[CmdBufferSync][addComponent]', 'component has entity id', component.getEntityId() );

                entityId = component.getEntityId();

                if (existing !== undefined && existing.getEntityId() !== component.getEntityId()) {
                    if (options.debug)
                        console.log('[CmdBufferSync][addComponent]', 'remove', component.id, 'from', entityId);
                    // remove existing component
                    this.addCommand(CMD_COMPONENT_REMOVE, existing.getEntityId(), component, options);
                }
            }
        }

        if (entityId === 0 || entityId === undefined) {
            // const existingComponent = entitySet.getComponent(component);
            // if( existingComponent ){
            //     entityId = existingComponent.getEntityId();
            //     // if( debug ){ console.log(`found existing component ${component.id} entityid`, entityId)}
            // }
        }

        // console.log( '^^ adding component with entity', entityId, Entity.toEntityId(entityId), component.getEntityId() );

        if (entityId === undefined) {
            // do we have a entity add in the queue already?
            entityId = this.findEntityAddId();
            // console.log('entity add id was ', entityId);
            if (entityId === -1) {
                entityId = entitySet._createEntity(null, true);
                // console.log( 'adding component with entity ' + entityId );
            }
        } else {
            // does this entity exist in our es?
            entity = entitySet.getEntity(entityId);
        }

        if (!entity) {
            // if(debug){ console.log('no existing entity found for', entityId); console.log( toString(entitySet)); }
            this.addCommand(CMD_ENTITY_ADD, entityId, undefined, options);
            this.addCommand(CMD_COMPONENT_ADD, entityId, component, options);
        } else {
            existingCom = entitySet.getComponentFromEntity(component, entity);

            // does the existing entity have this component?
            if (!existingCom) {
                this.addCommand(CMD_COMPONENT_ADD, entityId, component, options);
            } else {
                // is the existing component different?
                this.addCommand(CMD_COMPONENT_UPDATE, entityId, component, options);
            }
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, options);
            result = valueArray(this.componentsAdded, this.componentsUpdated);
            // result = valueArray(this.entitiesAdded, this.entitiesUpdated);
        }
        return result;
    },

    /**
    *
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
            return [];
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
                // console.log('[CmdBufferSync][removeComponent]', 'ARR>', component[ii]);
                this.removeComponent(entitySet, component[ii], options);
            }

            if (execute) {
                this.execute(entitySet, executeOptions);
                result = valueArray(this.componentsRemoved);
            }

            return result;
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (isInteger(component)) {
            // console.log('[CmdBufferSync][removeComponent]', entitySet.cid, 'retrieve by int', component);
            // let cid = component;
            component = entitySet.getComponent(component);
            // if( !component ){
            // console.log('[CmdBufferSync][removeComponent]', entitySet.cid, 'retrieve by int undefined', cid);
            // console.log('es is', entityToString(entitySet));
            // }
        }

        if (component) {
            // console.log('[CmdBufferSync][removeComponent]', 'but what?', component);

            // if (component.id !== 0) {
            // console.log('[CmdBufferSync][removeComponent]', 'looking for existing component', component.id);
            // }

            // let existing = entitySet.getComponent();

            // if (existing) {
            //     console.log('[CmdBufferSync][removeComponent]', 'found existing component', entityToString(existing));
            // }

            let entityId = component.getEntityId();

            if (entityId === 0 || entityId === undefined) {
                // throw new Error('attempting to remove component without an entity');
                // return [];
            } else {
                // console.log('[CmdBufferSync][removeComponent]', entityId, component.toJSON() );
                this.addCommand(CMD_COMPONENT_REMOVE, entityId, component, options);
            }
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
            result = valueArray(this.componentsRemoved);
        }

        return result;
    },

    /**
     * Adds an entity with its components to the entityset
     * @param {*} entitySet
     * @param {*} entity
     * @param {*} options
     */
    addEntity(entitySet, entity, options = {}) {
        let entityId, existingEntity;
        let ii, comDefId;
        let execute;
        let result;
        let removeExecute = false;
        let debug = options.debug;

        if (!entity) {
            return null;
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
                result = valueArray(this.entitiesAdded);
            }

            return result;
        } else {
            if (execute) {
                this.reset();
            }
        }

        if (!Entity.isEntity(entity)) {
            throw new Error('entity instance not passed');
        }

        // const hasComponents = entitySet.doesEntityHaveComponents(entity);

        // if( !entitySet.allowEmptyEntities && !hasComponents ){
        //     return this;
        // }

        // add components to the entity before removing them - otherwise the entity might
        // get garbage-collected
        if( debug ) console.log('[CmdBufferSync][addEntity]', 'adding components', entity.getComponentBitfield().toValues() ); 
        this.addComponent(entitySet, entity.getComponents(), { ...options, execute });

        // if there is an existing entity, then determine the differences between this new version and
        // the existing
        if (entity.getEntityId() !== 0) {
            const existingEntity = entitySet.getEntity(entity);
            if (existingEntity) {
                const newComponents = entity.getComponentBitfield().toValues();
                const existingComponents = existingEntity.getComponentBitfield().toValues();
                if(debug) console.log('[CmdBufferSync][addEntity]', 'existing entity', existingComponents, 'new', newComponents );

                if( debug) console.log('[CmdBufferSync][addEntity]', 'adding', newComponents, existingComponents);

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

        if (removeExecute || execute) {
            result = valueArray(this.entitiesAdded);
        }

        return result;

        // // console.log('incoming', entityId, 'existing', existingEntity);

        // if( existingEntity === undefined ){
        //     // if( options.debug ) { console.log('no existing entity add ' + entityId ); }
        //     // TODO : determine whether we should allow empty entities within the entity set
        //     if( !entitySet.allowEmptyEntities && !entitySet.doesEntityHaveComponents( entity ) ){
        //         return this;
        //     }

        //     let cmdOptions = {...options,eid:entityId};

        //     this.addCommand( CMD_ENTITY_ADD, entityId, undefined, cmdOptions );

        //     // no existing entity - just add all the components
        //     for( comDefId in entity.components ){
        //         this.addCommand( CMD_COMPONENT_ADD, entityId, entity.components[comDefId], cmdOptions );
        //     }
        // }
        // else {
        //     // entity already exists, determine whether components should be updated
        //     for( comDefId in entity.components ){
        //         let component = entity.components[comDefId];

        //         Log.debug('[CmdBufferSync][addEntity]', 'bluh', component.id);
        //         if( component.id !== 0 ){

        //             let existing = entitySet.getComponent(component.id);
        //             if( existing !== undefined ){
        //                 if( existing.getEntityId() !== entityId ){
        //                     Log.debug('[CmdBufferSync][addEntity]', 'component belongs to other', existing.getEntityId(), entityId );
        //                 }
        //             }
        //         }

        //         if( existingEntity.components[comDefId] ){
        //             this.addCommand( CMD_COMPONENT_UPDATE, entityId, entity.components[comDefId], options );
        //         } else {
        //             this.addCommand( CMD_COMPONENT_ADD, entityId, entity.components[comDefId], options );
        //         }
        //     }
        // }

        // // execute any outstanding commands
        // if( execute ){
        //     this.execute( entitySet, options );
        //     result = valueArray( this.entitiesAdded );
        // }

        // return result;
    },

    /**
    *
    */
    removeEntity(entitySet, entity, options = {}) {
        let ii, comDefId, execute, existingEntity, entityId;
        let executeOptions;
        let result;

        if (!entity) {
            return null;
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
                result = valueArray(this.entitiesRemoved);
            }

            return result;
        } else {
            if (execute) {
                this.reset();
            }
        }

        // does this entity exist in our es?
        entityId = Entity.toEntityId(entity);
        existingEntity = entitySet.getEntity(entityId);

        if (!existingEntity) {
            return null;
        }

        for (comDefId in existingEntity.components) {
            // console.log('[CmdBufferSync][removeEntity]', 'remove com', existingEntity.components[comDefId].id);
            this.addCommand(CMD_COMPONENT_REMOVE, entityId, existingEntity.components[comDefId]);
        }

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
            result = valueArray(this.entitiesRemoved);
        }

        return result;
    },

    /**
     * 
     * @param {*} entitySet 
     * @param {*} options 
     */
    execute(entitySet, options) {
        let ii, ie, len, cmds, cmd;
        let com, ocom, defId, query, componentExists, existingComponent;
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

            const entityId = toInteger(ie); // no integer keys in js :(

            // if the entity already exists, then clone it in order
            // to apply temporary operations to it
            // console.log('get it', entityId);
            existingEntity = entitySet.getEntity(entityId);
            tEntity = existingEntity;

            // if (existingEntity) {
            //     tEntity = existingEntity;// cloneEntity(existingEntity);
            //     // tEntity.setEntitySetId(entitySet.getEntitySetId());
            // }

            // if( debug){ console.log('cmds for', entityId, stringify(cmds) )}

            // go through the incoming commands
            for (ii = 0, len = cmds.length; ii < len; ii++) {
                cmd = cmds[ii];
                com = cmd[2];

                existingComponent =
                    tEntity !== undefined && com !== undefined ? tEntity.getComponentByIId(com.getDefId()) : null;
                componentExists = !!existingComponent; // tEntity !== undefined && com !== undefined && tEntity.hasComponent(com);

                // if( debug )console.log('cmd ' + JSON.stringify(cmd) );

                switch (cmd[0]) {
                    // add an entity
                    case CMD_ENTITY_ADD:
                        if (!existingEntity) {
                            // if( debug )console.log('create entity with ' + JSON.stringify(entityId) );
                            tEntity = entitySet._createEntity(entityId, false, options);
                            // console.log('[CmdBufferSync][execute]', 'adding', tEntity.id, tEntity.cid );
                            this.entitiesAdded.add(tEntity);
                            if (debug) {
                                console.log('adding entity', entityToString(tEntity));
                            } // tEntity.id, entityId); }
                        }
                        break;

                    case CMD_COMPONENT_ADD:
                        if (debug)
                            console.log(
                                '[CmdBufferSync][execute][CMD_COMPONENT_ADD]',
                                entitySet.cid,
                                entityId,
                                com.id,
                                com.getDefId(),
                                stringify(com)
                            );

                        com = cloneComponent(com);

                        if (com.id === 0) {
                            if (componentExists) {
                                if (debug)
                                    console.log(
                                        '[CmdBufferSync][execute][CMD_COMPONENT_ADD]',
                                        'new (exists) com id',
                                        com.id
                                    );
                                com.set({ id: existingComponent.id });
                                // the following is a bit hacky - basically the component is a new instance but didnt get
                                // created with the existing component id, and so it is an addition not an update
                                componentExists = false;
                            } else {
                                com.set({ id: entitySet._createComponentId() });
                            }
                        }

                        tEntity.addComponent(com);

                        // console.log('[CmdBufferSync][execute]', 'checking for', tEntity.id, tEntity.cid, this.entitiesAdded );
                        // console.log('NOT GOING TO WORK BECAUSE THE ENTITIY IS KEYED BY CID NOT ID', this.entitiesAdded.has(tEntity.id) );
                        // console.log('ADD THE ABILITY TO SET ARBITRARY INDEXES ON THE COLLEcTION CLASS');
                        if (this.entitiesAdded.has(tEntity.id)) {
                            // console.log('[CmdBufferSync][execute]', `yes this component is being added`);
                            break;
                        }

                        if (componentExists) {
                            if (debug) console.log('[CmdBufferSync][execute][CMD_COMPONENT_ADD]', 'exists', com.id);
                            this.componentsUpdated.add(com);
                        } else {
                            this.componentsAdded.add(com);
                        }

                        break;
                    case CMD_COMPONENT_REMOVE:
                        // no entity to remove from?
                        // if (!entity) {
                        //     continue;
                        // }
                        // if( true || debug ){
                        // console.log('[CmdBufferSync][execute]', 'cmd: rem com ' + com.id + ' ' + JSON.stringify(com) );
                        // if( true ){ printE(tEntity); }
                        // }
                        if (componentExists) {
                            if (debug) console.log('[CmdBufferSync][execute][CMD_COMPONENT_REMOVE]', com.id, 'from', entityId);
                            tEntity.removeComponent(com);
                            this.componentsRemoved.add(com);

                            // check that the entity still has components left
                            if (tEntity.getComponentBitfield().count() <= 0) {
                                this.entitiesRemoved.add(tEntity);
                            }
                        }

                        break;

                    case CMD_COMPONENT_UPDATE:
                        if (debug) {
                            console.log('!!! cmd: update com ' + JSON.stringify(com));
                        }
                        // console.log('££ com update', com.getEntityId(), JSON.stringify(com));

                        tEntity.addComponent(com);
                        if (componentExists) {
                            this.componentsUpdated.add(com);
                        } else {
                            this.componentsAdded.add(com);
                        }
                        // if(debug){console.log('existing', entity.toJSON()) }
                        // console.log('££ com update', com.getEntityId(), JSON.stringify(com));
                        break;
                    default:
                        break;
                }
            }

            // if( debug ){ console.log('[CmdBufferSync][execute]', 'entity', entityToString(existingEntity)); }
            // if( debug ){ console.log('[CmdBufferSync][execute]', 'entity', tEntity.components ); }
            // if( debug ){ console.log('[CmdBufferSync][execute]', 'tEntity', entityToString(tEntity)); }

            // if (!tEntity) {
            //     // if the incoming entity did not clear the filter, and there is no existing
            //     // entity, then just continue to next cmd
            //     if (!entity) {
            //         continue;
            //     }

            //     // if the incoming entity did not clear the filter, we should remove
            //     // the existing entity
            //     // remove all the entities components
            //     for (defId in entity.components) {
            //         // console.log('[CmdBufferSync][execute]', 'removeComponents', entity.components[defId] );

            //         this.componentsRemoved.add(entity.components[defId]);
            //     }

            //     this.entitiesRemoved.add(entitySet._removeEntity(entity));

            //     continue;
            // }

            // isNew = entity != null;
            // if (!entity) {
            //     if (entitySet.doesEntityHaveComponents(tEntity)) {
            //         entitySet._addEntity(tEntity);
            //         this.entitiesAdded.add(tEntity);
            //     }
            // } else {

            //     const changeEntityBF = tEntity.getComponentBitfield();
            //     const existingEntityBF = entity.getComponentBitfield();

            //     // the difference displays which components will be removed
            //     const bfDifference = arrayDifference(existingEntityBF.toJSON(), changeEntityBF.toJSON());

            //     // determine which components need to be removed
            //     // if(debug){console.log('!!! SYNC change entity bf', changeEntityBF.toJSON())}
            //     // if(debug){console.log('!!! SYNC existing entity bf', existingEntityBF.toJSON())}
            //     // if(debug){console.log('!!! SYNC diff bf', bfDifference )}
            //     // if(debug){console.log('!!! entity', entityToString(entity) )}
            //     if (bfDifference.length > 0) {
            //         const removed = entity.removeComponents(bfDifference);
            //         if (removed.length > 0) {
            //             this.componentsRemoved.add( removed );
            //             // this.componentsRemoved = [...this.componentsRemoved, ...removed];
            //         }
            //     }

            //     // if the entity has no more components, then remove it
            //     if ((!this.allowEmptyEntities || removeEmptyEntity) && entity.getComponentCount() <= 0) {
            //         if( debug ){ console.log('[CmdBufferSync][execute]', 'removeEntity', entityToString(entity)); }
            //         // if( debug ){
            //         // console.log('removing entity ' + entity.getEntityId() + '/' + entity.cid );
            //         let removed = entitySet._removeEntity(entity);
            //         this.entitiesRemoved.add(removed);
            //     }
            // }

            // // apply this entity and its components to existing records
            // for (defId in tEntity.components) {
            //     com = tEntity.components[defId];
            //     if (!entity) {
            //         // because we have added the new entity, we only need to report what components
            //         // were added
            //         this.componentsAdded.add(com);
            //     } else if (!entity.components[defId]) {
            //         // the existing entity does not have this component - add it
            //         // console.log('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
            //         entity.addComponent(com);
            //         this.componentsAdded.add(com);
            //     } else if (entity) {
            //         ocom = entity.components[defId];
            //         // the entity already has this entity - update it
            //         if (!com.isEqual(ocom)) {
            //             // if(debug){console.log('^change com', com.toJSON())}
            //             // if(debug){console.log('^change ocom', ocom.toJSON())}
            //             this.componentsUpdated.add(com);
            //         }
            //     }
            // }
        }

        // if( debug ){
        //     this.debugLog();
        // }

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
            // console.log('trigger ES.sync events');
            this.triggerEvents(entitySet, options);
        }
    },

    reset() {
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
     */
    addCommand(type = CMD_ENTITY_ADD, entityId = 0, componentId = 0, options = {}) {
        const entityBuffer = this.cmds[entityId] || [];
        if (type == CMD_ENTITY_ADD) {
            // this command should always be the first in the list - check
            if (entityBuffer.length > 0 && entityBuffer[0][0] == CMD_ENTITY_ADD) {
                return;
            }
            // add to top of list
            entityBuffer.unshift([type, entityId, componentId, options]);
        } else {
            entityBuffer.push([type, entityId, componentId, options]);
        }

        this.cmds[entityId] = entityBuffer;

        return this;
    },

    /**
     * Returns the entityId of an existing add command in the queue
     */
    findEntityAddId() {
        let cmds;
        let entityId;

        for (entityId in this.cmds) {
            cmds = this.cmds[entityId];
            let cmd = cmds[0][0];
            // if( cmd === CMD_EX ){
            //     cmd = cmds[0][1];
            // }
            // Log.debug('[findEntityAddId]', entityId, cmd, CMD_ENTITY_ADD );
            if (cmd == CMD_ENTITY_ADD) {
                return entityId;
            }
        }

        return -1;
    },

    // debugLog( logFn ){
    //     if( !logFn ){
    //         return;
    //         // logFn = console.log;
    //     }
    //     logFn('entities added: ' + JSON.stringify( this.entitiesAdded.pluck('id') ));
    //     logFn('entities updated: ' + JSON.stringify( this.entitiesUpdated.pluck('id') ));
    //     logFn('entities removed: ' + JSON.stringify( this.entitiesRemoved.pluck('id') ));

    //     logFn('components added: ' + JSON.stringify( this.componentsAdded.pluck('id') ));
    //     logFn('components updated: ' + JSON.stringify( this.componentsUpdated.pluck('id') ));
    //     logFn('components removed: ' + JSON.stringify( this.componentsRemoved.pluck('id') ));
    // }

    triggerEvents(source) {
        triggerEvent(source, 'component:change', this.componentsUpdated);
        triggerEvent(source, 'component:remove', this.componentsRemoved);
        triggerEvent(source, 'entity:remove', this.entitiesRemoved);
        triggerEvent(source, 'component:add', this.componentsAdded);
        triggerEvent(source, 'entity:change', this.entitiesUpdated);
        triggerEvent(source, 'entity:add', this.entitiesAdded);
    }
});

CmdBuffer.prototype.type = 'CmdBuffer';
CmdBuffer.prototype.isCmdBuffer = true;

function triggerEvent(source, name, collection) {
    if (collection.size() > 0) {
        source.emit(name, collection.models);
    }
}

/**
 * 
 */
// function clearCollection(col) {
//     if (!col) {
//         return new Collection();
//     }
//     col.reset();
//     return col;
// }

CmdBuffer.create = function() {
    const result = new CmdBuffer();
    return result;
};
