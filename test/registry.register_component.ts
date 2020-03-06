import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    Component,
    Entity,
    EntityFilter,
    EntitySet,
    Registry,
    Query,
    initialiseRegistry,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    entityToString,
    createLog
} from './common';

const Log = createLog('RegistryRegisterComponent');

const COMPONENT_DEFINITIONS = [
    { uri: '/component/position', properties: { x: 0, y: 0, z: 0, rotation: 0 }, name: 'Position', hash: 'bd12d7de' },
    { uri: '/component/radius', properties: { radius: 0 }, name: 'Radius' },
    { uri: '/component/status', properties: { status: 'active' }, name: 'Status' },
    { uri: '/component/name', properties: { name: '' }, name: 'Name', hash: 'c6c1bcdf' },
    { uri: '/component/geo_location', properties: { lat: 0, lng: 0 }, name: 'Geolocation' }
];

test('testing an async register component', t => {
    const registry = Registry.create();
    const Listener = Object.assign({}, Events);

    Listener.on('register', componentDef => {
        t.equals(componentDef.getUri(), '/component/position');
        t.end();
    });

    return registry
        .createEntitySet({ type: AsyncEntitySet, listener: Listener })
        .then(es => registry.registerComponent(COMPONENT_DEFINITIONS[0]))
        .catch(err => Log.error(err.stack));
});

test('registering multiple component defs', t => {
    const registry = Registry.create();
    const Listener = Object.assign({}, Events);

    Listener.on('register', componentDef => {
        t.ok(componentDef.getUri());
    });

    return registry
        .createEntitySet({ type: AsyncEntitySet, listener: Listener })
        .then(es => registry.registerComponent([COMPONENT_DEFINITIONS[0], COMPONENT_DEFINITIONS[1]]))
        .catch(err => Log.error(err.stack))
        .then(() => t.end());
});

class AsyncEntitySet extends EntitySet {
    constructor(entities, options = {}) {
        super();
        this.listener = options.listener;
    }

    open(options = {}) {
        this._open = true;
        return Promise.resolve(this);
    }

    close() {
        this._open = false;
        return Promise.resolve(this);
    }

    isOpen() {
        return this._open;
    }

    destroy(options = {}) {
        return Promise.resolve(this);
    }

    registerComponentDef(def, options = {}) {
        this.listener.trigger('register', def);
        return Promise.resolve(this);
    }
}

Object.assign(AsyncEntitySet.prototype, {
    type: 'AsyncEntitySet',
    isAsyncEntitySet: true,
    isMemoryEntitySet: false,
    isAsync: true
});

AsyncEntitySet.create = function(options = {}) {
    let result = new AsyncEntitySet(options);
    return result;
};
