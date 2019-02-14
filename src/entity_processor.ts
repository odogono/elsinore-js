import { arrayPush } from './util/array/push';
import { arrayClear } from './util/array/clear';
import { Base, BaseOptions } from './base';
import { Entity } from './entity';
import { EntitySet } from './entity_set';
import { Component } from './component';
import { uniqueID } from './util/unique_id';

import { toString as entityToString, entitySetToString } from './util/to_string';
import { SyncCmdBuffer as CmdBuffer } from './cmd_buffer/sync';

import { ENTITY_ID, Command } from './types';


type ProcessorCommand = [ Command, Entity, Component? ];

interface EntityProcessorOptions extends BaseOptions {
    priority?:number;
    isUpdateable?:boolean;
}

function processOptions( options:EntityProcessorOptions = {} ) : EntityProcessorOptions {
    return { id: <number>uniqueID(), priority: 0, isUpdateable: true, ...options };
}

/**
 * Systems process entity components
 *
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */

export class EntityProcessor extends Base {

    type:string = 'EntityProcessor';

    isEntityProcessor:boolean = true;

    _cmds:Array<ProcessorCommand>;

    _priority:number;

    _isUpdateable: boolean;

    _entitySet: EntitySet;

    static isEntityProcessor(ep) {
        return ep && ep.isEntityProcessor === true;
    };

    // static create(attrs, options:EntityProcessorOptions = {}) {
    //     const klass = options.Model || EntityProcessor;
    //     let result = new klass(attrs);
    //     return result;
    // };


    constructor(options:EntityProcessorOptions = {}){
        super( processOptions(options) );
        
        this._cmds = [];
        this._priority = options.priority;
        this._isUpdateable = options.isUpdateable;
    }

    getPriority() : number {
        return this._priority;
    }

    start() {}

    stop() {}

    onInitialize(registry) {}

    update(entityArray, timeMs, options) {}

    /**
     *
     */
    applyChanges() {
        const registry = this.getRegistry();
        let ii:number, len:number, cmd:ProcessorCommand;
        let entity:Entity, component:Component;
        let componentsToAdd, componentsToRemove, entitiesToAdd, entitiesToRemove;
        let result;
        let entitySet:EntitySet = this._entitySet;

        // console.log( this.id, 'applying', this._cmds.length, 'CMDS' );

        for (ii = 0, len = this._cmds.length; ii < len; ii++) {
            cmd = this._cmds[ii];
            entity = cmd[1];
            // console.log( this.id, 'CMD', JSON.stringify(cmd) );

            switch (cmd[0]) {
                case Command.ComponentAdd:
                    // console.log( this.id, 'adding COMP', JSON.stringify(cmd[2]));
                    component = registry.createComponent(cmd[2], { [ENTITY_ID]: entity.getEntityID() });
                    componentsToAdd = arrayPush(componentsToAdd, component);
                    break;
                case Command.ComponentRemove:
                    // console.debug( this.name + ' removing COMP ' + stringify(cmd[2]));
                    componentsToRemove = arrayPush(componentsToRemove, cmd[2]);
                    break;
                case Command.EntityAdd:
                    entitiesToAdd = arrayPush(entitiesToAdd, entity);
                    break;
                case Command.EntityRemove:
                    entitiesToRemove = arrayPush(entitiesToRemove, entity);
                    break;
                default:
                    // console.log(this.name + ' unknown cmd ' + cmd[0] );
                    break;
            }
        }

        if (componentsToAdd) {
            result = entitySet.addComponent(componentsToAdd);
            componentsToAdd = null;
        }
        if (componentsToRemove) {
            // console.log('processor removing components ' + JSON.stringify(componentsToRemove) );
            result = entitySet.removeComponent(componentsToRemove);
            componentsToRemove = null;
        }
        if (entitiesToAdd) {
            result = entitySet.addEntity(entitiesToAdd);
            entitiesToAdd = null;
        }

        if (entitiesToRemove) {
            // console.log('removing entities from ' + entitySet.cid + ' ' + stringify(entitiesToRemove) );
            result = entitySet.removeEntity(entitiesToRemove);
            // console.log(' = removed entities ' + stringify(result) );
            // printE( entitySet );
            entitiesToRemove = null;
        }

        // console.log('[EntityProcessor][applyChanges]', entityToString(this.entitySet) );

        this._cmds = arrayClear(this._cmds);
        return result;
    }

    /**
     *
     * @param {*} component
     */
    createComponent(component) {
        return this.getRegistry().createComponent(component);
    }

    /**
     * Adds the specified component to the entity
     * @param {*} component
     * @param {*} entity
     */
    addComponentToEntity(component, entity) {
        this._cmds.push([Command.ComponentAdd, entity, component]);
    }

    /**
     *
     * @param {*} component
     * @param {*} entity
     */
    removeComponentFromEntity(component, entity) {
        this._cmds.push([Command.ComponentRemove, entity, component]);
    }

    // addEntity: function( entity ){
    //     this._cmds.push( [Command.EntityAdd, entity] );
    // },

    /**
     *
     * @param {*} args
     */
    createEntity(...args) {
        const registry = this.getRegistry();
        let entity = registry.createEntity.apply(registry, args);
        this._cmds.push([Command.EntityAdd, entity]);
        if (this.isReleasingEvents()) {
            return this.applyChanges();
        }
        return entity;
    }

    /**
     *
     * @param {*} entity
     * @param {*} apply
     */
    destroyEntity(entity, apply) {
        this._cmds.push([Command.EntityRemove, entity]);
        if (apply || this.isReleasingEvents() ) {
            return this.applyChanges();
        }
        return entity;
    }

    /**
     *
     * @param {*} entityID
     */
    getEntity(entityID) {
        return this._entitySet.getEntity(entityID);
    }

    /**
     *
     */
    toJSON() {
        let result = {};
        // result.name = this.name;
        return result;
    }

    /**
     * Returns a string representation of this entity.
     * Used internally by util/to_string
     * 
     * @param {*} indent 
     */
    _toEsString( indent ){
        return entitySetToString(this._entitySet, indent);
    }
}

