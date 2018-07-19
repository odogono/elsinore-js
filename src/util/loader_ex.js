// import Url from 'fast-url-parser';
import Registry from '../registry';
import '../query/limit';
import { omit } from './omit';
import { parseUrl } from './url';
import { createLog } from './log';
import { toPascalCase } from './to';
import { stringify } from './stringify';
import { cloneEntity } from './clone';

import {
    getEntityIdFromId,
    getEntitySetIdFromId,
    setEntityIdFromId
} from './id';
import { toString as entityToString } from './to_string';

// import parseEJSON from './ejson.parser';

export const CMD_UNKNOWN = '@unk';
export const CMD_COMMAND = '@cmd';
export const CMD_CREATE_ENTITY = 'create-entity';
export const CMD_CREATE_ENTITY_ALT = 'entity';
export const CMD_ADD_ENTITY = 'add-entity';
export const CMD_FLUSH = 'flush';
export const CMD_DEFINE = '@define';
export const CMD_USE = '@use';
export const CMD_MARK = '@mark';
export const CMD_MARKED = '@marked';
export const CMD_PRIMARY_KEY = '@pkey';
export const CMD_IF = '@if';
export const CMD_IF_NOT = '@ifnot';
export const CMD_END_IF = '@endif';
export const CMD_REGISTER_COMPONENT = 'register-component';
export const CMD_CREATE_ENTITY_SET = 'create-entityset';
export const CMD_COMPONENT_URI = '@uri';
export const CMD_COMPONENT = '@c';

const Log = createLog('LoaderEx');

/**
 *
 * @param {*} cmds
 * @param {*} entitySet
 */
export function load(cmds, entitySet, options) {
    let loader = new Loader(entitySet.getRegistry(), entitySet);

    return loader.load(cmds, options);
}

/**
 * A Pull stream sink which pulls the source for loader objects
 * and executes them
 * 
 * @param {*} entitySet 
 * @param {*} options 
 * @param {*} completeCb 
 */
export function sink( entitySet, options={}, completeCb ){
    let loader = new Loader(entitySet.getRegistry(), entitySet);

    return function(read) {
        read(null, function next(end, data) {
            // console.log('[stringSink]', end, stringify(data));

            if (end === true) {
                // result = [].concat.apply([], result);
                return completeCb ? completeCb() : null;
            }
            if (end) {
                throw end;
            }

            // try {

                process( loader, data, options ).then( () => read(null,next))
                .catch( err => {
                    Log.error('[read] error', data, err);
                    read(err, next);    
                })

            // } catch (err) {
            //     Log.error('[read] error', err);
            //     read(null, next);
            // }
                
        });
    }
}

function Loader(registry, entitySet) {
    this.registry = registry; // entitySet.getRegistry();
    this.entitySet = entitySet ? entitySet : registry.createEntitySet();
    this.allowCmdProcess = true;
}

Object.assign(Loader.prototype, {
    /**
     *
     * @param {*} cmds
     */
    load(cmds, options) {
        if (!Array.isArray(cmds)) {
            return new Promise();
        }

        return cmds
            .reduce((current, cmd) => {
                return current.then(() => process(this, cmd, options));
            }, Promise.resolve())
            .then(() => this.flush());
    },

    /**
     *
     */
    flush() {
        // if we still have an entity hanging, then add to ES
        if (!this.entity) {
            return Promise.resolve(this.entitySet);
        }

        return process(this, {
            [CMD_COMMAND]: CMD_ADD_ENTITY,
            fromFlush: true
        });
    },

    /**
     *
     * @param {*} obj
     */
    _findMark(obj) {
        const mark = obj[CMD_MARK];
        if (mark) {
            return [mark, omit(obj, CMD_MARK)];
        }
        return [false, obj];
    }
});

/**
 *
 * @param {*} obj
 * @param {*} options
 */
function _createEntity(loader, obj, options = {}) {
    // Log.debug(`[createEntity]`, options, !!this.entity );
    // Log.debug('[_createEntity]', obj, options );
    const registry = loader.registry;
    if (loader.entity) {
        // already have an entity, so add it to the load cache
        return process(loader, {
            ...obj,
            '@cmd': CMD_ADD_ENTITY,
            debug: true
        }).then(e => {
            // if( e ) { Log.debug('  [createEntity] created e', e.id); }
            _createEntity(loader, obj, { fromAdd: true });
        });
    }

    loader.entity = registry.createEntity();
    // Log.debug('[_createEntity]', 'created entity', loader.entity.id );
    return Promise.resolve(loader.entity);
}

