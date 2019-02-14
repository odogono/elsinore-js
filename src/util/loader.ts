import { createLog } from './log';
import { omit } from './omit';
import { readProperty } from './read_property';
import { toString as entityToString } from './to_string';
import { Registry } from '../registry';

import { COMPONENT_DEF_ID, COMPONENT_URI, ENTITY_ID, 
    LCMD_UNKNOWN,
    LCMD_COMMAND,
    LCMD_ADD_ENTITY,
    LCMD_REGISTER_COMPONENT,
    LCMD_REMOVE_ENTITY,
    LCMD_REMOVE_COMPONENT,
    LCMD_END_OF_EXISTING
 } from '../types';

const Log = createLog('JSONLoader');

export class JSONLoader {

    registry: Registry;

    /**
     *
     */
    load(commands, entitySet, options = {}) {
        const registry = (this.registry = entitySet.getRegistry());
        let context = { entitySet, registry };

        // execute each command in turn
        return commands.reduce(
            (current, cmd) => current.then(() => this._processCommand(context, cmd)),
            Promise.resolve()
        );
    }

    /**
     *
     */
    _processCommand(context, command, options = {}) {
        const [type, cmd, arg] = findCommand(command);

        switch (cmd) {
            case LCMD_ADD_ENTITY:
                return this._addEntityToEntitySet(context, options);
            // return addEntity(registry, entitySet, loader.entity)
            case LCMD_REGISTER_COMPONENT:
                return this._registerComponent(context, arg);
            case LCMD_REMOVE_ENTITY:
                return this._deleteEntity(context, arg, options);
            case LCMD_REMOVE_COMPONENT:
                return this._deleteComponent(context, arg, options);
            case LCMD_END_OF_EXISTING:
                return Promise.resolve(context);
            default:
                // console.log('process', cmd, command );
                if (command[COMPONENT_DEF_ID] || command[COMPONENT_URI]) {
                    return this._createComponent(context, command, options);
                }
                return Promise.resolve(context);
        }
    }

    _createEntity(context) {
        if (context.entity) {
            // already have an entity, so add it to the load cache
            return this._processCommand(context, { [LCMD_COMMAND]: LCMD_ADD_ENTITY }).then(context =>
                this._createEntity(context)
            );
        }

        context.entity = context.registry.createEntity();

        return Promise.resolve(context);
    }

    _deleteEntity(context, args, options = {}) {
        const entityID = args ? args.id || args.eid : undefined;
        if (entityID === undefined) {
            return Promise.resolve(context);
        }

        return Promise.resolve(context.entitySet.removeEntity(entityID)).then(() => context);
    }

    /**
     *
     * @param {*} context
     * @param {*} args
     * @param {*} options
     */
    _deleteComponent(context, args, options = {}) {
        const componentID = args ? args.id || args.cid : undefined;
        if (componentID === undefined) {
            return Promise.resolve(context);
        }

        // console.log('[JSONLoader][_deleteComponent]', componentID);
        return Promise.resolve(context.entitySet.removeComponent(componentID, { fromLoader: true }));
    }

    /**
     *
     */
    _addEntityToEntitySet(context, options = {}) {
        const { entity, entitySet } = context;
        return Promise.resolve(entitySet.addEntity(entity)).then(() => {
            context.entity = null;
            return context;
        });
    }

    /**
     *
     */
    _createComponent(context, obj, options) {
        // const debug = readProperty(options, 'debug', false);
        // if (debug) {
        //     Log.debug(`[createComponent] from`, obj);
        // }
        const component = context.registry.createComponent(obj);

        // if( debug ){ Log.debug(`[createComponent]`, stringify(component) ); }

        // if an explicit entityid is set, then add directly to the entityset
        if (obj[ENTITY_ID]) {
            return context.entitySet.addComponent(component);
        }

        if (!context.entity) {
            return this._createEntity(context).then(() => context.entity.addComponent(component));
        }

        context.entity.addComponent(component);

        // if (debug) Log.debug('[createComponent] add to entity', context.entitySet.cid, entityToString(context.entity));

        return component;
    }

    _registerComponent(context, args) {
        // Log.debug(`[registerComponent]`, stringify(args) );

        return context.registry.registerComponent(args);
    }
}

function findCommand(obj) {
    if (obj[LCMD_COMMAND]) {
        return [LCMD_COMMAND, obj[LCMD_COMMAND], omit(obj, LCMD_COMMAND)];
    }
    return [LCMD_UNKNOWN, null];
}
