import _ from 'underscore';

import Fs from 'fs';
import Path from 'path';
import Util from 'util';

const rootDir = Path.join(Path.dirname(__filename), '../../');
const fixtureDir = Path.join(rootDir, 'test', 'fixtures');
const varDir = Path.join(rootDir, 'var');

const ElsinoreDir = Path.join(rootDir, 'src');

import { stringify } from '../../src/util/stringify';
export { stringify };

export * from '../../src/util/id';
export * from '../../src/util/is';
export * from '../../src/util/to';

import { createLog } from '../../src/util/log';
import { toString as entityToString } from '../../src/util/to_string';
export { createLog };
export { toString as entityToString } from '../../src/util/to_string';

import { Component } from '../../src/component';
export { Component };

import { EntityFilter } from '../../src/entity_filter';
export { EntityFilter };

import { EntityProcessor } from '../../src/entity_processor';
export { EntityProcessor };

import { EntitySet } from '../../src/entity_set';
export { EntitySet };

import { Entity } from '../../src/entity';
export { Entity };

import { Query } from '../../src/query/full';
export { Query };

import { Registry } from '../../src/registry';
export { Registry };

import { ComponentRegistry } from '../../src/schema';
export { ComponentRegistry };

import { EntityDispatch } from '../../src/dispatch';
export { EntityDispatch };

import { isEntitySet, isEntity } from '../../src/util/is';


const Log = createLog('Test');

// compile a map of schema id(uri) to schema
export function loadComponents(options = {}) {
    let data = loadFixtureJSON('components.json');
    if (options.returnAsMap) {
        return _.reduce(
            data,
            function(memo, entry) {
                memo[entry.uri] = entry;
                return memo;
            },
            {}
        );
    }
    return data;
}

/**
 *   Returns an entityset with the given entities
 */
export function loadEntities(registry, fixtureName, entitySet, options = {}) {
    let data;
    let lines;
    let result;

    fixtureName = fixtureName || 'entity_set.entities.json';
    registry = registry || initialiseRegistry(options);
    result = registry.createEntitySet({ instanceClass: entitySet, ...options });

    if (_.isString(fixtureName)) {
        if (fixtureName.indexOf('.json') === -1) {
            fixtureName = fixtureName + '.json';
        }
        data = loadFixture(fixtureName);
        data = JSON.parse(data);
    } else if (_.isObject(fixtureName)) {
        data = fixtureName;
    } else {
        throw new Error('invalid fixture name specified');
    }

    _.each(data, line => {
        let com = registry.createComponent(line);
        result.addComponent(com);
        return com;
    });

    return result;
}

/**
 *
 */
export async function initialiseRegistry(doLogEvents) {
    let componentData;
    let registry = new Registry();
    let options, load;

    if (_.isObject(doLogEvents)) {
        options = doLogEvents;
        doLogEvents = options.doLogEvents;
    }
    if (doLogEvents) {
        // log.debug('logging events');
        logEvents(registry);
    }

    options = options || {};
    load = options.loadComponents === void 0 ? true : options.loadComponents;

    if (load) {
        componentData = loadComponents();
        // log.debug('loaded components ', componentData);// + JSON.stringify(options) );
        // printIns( componentData );
        await registry.registerComponent(componentData, options);
    }

    return registry;
}

export function loadFixture(fixturePath) {
    let path = Path.join(fixtureDir, fixturePath);
    // console.log('loadFixture', path);
    let data = Fs.readFileSync(path, 'utf8');
    return data;
}

export function loadFixtureJSON(fixturePath) {
    try {
        let data = loadFixture(fixturePath);
        data = JSON.parse(data);
        return data;
    } catch (e) {
        log.debug('error loading fixture JSON: ' + e);
        return null;
    }
}

export function logEvents(obj, prefix = 'evt') {
    if (isEntitySet(obj)) {
        obj.on('entity:add', entities => Log.info(prefix, 'entity:add', stringify(entities.map(e => e.id)))); //stringify(entities)) );
        obj.on('entity:update', entities => Log.info(prefix, 'entity:update', stringify(entities)));
        obj.on('entity:remove', entities => Log.info(prefix, 'entity:remove', stringify(entities.map(e => e.id))));
        obj.on('component:add', components => Log.info(prefix, 'component:add', entityToString(components)));
        obj.on('component:update', components => Log.info(prefix, 'component:update', entityToString(components)));
        obj.on('component:remove', components => Log.info(prefix, 'component:remove', entityToString(components)));
    }
    // obj.on('all', function(evt){
    //     Log.debug(prefix + ' ' + stringify( _.toArray(arguments) ) );
    // });
}

export function captureEntitySetEvent(entitySet, evt, returnEntityIds = false, cb) {
    entitySet.on(evt, result => {
        // Log.debug('[captureEntitySetEvent]', evt, stringify(result));
        cb(result.map(e => (returnEntityIds ? e.getEntityId() : e.id)));
    });
}

const toStringPath = Path.join(ElsinoreDir, 'util/to_string');

export function printE(e, prefix = '') {
    Util.log(prefix, entityToString(e));
}

// global.log = {
//     debug: console.log,
//     error: console.log
// };

export function requireLib(path) {
    return require(Path.join(ElsinoreDir, path));
}
