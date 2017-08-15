// import {Collection} from 'odgn-backbone-model';
import Component from '../component';
import Entity from '../entity';
import Collection from '../util/collection';

import { cloneComponent, cloneEntity } from '../util/clone';
import { isInteger } from '../util/is';
import { toInteger } from '../util/to';
import valueArray from '../util/array/value';
import { entityToString } from '../util/to_string';

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

export default function CmdBuffer(){
    this.cmds = {};
    this.entitiesAdded = new Collection(null,{idAttribute:'cid'});
    this.entitiesUpdated = new Collection(null,{idAttribute:'cid'});
    this.entitiesRemoved = new Collection(null,{idAttribute:'cid'});
    this.componentsAdded = new Collection(null,{idAttribute:'cid'});
    this.componentsUpdated = new Collection(null,{idAttribute:'cid'});
    this.componentsRemoved = new Collection(null,{idAttribute:'cid'});
}

Object.assign( CmdBuffer.prototype, {

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
            throw new Error('argument is not component instance');
        }

        // determine whether we have this component registered already
        entityId = component.getEntityId();

        if (component.id !== 0) {
            if( options.debug)console.log('[CmdBufferSync][addComponent]', 'component with id', component.id );

            // check for an existing component
            let existing = entitySet.getComponent(component.id);

            if (existing !== undefined) {
                if( options.debug)console.log('[CmdBufferSync][addComponent]', 'existing entity', existing.toJSON() );
                // a component with the given id already exists, so we have an existing entity
                entityId = existing.getEntityId();
            }

            if (component.getEntityId() !== 0) {
                // console.log('[CmdBufferSync][addComponent]', 'component has entity id', component.getEntityId() );

                entityId = component.getEntityId();

                if (existing !== undefined && existing.getEntityId() !== component.getEntityId()) {
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
            result = valueArray(this.componentsAdded,this.componentsUpdated)
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
            component = entitySet.getComponent(component);
        }

        if (component.id !== 0) {
            // console.log('[CmdBufferSync][removeComponent]', 'looking for existing component', component.id);
        }

        let existing = entitySet.getComponent();

        if (existing) {
            // console.log('[CmdBufferSync][removeComponent]', 'found existing component', entityToString(existing));
        }

        let entityId = component.getEntityId();

        if (entityId === 0 || entityId === undefined) {
            throw new Error('attempting to remove component without an entity');
            // return [];
        }

        // console.log('[CmdBufferSync][removeComponent]', entityId, component );

        this.addCommand(CMD_COMPONENT_REMOVE, entityId, component, options);

        // execute any outstanding commands
        if (execute) {
            this.execute(entitySet, executeOptions);
            result = valueArray(this.componentsRemoved);
        }

        return result;
    },

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity(entitySet, entity, options = {}) {
        let entityId, existingEntity;
        let ii, comDefId;
        let execute;
        let result;

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

        // console.log('[CmdBufferSync][addEntity]','adding', entity.getComponents() );
        // if( hasComponents ){
        this.addComponent(entitySet, entity.getComponents(), options);
        // }
        // else {
        //     // does this entity exist in our es?
        //     entityId = Entity.toEntityId( entity );
        //     existingEntity = entitySet.getEntity( entityId );
        // }

        if (execute) {
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
     */
    execute(entitySet, options) {
        let ii, ie, len, cmds, cmd;
        let com, ocom, defId, query;
        let entity, tEntity, registry;
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
            entity = entitySet.getEntity(entityId);
            if (entity) {
                tEntity = cloneEntity(entity);
                tEntity.setEntitySetId(entitySet.getEntitySetId());
            }

            // go through the incoming commands
            for (ii = 0, len = cmds.length; ii < len; ii++) {
                cmd = cmds[ii];
                com = cmd[2];

                switch (cmd[0]) {
                    // add an entity
                    case CMD_ENTITY_ADD:
                        if (!entity) {
                            // if( debug )console.log('create entity with ' + JSON.stringify(entityId) );
                            tEntity = entitySet._createEntity(entityId, false, options);
                            // if( debug ){ console.log('adding entity', entityToString(tEntity));}// tEntity.id, entityId); }
                        }
                        break;
                    case CMD_COMPONENT_ADD:
                        // if( cmdOptions && cmdOptions.clone ){
                        // the component is cloned before being added
                        // console.log('$$ cloned component', cmd);//com.cid, com.getEntityId() );
                        com = cloneComponent(com);
                        // console.log('$$ cloned component', com.cid, com.getEntityId() );
                        // console.log('cloned component', com.getDefUri(), com.getId() );
                        // }
                        // if( !com.id ){
                        if (com.id === 0) {
                            com.set({ id: entitySet._createComponentId() });
                        }

                        tEntity.addComponent(com);
                        // console.log('cmd: add com ' + com.id + ' ' + com.name + ' ' + JSON.stringify(cmd[2]) + ' to e:' + tEntity.id );
                        break;
                    case CMD_COMPONENT_REMOVE:
                        // no entity to remove from?
                        // console.log('[CmdBufferSync][execute]','rm', JSON.stringify(com));
                        if (!entity) {
                            continue;
                        }
                        // if( true || debug ){
                        // console.log('[CmdBufferSync][execute]', 'cmd: rem com ' + com.id + ' ' + JSON.stringify(com) );
                        // if( true ){ printE(tEntity); }
                        // }
                        tEntity.removeComponent(com);
                        break;
                    case CMD_COMPONENT_UPDATE:
                        // if( debug ){ console.log('!!! cmd: update com ' + JSON.stringify( com )); }
                        // console.log('££ com update', com.getEntityId(), JSON.stringify(com));
                        tEntity.addComponent(com);
                        // console.log('££ com update', com.getEntityId(), JSON.stringify(com));
                        break;
                    default:
                        break;
                }
            }

            // once all commands have applied to this temp entity, transform
            // it through any filters. If there is still a valid result, commit
            // it to the entitySet
            // if( (query = entitySet.getQuery()) ){
            //     // if( debug ) { console.log('executing against filter ' + JSON.stringify(query) ); }
            //     // console.log('>~~~~~');
            //     // console.log( entityToString(tEntity) );
            //     // console.log('<~~~~~');
            //     tEntity = query.execute( tEntity );
            // }

            if (!tEntity) {
                // if the incoming entity did not clear the filter, and there is no existing
                // entity, then just continue to next cmd
                if (!entity) {
                    continue;
                }

                // if the incoming entity did not clear the filter, we should remove
                // the existing entity
                // remove all the entities components
                for (defId in entity.components) {
                    // console.log('[CmdBufferSync][execute]', 'removeComponents', entity.components[defId] );

                    this.componentsRemoved.add(entity.components[defId]);
                }

                this.entitiesRemoved.add(entitySet._removeEntity(entity));

                continue;
            }

            // isNew = entity != null;
            if (!entity) {
                if (entitySet.doesEntityHaveComponents(tEntity)) {
                    entitySet._addEntity(tEntity);
                    this.entitiesAdded.add(tEntity);
                }
            } else {
                const changeEntityBF = tEntity.getComponentBitfield();
                const existingEntityBF = entity.getComponentBitfield();

                // the difference displays which components will be removed
                const bfDifference = arrayDifference(existingEntityBF.toJSON(), changeEntityBF.toJSON());

                // determine which components need to be removed
                // if(debug){console.log('!!! SYNC change entity bf', changeEntityBF.toJSON())}
                // if(debug){console.log('!!! SYNC existing entity bf', existingEntityBF.toJSON())}
                // if(debug){console.log('!!! SYNC diff bf', bfDifference )}
                // if(debug){console.log('!!! entity', entityToString(entity) )}
                if (bfDifference.length > 0) {
                    const removed = entity.removeComponents(bfDifference);
                    if (removed.length > 0) {
                        this.componentsRemoved.add( removed );
                        // this.componentsRemoved = [...this.componentsRemoved, ...removed];
                    }
                }

                // if the entity has no more components, then remove it
                if ((!this.allowEmptyEntities || removeEmptyEntity) && entity.getComponentCount() <= 0) {
                    // if( debug ){
                    // console.log('removing entity ' + entity.getEntityId() + '/' + entity.cid );
                    let removed = entitySet._removeEntity(entity);
                    // console.log('[CmdBufferSync][execute]', 'removeEntity', removed);
                    this.entitiesRemoved.add(removed);
                }
            }

            // apply this entity and its components to existing records
            for (defId in tEntity.components) {
                com = tEntity.components[defId];
                if (!entity) {
                    // because we have added the new entity, we only need to report what components
                    // were added
                    this.componentsAdded.add(com);
                } else if (!entity.components[defId]) {
                    // the existing entity does not have this component - add it
                    // console.log('adding component '+ com.id + ' to ' + entity.cid + ' ' + JSON.stringify(com));
                    entity.addComponent(com);
                    this.componentsAdded.add(com);
                } else if (entity) {
                    ocom = entity.components[defId];
                    // the entity already has this entity - update it
                    if (!com.isEqual(ocom)) {
                        // if(debug){console.log('^change com', com.toJSON())}
                        // if(debug){console.log('^change ocom', ocom.toJSON())}
                        this.componentsUpdated.add(com);
                    }
                }
            }
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
            this.componentsRemoved
        );

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
    },
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
