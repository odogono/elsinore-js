import arrayPush from './util/array/push';
import arrayClear from './util/array/clear';
import Base from './base';
import uniqueId from './util/unique_id';

import { toString as entityToString } from './util/to_string';
import * as CmdBuffer from './cmd_buffer/sync';

/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */

export default function EntityProcessor(options = {}) {
    options = { id: uniqueId(), priority: 0, updateable: true, ...options };

    this._cmds = [];
    this.id = options.id;
    this._priority = options.priority;
    this._updateable = options.updateable;
}

Object.assign(EntityProcessor.prototype, Base.prototype, {
    getPriority() {
        return this._priority;
    },

    start() {},

    stop() {},

    onInitialize(registry) {},

    update(entityArray, timeMs, options) {},

    /**
     * 
     */
    applyChanges() {
        let ii, len, cmd;
        let entity, component;
        let componentsToAdd, componentsToRemove, entitiesToAdd, entitiesToRemove;
        let result;

        // log.debug( this.name + ' applying ' + this._cmds.length + ' CMDS' );
        for (ii = 0, len = this._cmds.length; ii < len; ii++) {
            cmd = this._cmds[ii];
            entity = cmd[1];
            // log.debug( this.name + ' CMD ' + JSON.stringify(cmd) );

            switch (cmd[0]) {
                case CmdBuffer.CMD_COMPONENT_ADD:
                    // console.log( this.name + ' adding COMP ' + JSON.stringify(cmd[2]));
                    component = this.registry.createComponent(cmd[2], { '@e': entity.getEntityId() });
                    componentsToAdd = arrayPush(componentsToAdd, component);
                    break;
                case CmdBuffer.CMD_COMPONENT_REMOVE:
                    // console.debug( this.name + ' removing COMP ' + stringify(cmd[2]));
                    componentsToRemove = arrayPush(componentsToRemove, cmd[2]);
                    break;
                case CmdBuffer.CMD_ENTITY_ADD:
                    entitiesToAdd = arrayPush(entitiesToAdd, entity);
                    break;
                case CmdBuffer.CMD_ENTITY_REMOVE:
                    entitiesToRemove = arrayPush(entitiesToRemove, entity);
                    break;
                default:
                    // log.debug(this.name + ' unknown cmd ' + cmd[0] );
                    break;
            }
        }

        if (componentsToAdd) {
            result = this.entitySet.addComponent(componentsToAdd);
            componentsToAdd = null;
        }
        if (componentsToRemove) {
            // log.debug('processor removing components ' + JSON.stringify(componentsToRemove) );
            result = this.entitySet.removeComponent(componentsToRemove);
            componentsToRemove = null;
        }
        if (entitiesToAdd) {
            result = this.entitySet.addEntity(entitiesToAdd);
            entitiesToAdd = null;
        }

        if (entitiesToRemove) {
            // console.log('removing entities from ' + entitySet.cid + ' ' + stringify(entitiesToRemove) );
            result = this.entitySet.removeEntity(entitiesToRemove);
            // log.debug(' = removed entities ' + stringify(result) );
            // printE( entitySet );
            entitiesToRemove = null;
        }

        // console.log('[EntityProcessor][applyChanges]', entityToString(this.entitySet) );

        this._cmds = arrayClear(this._cmds);
        return result;
    },

    /**
     * 
     * @param {*} component 
     */
    createComponent(component){
        return this.registry.createComponent(component);
    },

    /**
     * Adds the specified component to the entity
     * @param {*} component 
     * @param {*} entity 
     */
    addComponentToEntity(component, entity) {
        this._cmds.push([CmdBuffer.CMD_COMPONENT_ADD, entity, component]);
    },

    /**
     * 
     * @param {*} component 
     * @param {*} entity 
     */
    removeComponentFromEntity(component, entity) {
        this._cmds.push([CmdBuffer.CMD_COMPONENT_REMOVE, entity, component]);
    },

    // addEntity: function( entity ){
    //     this._cmds.push( [CmdBuffer.CMD_ENTITY_ADD, entity] );
    // },

    /**
     * 
     * @param {*} args 
     */
    createEntity(...args) {
        let entity = this.registry.createEntity.apply(this.registry, args);
        this._cmds.push([CmdBuffer.CMD_ENTITY_ADD, entity]);
        if (this.isReleasingEvents) {
            return this.applyChanges();
        }
        return entity;
    },

    /**
     * 
     * @param {*} entity 
     * @param {*} apply 
     */
    destroyEntity(entity, apply) {
        this._cmds.push([CmdBuffer.CMD_ENTITY_REMOVE, entity]);
        if (apply || this.isReleasingEvents) {
            return this.applyChanges();
        }
        return entity;
    },

    /**
     * 
     * @param {*} entityId 
     */
    getEntity(entityId) {
        return this.entitySet.getEntity(entityId);
    },

    /**
     * 
     */
    toJSON() {
        let result = {};
        result.name = this.name;
        return result;
    }
});

EntityProcessor.prototype.type = 'EntityProcessor';
EntityProcessor.prototype.isEntityProcessor = true;

EntityProcessor.isEntityProcessor = function(ep) {
    return ep && ep.isEntityProcessor === true;
};

EntityProcessor.create = function create(attrs, options = {}) {
    const klass = options.Model || EntityProcessor;
    let result = new klass(attrs);
    return result;
};