/**
 *
 * @param {*} condition
 */
function _resolveCondition(loader, condition) {
    // const uri = Url.parse(condition, true);
    // Log.debug('[_resolveCondition]', condition, uri);
    const uri = parseUrl( condition );
    // Log.debug('[_resolveCondition]', condition, uriM );

    if (uri.protocol == 'marked') {
        if (loader.markedEntities) {
            // Log.debug('[resolveCondition]', loader.markedEntities[uri.host].id );
            return loader.markedEntities[uri.host];
        }
    }
    // else if (uri.protocol == 'elsinore') {
    //     const componentUri = '/' + uri.host + uri.pathname;

    //     const query = Query.all(componentUri).where(
    //         uri.query.map( (val, attr) =>
    //             Query.attr(attr).equals(
    //                 tryParseInteger(loader.registry, componentUri, attr, val)
    //             )
    //         )[0]
    //     );

    //     const queryResult = loader.entitySet.query(query);
    //     // console.log('resolve to', entityToString(queryResult) );

    //     return queryResult.size() > 0;
    // }

    return null;
}

/**
 * 
 * @param {*} loader 
 * @param {*} incomingObj 
 * @param {*} options 
 */
function process(loader, incomingObj, options = {}) {
    let entity, component, markId;
    const { debug } = options;
    const entitySet = loader.entitySet;
    const registry = loader.registry;

    let [cmdType, cmd, cmdArg] = findCommand(incomingObj);
    let obj = incomingObj;

    if (!loader.allowCmdProcess) {
        return null;
    }

    if (debug) Log.debug('process', cmdType, cmd, JSON.stringify(obj));

    switch (cmd) {
        case CMD_DEFINE:
            loader.definitions || (loader.definitions = {});
            loader.definitions[cmdArg] = { ...omit(obj, cmd) }; // _.extend({}, _.omit(obj, cmd));
            break;

        case 'register':
        case CMD_REGISTER_COMPONENT:
            // Log.debug('registering', cmdArg);
            return registry.registerComponent(cmdArg);
        case CMD_IF:
        case CMD_IF_NOT:
            const condition = _resolveCondition(loader, cmdArg);
            loader.allowCmdProcess = cmd === CMD_IF_NOT ? !condition : condition;
            // console.log('resolve condition ', cmdArg, condition);
            break;

        case CMD_END_IF:
            loader.allowCmdProcess = true;
            break;

        case CMD_USE:
            if (!loader.definitions || !loader.definitions[cmdArg]) {
                return Promise.resolve(false); //return new Promise(r => r(false));
            }
            const fetchedCmd = Object.assign(
                {},
                loader.definitions[cmdArg],
                omit(obj, cmd)
            );
            return process(loader, fetchedCmd);

        case CMD_CREATE_ENTITY:
        case CMD_CREATE_ENTITY_ALT:
            return _createEntity(loader, obj);

        case CMD_FLUSH:
            return loader.flush();

        case CMD_CREATE_ENTITY_SET:
            try {
                loader.entitySet = registry.createEntitySet({ uuid: cmdArg.uuid });
            } catch (e) {
                loader.entitySet = registry.getEntitySet(cmdArg.uuid);
            }
            return Promise.resolve(loader.entitySet);
        // return new Promise(r => r(loader.entitySet));

        case CMD_ADD_ENTITY:
            markId = loader.entity._markId;
            // Log.debug(`[CMD_ADD_ENTITY]`, loader.entity.id, loader.entity.cid );

            if (obj[CMD_PRIMARY_KEY]) {
                loader.entity._primaryKey = obj[CMD_PRIMARY_KEY];
                delete obj[CMD_PRIMARY_KEY];
            }

            return addEntity(registry, entitySet, loader.entity).then(
                entity => {
                    loader.entity = null;

                    if (!entity) {
                        // the entity was not added for some reason
                        return null;
                    }
                    loader.lastEntityId = entity.id;

                    let [markId] = loader._findMark(obj);

                    if (markId) {
                        // this.entity._markId = markId;
                        loader.markedEntities || (loader.markedEntities = {});
                        loader.markedEntities[markId] = entity;
                        // Log.debug(`[CMD_ADD_ENTITY] created`, markId, entity.id, incomingObj);
                    }

                    // if( markId ){
                    //     Log.debug(`[CMD_ADD_ENTITY] marking`, entity.id, markId);
                    //     loader.markedEntities || (loader.markedEntities={});
                    //     loader.markedEntities[ markId ] = entity;
                    // }
                    return entity;
                }
            );
        
        default:
            // Log.debug('[default]', cmdType, 'cmd', cmd, stringify(obj) );
            return createComponent(loader, obj);
    }
    // .catch( e => console.log('test error: %s, %s', e, e.stack) )
}

