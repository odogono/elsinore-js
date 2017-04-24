import arrayPush from './util/array/push';
import arrayClear from './util/array/clear';

import uniqueId from './util/unique_id';

import * as CmdBuffer from './cmd_buffer/sync';

import EventsAsync from './util/events.async';

/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */
export default class EntityProcessor {
    /**
     * 
     */
    constructor(options = {}) {
        Object.assign(this, EventsAsync);
        options = { id: uniqueId(), priority: 0, updateable: true, ...options };

        this._cmds = [];
        this.id = options.id;
        this._priority = options.priority;
        this._updateable = options.updateable;
    }

    getPriority() {
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
        let ii, len, cmd;
        let entity, component;
        let componentsToAdd, componentsToRemove, entitiesToAdd, entitiesToRemove;
        let result;

        // log.debug( this.name + ' applying ' + this._cmds.length + ' CMDS' );
        for ((ii = 0), (len = this._cmds.length); ii < len; ii++) {
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

        this._cmds = arrayClear(this._cmds);
        return result;
    }

    /**
     * Adds the specified component to the entity
     */
    addComponentToEntity(component, entity) {
        this._cmds.push([CmdBuffer.CMD_COMPONENT_ADD, entity, component]);
    }

    removeComponentFromEntity(component, entity) {
        this._cmds.push([CmdBuffer.CMD_COMPONENT_REMOVE, entity, component]);
    }

    // addEntity: function( entity ){
    //     this._cmds.push( [CmdBuffer.CMD_ENTITY_ADD, entity] );
    // },

    createEntity(...args) {
        let entity = this.registry.createEntity.apply(this.registry, args);
        this._cmds.push([CmdBuffer.CMD_ENTITY_ADD, entity]);
        if (this.isReleasingEvents) {
            return this.applyChanges();
        }
        return entity;
    }

    destroyEntity(entity, apply) {
        this._cmds.push([CmdBuffer.CMD_ENTITY_REMOVE, entity]);
        if (apply || this.isReleasingEvents) {
            return this.applyChanges();
        }
        return entity;
    }

    getEntity(entityId) {
        return this.entitySet.getEntity(entityId);
    }

    toJSON() {
        let result = {};
        result.name = this.name;
        return result;
    }
}

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
