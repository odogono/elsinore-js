import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import { AsyncEntitySet } from '../src/entity_set/async';
import { Entity } from '../src/entity';
import { Component } from '../src/component';
import { Registry } from '../src/registry';
import { createLog } from '../src/util/log';

import {
    initialiseRegistry,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    entityToString,
    captureEntitySetEvent
} from './common';

const Log = createLog('TestEntitySetAsync');

const createOptions = { type: AsyncEntitySet, entityIDStart: 100, componentIDStart: 10 };
const createOptionsNothingRegistered = { ...createOptions, loadComponents: false };

test('type of entityset', async t => {
    try {
        const [registry, entitySet] = await initialiseAll(createOptions);

        t.ok(entitySet.isEntitySet, 'it is an entitySet');
        t.ok(entitySet.isAsync, 'it is async');
        t.equals(entitySet.type, 'AsyncEntitySet');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});




test('adding an entity with a component returns the added entity', async t => {
    try {
        const [registry, entitySet] = await initialiseAll(createOptions);

        // logEvents( entitySet );
        const entity = registry.createEntity([{ '@c': '/component/position', x: 2, y: -2 }]);

        const addedEntity = await entitySet.addEntity(entity);

        // Log.debug(entityToString(entitySet));

        t.equals(addedEntity.getEntitySetID(), entitySet.getEntitySetID(), 'entityset ids should be equal');

        t.equals(addedEntity.Position.get('y'), -2);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

// test.only('getUpdatedEntities returns ids of added/updated entities', async t => {
//     try {
//         const [registry, entitySet] = await initialiseAll(createOptions);

//         await entitySet.addComponent([
//             registry.createComponent('/component/flower', { colour: 'violet' })
//         ]);

//         let added = entitySet.getUpdatedEntities();

//         Log.debug('added', added);

//         t.end();
//     } catch( err ){
//         Log.error( err.stack );
//     }
// });

test('adding several components without an entity adds them to the same new entity', async t => {
    try {
        // t.plan(5);

        const [registry, entitySet] = await initialiseAll(createOptions);

        // logEvents( entitySet );
        captureEntitySetEvent(entitySet, 'entity:add', false, ids =>
            t.ok(ids.length, 'entity:add should have been called')
        );

        await entitySet.addComponent([
            registry.createComponent('/component/flower', { colour: 'yellow' }),
            registry.createComponent('/component/radius', { radius: 2 })
        ]);

        let added = entitySet.getUpdatedEntities();
        // const addedComponents = await entitySet.addComponent(components);

        // t.equals( addedComponents.length, 2 );

        // Log.debug( entityToString(added) );

        // Log.debug(entityToString(entitySet));

        // // Log.debug('[get]', addedComponents);

        const entityID = added.getEntityID();
        const entity = await entitySet.getEntity(entityID);

        // Log.debug( entityToString(entity) );
        // console.log('wtf', entity);

        t.assert(entity.Flower, 'the entity should have a Flower component');
        t.assert(entity.Radius, 'the entity should have a Radius component');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity with only one component', async t => {
    try {
        t.plan(3);

        const [registry, entitySet] = await initialiseAll(createOptions);
        // logEvents(entitySet);

        captureEntitySetEvent(entitySet, 'component:remove', false, ids =>
            t.ok(ids.length, 'component:remove should have been called')
        );

        captureEntitySetEvent(entitySet, 'entity:remove', false, ids =>
            t.ok(ids.length, 'entity:remove should have been called')
        );

        // captureEntitySetEvent(entitySet, 'entity:remove', true, ids => Log.debug('remove entity',ids) );

        const component = registry.createComponent('/component/position', { x: 15, y: 2 });

        const addedComponent = await entitySet.addComponent(component);
        const addedEntityID = addedComponent.getEntityID();

        // Log.debug('and remove');
        await entitySet.removeComponent(addedComponent);

        // Log.debug( 'remove', entityToString(addedComponent) );
        // Log.debug( entityToString(entitySet) );

        const entity = await entitySet.getEntityByID(addedEntityID, false);

        t.ok(_.isNull(entity), 'no entity should be returned');

        await finalise(t, registry);
    } catch (err) {
        Log.error('test error', err.message, err.stack);
    }
});

test('registers existing component defs with the registry when opened', async t => {
    const schemaA = { uri: '/component/channel', properties: { name: { type: 'string' } } };
    const schemaB = { uri: '/schema/alpha', properties: { channel: { type: 'string' } } };

    let [registry, entitySet] = await initialiseAll(createOptionsNothingRegistered);

    try {
        await entitySet.registerComponentDef([schemaA, schemaB]);

        await registry.removeEntitySet(entitySet);

        registry = new Registry();

        t.equals(registry.getComponentDef('/component/channel'), null);

        let output = await registry.addEntitySet(entitySet);

        t.notEqual(registry.getComponentDef('/component/channel'), null);

        // let defs = await entitySet.getComponentDefs();
        // _.each( defs, cd => console.log( `${cd.getUri()} ${cd.hash()}`  ));

        const component = registry.createComponent('/component/channel', { name: 'nine' });

        t.equal(component.get('name'), 'nine');
    } catch (err) {
        Log.error(err.stack);
    }
    await finalise(t, registry);
});

test('adding an entityset with registered components to a new registry', async t => {
    const schemaA = { uri: '/component/channel', properties: { name: { type: 'string' } } };
    let schemaB = { uri: '/component/topic', properties: { topic: { type: 'string' } } };
    let schemaC = { uri: '/component/status', properties: { status: { type: 'string' } } };

    const registry = new Registry();

    let entitySet = await registry.createEntitySet(createOptions);

    await registry.registerComponent([schemaA, schemaB, schemaC]);

    let anotherRegistry = new Registry();

    await anotherRegistry.addEntitySet(entitySet);

    t.deepEqual(anotherRegistry.getComponentDefs().map(d => d.getUri()), [
        '/component/channel',
        '/component/topic',
        '/component/status'
    ]);

    t.end();
});

test('returns the newest version of the schema', async t => {
    // let registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
    const schemaA = { uri: '/component/channel', properties: { name: { type: 'string' } } };
    const schemaB = { uri: '/component/channel', properties: { channel: { type: 'string' } } };

    let [registry, entitySet] = await initialiseAll(createOptionsNothingRegistered);

    await entitySet.registerComponentDef(schemaA);
    await entitySet.registerComponentDef(schemaB);

    let cDef = await entitySet.getComponentDef('/component/channel');

    t.ok(cDef.getProperties().channel, 'the 2nd version is the one returned');

    t.end();
});

test('registering the same schema again throws an error', async t => {
    t.plan(1);

    const schemaA = { uri: '/component/channel', properties: { name: { type: 'string' } } };

    let [registry, entitySet] = await initialiseAll(createOptionsNothingRegistered);

    await entitySet.registerComponentDef(schemaA);

    try {
        await entitySet.registerComponentDef(schemaA);
    } catch (err) {
        t.equal(err.message, 'def /component/channel (556eb652) already exists');
    }
    t.end();
});

test('adding an existing entity changes its id if it didnt originate from the entityset', async t => {
    let [registry, entitySet] = await initialiseAll({ '@es': 205, ...createOptions });

    const entity = registry.createEntity({ '@c': '/component/flower', colour: 'white' }, { '@e': 12 });

    let added = await entitySet.addEntity( entity );

    t.notEqual(added.getEntityID(), 12, 'the entity id will have been changed');
    t.equal(added.getEntitySetID(), 205, 'the entityset id will have been set');

    t.end();
});

test('adding an existing entity doesnt changes its id if it originated from the entityset', async t => {
    try {
        const [registry, entitySet] = await initialiseAll({ '@es': 205, ...createOptions });
        // entitySet.on('all', eventSpy);
        const entity = registry.createEntity({ '@c': '/component/flower', colour: 'white' }, { '@e': 12, '@es': 205 });

        // Log.debug('es', entityToString(entity));

        t.equal(entity.getEntitySetID(), 205, 'the entityset id will have been set');

        const added = await entitySet.addEntity(entity);

        t.equal(entitySet.id, 205);

        t.equal(added.getEntitySetID(), 205, 'the entityset id will have been set');

        t.equal(added.getEntityID(), 12, 'the entity id will have been changed');

        // Log.debug('es', entityToString(entitySet));

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an entity with an identical id will replace the existing one', async t => {
    try {
        const [registry, entitySet] = await initialiseAll({ '@es': 1, ...createOptions });

        const entityA = registry.createEntity({ '@c': '/component/position', x: 0, y: 0 }, { '@e': 45, '@es': 1 });

        const entityB = registry.createEntity(
            [{ '@c': '/component/position', x: 15, y: -90 }, { '@c': '/component/status', status: 'active' }],
            { '@e': 45, '@es': 1 }
        );

        // logEvents(entitySet);

        await entitySet.addEntity(entityA);

        // Log.debug(entityToString(entitySet));
        let entity = entitySet.at(0);

        // console.log('>===');

        await entitySet.addEntity(entityB, { debug: false });

        entity = await entitySet.getEntityByID(45);

        // console.log( entity );
        // Log.debug(entityToString(entitySet));

        // Log.debug( entitySet._components.map( c=>[c.id,c.cid,c.getDefID(),c.getEntityID()] ) );

        t.equals(entity.Status.get('status'), 'active');

        t.equals(entity.Position.get('x'), 15);

        // return entitySet.addEntity( entity )
        //     .then( entity => {
        //         t.equal( entity.getEntitySetID(), 205, 'the entityset id will have been set' );
        //         t.equal( entity.getEntityID(), 12, 'the entity id will have been changed' );
        //     })

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('deferred adding of entities', async t => {
    const [registry, entitySet] = await initialiseAll(createOptions);
    try {
        await entitySet.addEntity(
            [
                registry.createEntity({ '@c': '/component/channel', name: '#javascript' }),
                registry.createEntity({ '@c': '/component/channel', name: '#nodejs' })
            ],
            { execute: false }
        );

        await entitySet.addEntity(
            [
                registry.createEntity({ '@c': '/component/channel', name: '#dotnet' }),
                registry.createEntity({ '@c': '/component/channel', name: '#elixir' })
            ],
            { execute: false }
        );

        // entitySet._echo('>---');
        t.equals(entitySet.size(), 0);

        await entitySet.flush();

        // Log.debug(entityToString(entitySet));

        t.equals(entitySet.size(), 4);
        // Log.debug('all good', entityToString(entitySet) );
    } catch (err) {
        Log.error('test error', err.message, err.stack);
    }
    await finalise(t, registry);
});

function initialiseAll(options) {
    return initialiseRegistry(options).then(registry => {
        return registry.createEntitySet(options).then(es => [registry, es]);
    });
}

function finalise(t, registry) {
    return registry
        .removeAllEntitySets()
        .catch(err => console.log('finalize error:', err))
        .then(() => t.end());
}