// function tryParseInteger(registry, componentUri, attr, value) {
//     // TODO: this functionality should be moved to a dedicated value parse function
//     Log.debug('[tryParseInteger]', componentUri, attr, value);
//     let props = getProperties(registry.schemaRegistry, '/component/poi#woe-id');

//     if (props.type == 'integer') {
//         let parsed = parseInt(value, 10);
//         if (parsed == value) {
//             return parsed;
//         }
//     }

//     return value;
// }

function createComponent(loader, obj) {
    const entitySet = loader.entitySet;

    // determine whether any attributes are refering to marked pois
    obj = resolveMarkReferences(loader, obj);

    // the alternative form is to use @uri
    if (obj[CMD_COMPONENT_URI]) {
        obj[CMD_COMPONENT] = obj[CMD_COMPONENT_URI];
        delete obj[CMD_COMPONENT_URI];
    }

    if( obj[CMD_COMPONENT] === undefined ){
        throw new Error('invalid create component command');
    }

    const component = loader.registry.createComponent(obj);

    return Promise.resolve(component)
        .then(component => {
            if (!loader.entity) {
                return _createEntity(loader, null, { shadow: true });
            }
            // Log.debug('[createComponent]', 'adding to existing entity', loader.entity.id);
            return component;
        })
        .then(() => loader.entity.addComponent(component))
        .then(() => component);

    // loader.entity.addComponent( component );

    // return Promise.resolve(component);
}

/**
 *
 * @param {*} loader
 * @param {*} obj
 */
function resolveMarkReferences(loader, obj) {
    let key,
        value,
        match,
        component,
        componentAttr,
        markedEntity,
        componentSchema;
    const registry = loader.registry;
    const markedEntities = loader.markedEntities;

    if (!markedEntities) {
        return obj;
    }

    for (key in obj) {
        value = obj[key];
        match = value.toString().match(/@marked(:[\/\w]+)?(#[\w-]+)?/);
        // console.log('[resolveMarkReferences]', match);
        if (!match) {
            continue;
        }

        component = match[1];
        componentAttr = match[2];
        markedEntity = markedEntities[true];

        // console.log('[resolveMarkReferences]', component,markedEntity, markedEntities);
        if (!markedEntity) {
            continue;
        }
        if (!component) {
            obj[key] = markedEntity.id;
        } else if (component) {
            component = markedEntity.getComponentByIId(component.substr(1));
            // console.log('have schema', component);

            if (!componentAttr) {
                obj[key] = component.id;
            } else {
                componentAttr = componentAttr.substr(1);
                obj[key] = component.get(componentAttr);
            }
        }
    }
    return obj;
}

/**
 *
 * @param {*} registry
 * @param {*} entitySet
 * @param {*} entity
 */
function addEntity(registry, entitySet, entity) {
    if (!entity) {
        entity = registry.createEntity();
    }

    if (entity._primaryKey) {
        return upsertEntityByPrimaryKey(
            registry,
            entitySet,
            entity,
            entity._primaryKey
        );
    }

    // Log.debug('[addEntity]', 'adding entity', entity.id, entityToString(entity) );

    return Promise.resolve(entitySet.addEntity(entity)).then(() => {
        const updated = entitySet.getUpdatedEntities();
        // Log.debug('[addEntity]', 'returned entity', entity.id,  );
        return Array.isArray(updated) ? updated[0] : updated;
    });
}

/**
 *
 */
function upsertEntityByPrimaryKey(registry, entitySet, entity, primaryKey) {
    const uri = parseUrl(primaryKey);
    const componentUri = uri.pathname;
    const componentAttr = uri.hash;

    // Log.debug('[upsertEntityByPrimaryKey]', primaryKey, componentUri, componentAttr);

    // Log.debug('[upsertEntityByPrimaryKey] looking for entity pkey', entity._primaryKey, componentUri, componentAttr);
    // determine the value on the entity we have
    let componentValue = selectComponentAttr(
        entity,
        componentUri,
        componentAttr
    );
    // Log.debug('[upsertEntityByPrimaryKey] looking for existing val', componentUri, componentAttr, componentValue, entity.getComponentByIId(componentUri).hash(true) );

    if (!componentValue) {
        return Promise.resolve().then(() => entitySet.addEntity(entity));
    }

    return (
        Promise.resolve(true)
            // .then( () => printKeys(entitySet) )
            .then(() =>
                retrieveEntityByAttribute(
                    entitySet,
                    componentUri,
                    componentAttr,
                    componentValue
                )
            )
            .then(existing => {
                if (!existing) {
                    // Log.debug('[upsertEntityByPrimaryKey] no existing entity has ', componentUri, componentAttr, '=', componentValue);
                    // console.log('new: ', entity.Poi.getId(), entityToString(entity));
                    // printIns( entity.Poi );
                    return entitySet.addEntity(entity);
                }

                // Log.debug('[upsertEntityByPrimaryKey] existing: ', entityToString(existing));
                // Log.debug('[upsertEntityByPrimaryKey] new: ', entityToString(entity));
                // Log.debug('[upsertEntityByPrimaryKey] existing: ', entityToString(existing), existing.getComponentByIId(componentUri).hash(true) );

                let [copy, hasChanged] = cloneEntity(
                    entity,
                    existing,
                    { delete: true, returnChanged: true, debug:true }
                );


                if (hasChanged) {
                    copy._setId(existing.id);
                    // Log.debug('[upsertEntityByPrimaryKey] existing entity has changed ', componentUri, componentAttr, '=', componentValue);
                    // Log.debug('[upsertEntityByPrimaryKey] existing: ', entity.id );
                    // Log.debug('[upsertEntityByPrimaryKey] copy: ', copy.id );
                    // Log.debug('[upsertEntityByPrimaryKey] new: ', entityToString(entity));
                    // Log.debug('[upsertEntityByPrimaryKey] copy: ', entityToString(copy));
                    return entitySet.addEntity(copy, { debug: true });
                }
                // Log.debug('[upsertEntityByPrimaryKey] existing entity not changed ', componentUri, componentAttr, '=', componentValue);
                return null;
            })
    );
}

/**
 *   Copy src components over to dst, providing they are different
 *   returns a copy of the dstEntity with the components transferred
 */
function transferEntityComponents(srcEntity, dstEntity) {
    let result = false;
    let added = [],
        removed = [],
        changed = [];

    return result;
}

/**
    Retrieves the first entity which has the specified component attribute value
*/
async function retrieveEntityByAttribute(
    entitySet,
    componentId,
    attribute,
    value
) {
    // Log.debug('[retrieveEntityByAttribute]', componentId, 'where', attribute, 'equals', value);
    const query = Q => [
        Q.all(componentId).where(Q.attr(attribute).equals(value)),
        Q.limit(1)
    ];

    if (entitySet.isAsync) {
        const existing = await entitySet.query(query, { debug: false });

        // Log.debug('[retrieveEntityByAttribute]', entityToString( existing));
        if (existing.size() === 1) {
            return existing.at(0);
        }

        return null;
    } else {
        return Promise.resolve(true).then(() => {
            const existing = entitySet.query(query);
            // Log.debug('[retrieveEntityByAttribute]', 'query result', existing.size(), entityToString(existing), componentId, attribute, value );
            if (existing.size() === 1) {
                return existing.at(0);
            }
            return null;
        });
    }
}

function selectComponentAttr(entity, componentId, attr) {
    const component = entity.getComponentByIId(componentId);
    if (!component) {
        return null;
    }
    return component.get(attr);
}

function findCommand(obj) {
    if (obj[CMD_DEFINE]) {
        return [CMD_DEFINE, CMD_DEFINE, obj[CMD_DEFINE]];
    }
    if (obj[CMD_USE]) {
        return [CMD_USE, CMD_USE, obj[CMD_USE]];
    }
    if (obj[CMD_COMMAND]) {
        return [CMD_COMMAND, obj[CMD_COMMAND], omit(obj, CMD_COMMAND)];
    }
    if (obj[CMD_IF]) {
        return [CMD_IF, CMD_IF, obj[CMD_IF]];
    }
    if (obj[CMD_END_IF]) {
        return [CMD_END_IF, CMD_END_IF, obj[CMD_END_IF]];
    }
    return [CMD_UNKNOWN, null];
}

Loader.create = function(registry) {
    let loader = new Loader();
    loader.allowCmdProcess = true;
    loader.registry = registry;

    return loader;
};
