import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Component,
    Entity,
    EntityFilter,
    EntitySet,
    Registry,
    ComponentRegistry,
    initialiseRegistry,
    isInteger,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    stringify,
    entityToString,
    logEvents,
    createLog,
    captureEntitySetEvent
} from './common';

import { cloneEntity, cloneComponent } from '../src/util/clone';

const Log = createLog('TestEntitySet');

test('type of entityset', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();
        t.ok(entitySet.isEntitySet, 'it is an entitySet');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('entityset has a uuid assigned', async t => {
    try {
        const registry = await initialiseRegistry();
        let es = registry.createEntitySet();
        t.equals(es.getUUID().length, 36);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('non existence of an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();
        t.ok(!entitySet.hasEntity(1001), 'entity not exist');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

// test('adding an entity to an entityset adds a reference to that entityset', async t => {
//     try {
//         const registry = await initialiseRegistry();
//         let entitySet = registry.createEntitySet();

//         entitySet.addEntity({ '@c': '/component/name', name: 'kai' });

//         t.end();
//     } catch (err) {
//         Log.error(err.stack);
//     }
// });

test('added components have a reference to their containing entityset');

test('adding an entity to an entityset adds a reference to that entityset', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        let entity = registry.createEntity({ '@c': '/component/name', name: 'kai' });

        // Log.debug('ok good', entity.Name.cid);

        entitySet.addEntity(entity);

        let esEntity = entitySet.getUpdatedEntities();

        // Log.debug('added', esEntity.Name.cid);

        t.notEqual(entity, esEntity);

        // entitySet.addEntity({'@c':'/component/name', name:'kai'});

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('retrieving the entity that was added', async t => {
    try {
        const registry = await initialiseRegistry();

        let entitySet = registry.createEntitySet();

        // logEvents( entitySet );

        entitySet.addEntity([{ '@c': '/component/position', x: 2, y: -2 }], { debug: false });

        const entity = entitySet.getUpdatedEntities();

        // Log.debug( entityToString(entitySet));

        // console.log( entitySet );
        t.ok(entity.getEntityId() > 0, 'the entity should have an id');
        t.ok(entitySet.hasEntity(entity.id), 'the entity should exist');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('retrieving an entity by its id', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        entitySet.addEntity([{ '@c': '/component/position', x: 2, y: -2 }], { debug: false });
        const entity = entitySet.getUpdatedEntities();

        // Log.debug('getting', entity.getEntityId() );
        // Log.debug('getting', entitySet.getById(2, true) );
        // Log.debug( entitySet._entities );

        t.equals(entitySet.getByEntityId(entity.getEntityId()).getEntityId(), entity.getEntityId());

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding components in the same call adds them to the same entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        entitySet.addComponent(
            [
                { '@c': '/component/name', name: 'home' },
                registry.createComponent('/component/geo_location', { lat: 51.2, lng: -3.65 })
            ],
            { debug: false }
        );

        t.equal(entitySet.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('can add a raw component directly', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        // this action creates an entity to house the component
        entitySet.addComponent({ '@c': '/component/position', x: -14, y: 12 });

        t.equal(entitySet.size(), 1);
        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('can add an array of raw components', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        // a single entity is created
        entitySet.addComponent(
            [{ '@c': '/component/position', x: -14, y: 12 }, { '@c': '/component/radius', radius: 16 }],
            { debug: false }
        );

        t.equal(entitySet.size(), 1);

        // Log.debug('[es]', entityToString(entitySet));

        t.equal(entitySet.at(0).Position.get('x'), -14);

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('adding several components returns an array of added components', async t => {
    let entities;
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        let components = [{ '@c': '/component/position', x: 20, y: 4 }, { '@c': '/component/radius', radius: 5 }];

        entitySet.addComponent(components);

        // Log.debug('[es]', entityToString(components) );
        // Log.debug('[es]', components);
        // Log.debug('[es]', entityToString(entitySet));

        let added = entitySet.getUpdatedComponents();

        t.equals(added.length, 2, '2 components added');
        t.ok(Component.isComponent(added[0]), 'returns an array of components');

        // Log.debug('1 look at that', entityToString(added) );

        // direct addition of a component to an entity also works
        entitySet.addComponent({ '@c': '/component/name', name: 'oro', '@e': 2 });
        added = entitySet.getUpdatedComponents();

        // Log.debug('2 look at that', entityToString(added) );
        t.ok(Component.isComponent(added), 'returns an array of components');

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('adding a component without an id or an entity id creates a new component and a new entity', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();
        let receivedEntityAdd = false;

        entitySet.on('entity:add', entities => (receivedEntityAdd = true));

        entitySet.addComponent({ '@c': '/component/position', x: 15, y: 2 });

        let component = entitySet.getUpdatedComponents();

        t.ok(receivedEntityAdd, 'entity:add should have been called');

        t.notStrictEqual(
            entitySet.at(0).Position,
            undefined,
            'the entity should have the Position component as a property'
        );

        t.equals(component.get('x'), 15, 'returned value should be a component');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('events contain the internal id of their originator', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        entitySet.on('entity:add', (entities, { cid, oid }) => {
            t.ok(Array.isArray(entities), 'an array is passed as the first arg');
            t.equals(entities.length, 1, 'the array contains one element');
            t.ok(Entity.isEntity(entities[0]), 'that first element is an Entity');
            t.equals(entitySet.cid, cid);
            t.equals(oid, 'test1', 'the Originating ID is passed through from the add');
            t.end();
        });

        entitySet.addEntity({ '@c': '/component/name', name: 'alice' }, { oid: 'test1' });
    } catch (err) {
        Log.error(err.stack);
    }
});

test('when adding a new entity, only the entity add event is emitted, not the component add', async t => {
    try {
        t.plan(1);

        // the trick here is that when an entity is added, it is broken down into components
        // and each component is added - so the ES has to supress the component events

        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        // entitySet.on('all', (name,items) => console.log('[all]', name, items.map(i=>i.getEntityId())) );
        // entitySet.on('component:add', components => components.map(c => c.getEntityId()) )
        // entitySet.on('entity:add', entities => entities.map(e => e.getEntityId()) );

        // entitySet.on('entity:add', (...args) => {
        //     Log.debug('EADD', args);
        // });

        entitySet.on('component:add', () => t.ok(false, 'should not have been called'));
        entitySet.on('entity:add', () => t.ok(true, 'should have been called'));

        entitySet.addEntity({ '@c': '/component/name', name: 'alice' });

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an identical component does not emit an event', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        // logEvents( entitySet );

        entitySet.on('component:update', (...args) => {
            Log.debug('CADD', stringify(args));
            t.ok(false, 'no component update should have been called');
        });

        entitySet.addEntity({ '@c': '/component/name', name: 'alice' });

        let component = entitySet.getUpdatedComponents();

        // Log.debug('[OK]', entityToString(component) );

        // the exact same component shouldn't trigger an update
        entitySet.addComponent(component);

        let duplicate = { '@c': '/component/name', name: 'alice', '@e': component.getEntityId() };

        entitySet.addComponent(duplicate, { debug: false });

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('retrieving a component by id', async t => {
    try {
        const registry = await initialiseRegistry();

        const entitySet = registry.createEntitySet();

        entitySet.addEntity({ '@c': '/component/position', x: 46, y: 12 });

        // Log.debug('[es]', entityToString(entitySet));

        const entity = entitySet.at(0);
        const component = entitySet.getComponent(entity.Position.id);

        t.equals(component.get('x'), 46);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('updating a component in the entityset', async t => {
    try {
        const registry = await initialiseRegistry();

        const entitySet = registry.createEntitySet();
        // logEvents(entitySet);
        const component = registry.createComponent('/component/position', { x: 200, y: 0 });

        t.equals(component.id, 0, 'the component should be created without a valid id');

        entitySet.addComponent(component);

        let inserted = entitySet.getUpdatedComponents();

        t.ok(inserted.id > 0, 'the component will have been assigned an id of ' + inserted.id);

        t.notEqual(component.id, inserted.id, 'the inserted component is a different copy');

        // change the fields of the component
        // note - if we changed the attributes of the inserted component, it would also
        // change inside the entityset
        component.set({ x: 200, y: 100, id: inserted.id });

        entitySet.addComponent(component);

        // change the fields and insert again
        component.set({ x: 200, y: -200 });

        entitySet.addComponent(component, { debug: false });

        // Log.debug('[es]', entityToString(entitySet));

        t.equals(entitySet.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding a component emits an event', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        entitySet.on('entity:add', entities => {
            // Log.debug('[added]', entityToString(entities));
            t.equals(entities[0].Position, entitySet.at(0).Position, 'the same component is emitted');
            t.end();
        });

        entitySet.addComponent({ '@c': '/component/position', x: 25, y: -9 });
        // Log.debug( entityToString(entitySet) );
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity with only one component', async t => {
    try {
        const registry = await initialiseRegistry();

        const entitySet = registry.createEntitySet();
        let receivedComponentRemove = false;
        let receivedEntityRemove = false;

        entitySet.on('component:remove', () => (receivedComponentRemove = true));
        entitySet.on('entity:remove', () => (receivedEntityRemove = true));

        // logEvents(entitySet);

        entitySet.addComponent({ '@c': '/component/position', x: 15, y: 2 });
        let added = entitySet.getUpdatedComponents();

        entitySet.removeComponent(added, { debug: false });

        // Log.debug( entityToString(entitySet) );

        t.ok(receivedComponentRemove, 'component:remove should have been called');
        t.ok(receivedEntityRemove, 'entity:remove should have been called');
        // t.equals( component.getEntityId(), 0, 'component should not have an entity id');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity triggers entity:update', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        t.plan(1);

        entitySet.on('entity:update', () => t.ok(true, 'entity:update received'));

        // logEvents( entitySet );

        entitySet.addComponent([
            { '@c': '/component/position', x: 5, y: 20 },
            { '@c': '/component/radius', radius: 5 }
        ]);
        let added = entitySet.getUpdatedEntities();

        entitySet.removeComponent(added.Radius, { debug: false });

        // Log.debug( entityToString(entitySet) );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an identified component in another entity replaces the existing', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        entitySet.addEntity({ '@c': '/component/position', x: 100, y: 50, id: 22 });
        let entity = entitySet.getUpdatedEntities();
        entitySet.addComponent({ '@c': '/component/position', x: 22, y: -9, id: 22 });
        let component = entitySet.getUpdatedComponents();

        t.equals(entity.id, component.getEntityId());
        t.equals(entitySet.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an identified component in another entity replaces the existing', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        let entityRemovedId = 0;

        entitySet.on('entity:remove', entities => (entityRemovedId = entities[0].id));

        // logEvents(entitySet);

        entitySet.addEntity({ '@c': '/component/position', x: 100, y: 50, id: 22 });
        let firstEntity = entitySet.getUpdatedEntities();

        entitySet.addEntity([{ '@c': '/component/position', x: 22, y: -9, id: 22 }]);
        let secondEntity = entitySet.getUpdatedEntities();

        // Log.debug( entityToString(entitySet) );

        // the first entity will have been removed
        t.equal(firstEntity.id, entityRemovedId);
        t.notEqual(firstEntity.id, secondEntity.id);
        t.equals(entitySet.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity with multiple components', async t => {
    try {
        const [registry, entitySet] = await initialise();
        let componentRemovedId = 0;

        entitySet.on('component:remove', components => (componentRemovedId = components[0].id));

        let entity = entitySet.addEntity([
            { '@c': '/component/position', x: -100, y: 20, id: 13 },
            { '@c': '/component/radius', radius: 30 }
        ]);

        let component = entitySet.removeComponent(13);

        t.equals(componentRemovedId, 13, 'component:remove should have been called');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('you cant add an empty entity to an entityset', t => {
    return initialiseRegistry()
        .then(registry => {
            let entitySet = registry.createEntitySet();

            let e = registry.createEntityWithId(43);

            entitySet.addEntity(e);

            t.equals(entitySet.size(), 0);

            t.end();
        })
        .catch(err => Log.error(err.stack));
});

test('adding several components without an entity adds them to the same new entity', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        t.plan(3);
        captureEntitySetEvent(entitySet, 'entity:add', false, ids =>
            t.ok(ids.length, 'entity:add should have been called')
        );

        entitySet.addComponent([
            registry.createComponent('/component/flower', { colour: 'yellow' }),
            registry.createComponent('/component/radius', { radius: 2 })
        ]);

        t.notStrictEqual(entitySet.at(0).Flower, undefined, 'the entity should have a Flower component');

        t.notStrictEqual(entitySet.at(0).Radius, undefined, 'the entity should have a Radius component');

        return t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding a component generates events', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        captureEntitySetEvent(entitySet, 'component:add', false, ids =>
            t.ok(ids.length, 'component:add should have been called')
        );
        captureEntitySetEvent(entitySet, 'entity:add', false, ids =>
            t.ok(ids.length, 'entity:add should have been called')
        );

        entitySet.addComponent(registry.createComponent('/component/position', { id: 160, '@e': 15, x: 0, y: 20 }));

        return t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding several components at once generates a single add event', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        // logEvents( entitySet );

        t.plan(2);

        // only a single entity add event is called
        // captureEntitySetEvent(entitySet, 'component:add', false, ids =>
        //     t.ok(ids.length, 'component:add should have been called')
        // );
        captureEntitySetEvent(entitySet, 'entity:add', false, ids =>
            t.ok(ids.length, 'entity:add should have been called')
        );

        entitySet.addComponent([
            { '@c': '/component/position', id: 1, '@e': 2, x: 19, y: -2 },
            { '@c': '/component/nickname', id: 2, '@e': 2, nick: 'isaac' }
        ]);

        t.equals(entitySet.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an entity with components', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        t.plan(2);
        // captureEntitySetEvent(entitySet, 'component:add', false, ids =>
        //     t.equals(ids.length, 2, 'component:add should have been called')
        // );
        captureEntitySetEvent(entitySet, 'entity:add', false, ids =>
            t.equals(ids.length, 1, 'entity:add should have been called')
        );

        let entity = registry.createEntityWithId(16);

        entity.addComponent({ '@c': '/component/position', id: 5, x: 2, y: -2 });
        entity.addComponent({ '@c': '/component/score', id: 6, score: 100 });
        entitySet.addEntity(entity);

        // t.equals(eventSpy.callCount, 2, 'two events should have been emitted');
        // t.ok(eventSpy.calledWith('component:add'), 'component:add should have been called');
        // t.ok(eventSpy.calledWith('entity:add'), 'entity:add should have been called');
        t.equals(entitySet.at(0).Position.get('x'), 2);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should return the number of entities contained', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        //
        const pos = registry.createComponent('/component/position', { id: 1, '@e': 3 });
        const nick = registry.createComponent('/component/nickname', { id: 2, '@e': 3 });

        t.ok(pos.getEntityId(), 3);
        t.ok(nick.getEntityId(), 3);

        entitySet.addComponent(pos);
        // t.equals( entitySet.size(), 1, 'should only be one entity' );
        // logEvents( entitySet );
        entitySet.addComponent(nick);
        // printE( entitySet );
        t.equals(entitySet.size(), 1, 'should only be one entity');

        // retrieve an entity by id 3
        const entity = entitySet.getEntity(3);

        // Log.debug( entitySet.at(0).id + ' is e id ' + entitySet.id );
        t.ok(entity.Position, 'entity should have position');
        t.ok(entity.Nickname, 'entity should have nickname');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should return an added entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySetA = registry.createEntitySet();
        const entitySetB = loadEntities(registry);

        // add the component from the B set to the A set
        const entityB = entitySetB.at(0);
        entitySetA.addComponent(entityB.Position);

        const entityA = entitySetA.at(0);

        // Log.debug(entityToString(entity));
        // Log.debug(entityToString(entityA));

        // Log.debug(entity.Position.id, entityA.Position.id );

        t.equals(entityA.getEntityId(), entityB.getEntityId(), 'the component retains its entity id');

        // components added to 'memory' entitysets retain their id - other types
        // of entityset (e.g. persistent) may take ownership of the component by changing the id
        t.equals(entityA.Position.id, entityB.Position.id, 'the added component has the same id');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should remove the entities component', t => {
    return initialiseRegistry().then(registry => {
        let entitySet = registry.createEntitySet();

        entitySet.addEntity(registry.createEntity([{ '@c': '/component/realname', name: 'tom smith' }]));
        let entity = entitySet.getUpdatedEntities();

        // entity = entitySet.addEntity( registry.createEntity( {'@c':'/component/realname', name:'tom smith'} ) );
        entitySet.removeComponent(entity.Realname);

        t.equals(entitySet.size(), 0, 'the entityset will have removed the empty entity');
        t.notOk(entity.hasComponents(), 'the single entity should have no components');

        t.end();
    });
});

test('should remove the entity belonging to a component', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet({ allowEmptyEntities: false });
        let eventSpy = Sinon.spy();

        let entity = registry.createEntityWithId(9);
        entity.addComponent(registry.createComponent('/component/realname', { id: 3, name: 'tom smith' }));

        entitySet.addComponent(entity.Realname);
        entitySet.removeComponent(entity.Realname);

        t.equals(entitySet.size(), 0, 'the entityset should have no entities');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should remove a component reference from an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities(registry);
        entitySet.addEntity(entities.at(0));
        let addedEntity = entitySet.getUpdatedEntities();

        t.ok(addedEntity.Realname !== undefined, 'the entity should have the Realname component');

        entitySet.removeComponent(addedEntity.Realname);

        addedEntity = entitySet.at(0);

        t.ok(addedEntity.Realname === undefined, 'the entity should not have the Realname component');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should add an entity only once', t => {
    return initialiseRegistry()
        .then(registry => {
            let entitySet = registry.createEntitySet();
            let eventSpy = Sinon.spy();

            let entities = loadEntities(registry);

            let entity = entities.at(0);

            // Common.logEvents( entitySet );
            entitySet.addEntity(entity);
            t.equals(entitySet.size(), 1);
            entitySet.addEntity(entity);
            t.equals(entitySet.size(), 1);
            t.end();
        })
        .catch(err => {
            Log.error(err.stack);
        });
});

test('should remove an entity', async t => {
    const registry = await initialiseRegistry();

    try {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities(registry);

        let entity = entities.at(0);
        entitySet.addEntity(entity);
        t.equals(entitySet.size(), 1);

        // log.debug('>----- from here');
        entitySet.removeEntity(entity);
        t.equals(entitySet.size(), 0);

        // printE( entities );
        // printE( entities.at(1).Status );
        // printE( entities.at(3).Status );
        // log.debug('1st ' + entities.at(1).Status.hash(true) );
        // log.debug('1st ' + entities.at(3).Status.hash(true) );
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should really remove an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        // Common.logEvents( entitySet );
        entitySet.addEntity([
            { '@c': '/component/flower', colour: 'blue' },
            { '@c': '/component/position', x: 10, y: 60 }
        ]);
        let entityA = entitySet.getUpdatedEntities();

        entitySet.addEntity([
            { '@c': '/component/vegetable', name: 'cauliflower' },
            { '@c': '/component/radius', radius: 0.3 }
        ]);

        let entityB = entitySet.getUpdatedEntities();

        entitySet.removeEntity(entityB);

        t.equals(entitySet.size(), 1);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should add the components of an entity', t => {
    return initialiseRegistry().then(registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities(registry);

        entitySet.addEntity(entities.at(0));

        let addedEntity = entitySet.at(0);
        t.notEqual(addedEntity.Realname, undefined);
        t.end();
    });
});

test('should emit an event when an entity is added', t => {
    return initialiseRegistry().then(registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities(registry);

        entitySet.on('entity:add', eventSpy);
        entitySet.addEntity(entities.at(0));

        t.ok(eventSpy.called, 'entity:add should have been called');
        t.end();
    });
});

test('should emit an event when an entity is removed', t => {
    return initialiseRegistry().then(registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities(registry);
        let entity = entities.at(0);

        entitySet.on('entity:remove', eventSpy);
        entitySet.addEntity(entity);
        entitySet.removeEntity(entity);

        t.ok(eventSpy.called, 'entity:remove should have been called');
        t.end();
    });
});

// NOTE - for the time being, a seperate component and entity remove event is fine
test.skip('should only emit an entity remove event when an entity is removed', async t => {
    try {
        t.plan(1);

        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        entitySet.addEntity([
            { '@c': '/component/flower', colour: 'blue' },
            { '@c': '/component/position', x: 10, y: 60 }
        ]);

        let entity = entitySet.getUpdatedEntities();

        // logEvents( entitySet );

        entitySet.on('component:remove', () => t.ok(false, 'no component:remove event should be fired'));
        entitySet.on('entity:remove', () => t.ok(true, 'a single entity remove event should be fired'));

        entitySet.removeEntity(entity, { debug: true });

        Log.debug(entityToString(entitySet));

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('should not emit an event when a non-existent component is removed', t => {
    return initialiseRegistry().then(registry => {
        let eventSpy = Sinon.spy();
        let entitySet = loadEntities(registry);
        entitySet.on('all', eventSpy);
        let component = registry.createComponent('/component/position', { x: -1, y: -1 }, { eid: 26 });

        component = entitySet.removeComponent(component);

        t.notOk(eventSpy.calledWith('component:remove'), 'component:remove should not have been called');

        t.end();
    });
});

test('adding an entity with an identical id will replace the existing one', async t => {
    try {
        const registry = await initialiseRegistry();

        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
        entitySet.on('component:update', eventSpy);

        //    logEvents(entitySet);
        let entityA = registry.createEntity({ '@c': '/component/position', x: 0, y: 0, '@e': 26 });

        let entityB = registry.createEntity([
            { '@c': '/component/position', x: 15, y: -90, '@e': 26 },
            { '@c': '/component/status', status: 'active' }
        ]);

        // Log.debug( 'entityA', entityToString(entityA) );
        // Log.debug( 'entityB', entityToString(entityB) );

        entitySet.addEntity(entityA);

        entitySet.addEntity(entityB, { debug: false });

        // Log.debug( entitySet.at(0) );

        // Log.debug( entityToString(entitySet) );

        const addedEntity = entitySet.at(0);

        t.equals(entitySet.size(), 1);

        t.ok(eventSpy.calledOnce, `component:update was called ${eventSpy.callCount} times`);

        // Log.debug( entityToString(addedEntity) );

        t.equals(addedEntity.Status.get('status'), 'active');
        t.equals(addedEntity.Position.get('x'), 15);
        //    printE( entitySet );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

// test('should only add a component of an accepted type', async t => {
//     try {
//         const [registry, entitySet, entities] = await initialise();

//         let eventSpy = Sinon.spy();
//         // Common.logEvents( entitySet );
//         // printE( entities );
//         // setting an entity filter means that the entitySet will
//         // only add components that pass through the filter
//         entitySet.setQuery(Q => Q.all('/component/position'));

//         entitySet.addEntity(entities.at(0));

//         t.equals(entitySet.size(), 1);

//         t.end();
//     } catch (err) {
//         Log.error(err.stack);
//     }
// });

// test('should only retain the included component on entity', async t => {
//     try {
//         const [registry, entitySet, entities] = await initialise();

//         entitySet.setQuery(Q => Q.include('/component/nickname'));

//         entitySet.addEntity(entities.at(0));

//         // the entity won't have any of the other components
//         t.equals(entitySet.at(0).getComponentCount(), 1);

//         t.end();
//     } catch (err) {
//         Log.error(err.stack);
//     }
// });

// test('should not add entities that have excluded components', async t => {
//     const [registry, entitySet, entities] = await initialise();

//     entitySet.setQuery(Q => Q.none('/component/score'));

//     entitySet.addEntity(entities.at(1));
//     t.equals(entitySet.size(), 0);
//     entitySet.addEntity(entities.at(0));
//     t.equals(entitySet.size(), 1);

//     t.end();
// });

// test('should not add entities that have multiple excluded components', async t => {
//     try {
//         const [registry, entitySet, entities] = await initialise();

//         entitySet.setQuery(Q => Q.none(['/component/score', '/component/nickname']));

//         entitySet.addEntity(entities);
//         // console.log( entityToString(entitySet) );
//         t.equals(entitySet.size(), 1);

//         t.end();

//     } catch (err) {
//         Log.error(err.stack);
//     }
// });

// test('should only add entities that are included', async t => {
//     const [registry, entitySet, entities] = await initialise();
//     // this means that any entity MUST have a Position and Nickname
//     entitySet.setQuery(Q => Q.all(['/component/position', '/component/nickname']));
//     entitySet.addEntity(entities);
//     t.equals(entitySet.size(), 2);
//     t.end();
// });

// test('should only add entities that are optional', async t => {
//     const [registry, entitySet, entities] = await initialise();
//     // this means that the entity MAY have Position and/or Nickname
//     entitySet.setQuery(Q => Q.any(['/component/position', '/component/nickname']));
//     entitySet.addEntity(entities);
//     t.equals(entitySet.size(), 4);
//     t.end();
// });

// test('should only add entities that pass include/exclude', async t => {
//     try {
//         const [registry, entitySet, entities] = await initialise();

//         entitySet.setQuery(Q => [Q.all('/component/position'), Q.none('/component/realname')]);

//         entitySet.addEntity(entities);
//         t.equals(entitySet.size(), 1);

//         t.end();
//     } catch (err) {
//         Log.error(err.stack);
//     }
// });

// test('should remove entities that are excluded after their components change', t => {
//     return initialise({ allowEmptyEntities: false }).then(([registry, entitySet, entities]) => {
//         // let registry = initialiseRegistry();
//         // let entitySet = registry.createEntitySet({allowEmptyEntities:false});
//         // let entities = loadEntities( registry );
//         entitySet.setQuery(Q => Q.none('/component/realname'));

//         entitySet.addEntity(entities);
//         t.equals(entitySet.size(), 2);

//         let entity = entities.at(1);
//         let component = registry.createComponent('/component/realname', {
//             name: 'mike smith',
//             '@e': entity.getEntityId()
//         });
//         // this action should cause the entity to be removed
//         entitySet.addComponent(component);
//         t.equals(entitySet.size(), 1);

//         t.end();
//     });
// });

// test('should remove entities that no longer included after their components change', t => {
//     return initialise().then(([registry, entitySet, entities]) => {
//         entitySet.setQuery(Q => Q.all('/component/nickname'));
//         entitySet.addEntity(entities);

//         t.equals(entitySet.size(), 3, 'two entities which have Nickname');
//         let entity = entities.at(0);

//         // removing the Nickname component should mean the entity is also removed
//         entitySet.removeComponent(entity.Nickname);
//         t.equals(entitySet.size(), 2);
//         t.end();
//     });
// });

// test('should remove entities that are no longer allowed when the component mask changes', t => {
//     return initialise().then(([registry, entitySet, entities]) => {
//         entitySet.addEntity(entities);
//         t.equals(entitySet.size(), 5);

//         entitySet.setQuery(Q => Q.none('/component/score'));
//         t.equals(entitySet.size(), 2);
//         t.end();
//     });
// });

// test('should remove components for an entity', t => {
//     return beforeEach(true).then( function(){
//         let entity = entities.at(0);
//         entitySet.addEntity( entity );
//         entitySet.removeEntity( entity );
//         t.end();
//     });
// });

test('should emit an event when a component is changed', async t => {
    try {
        const [registry, entitySet, entities] = await initialise();
        let entity = entities.at(0);
        let cloned,
            component = entity.Position;
        const spy = Sinon.spy();

        entitySet.on('component:update', spy);

        entitySet.addEntity(entity);

        cloned = cloneComponent(component);

        cloned.set({ x: 0, y: -2 });

        entitySet.addComponent(cloned, { debug: false });

        t.ok(spy.called, 'component:update should have been called');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('emit event when an entity component is changed', async t => {
    try {
        const [registry, entitySet, entities] = await initialise();

        const spy = Sinon.spy();

        entitySet.on('component:update', spy);

        entitySet.addEntity([{ '@c': '/component/flower', colour: 'white' }]);
        let entityA = entitySet.getUpdatedEntities();

        let entityB = registry.createEntity([{ '@c': '/component/flower', colour: 'blue' }], {
            '@e': entityA.getEntityId()
        });
        // let entityB = entitySet.getUpdatedEntities();

        // Log.debug('entityA', entityToString(entityA), entityA.getEntityId() );
        // Log.debug('entityB', entityToString(entityB), entityB.getEntityId() );
        // Log.debug( entityToString(entitySet) );

        t.equal(entityA.getEntityId(), entityB.getEntityId(), 'the entity ids should be equal');

        entityB = entitySet.addEntity(entityB);

        t.ok(spy.called, 'component:update should have been called');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test.skip('emit event when a component instance is changed', async t => {
    try {
        const [registry, entitySet, entities] = await initialise();

        const spy = Sinon.spy();
        // Common.logEvents( entitySet );
        entitySet.on('component:update', spy);

        let entityA = entitySet.addEntity(registry.createEntity({ '@c': '/component/flower', colour: 'white' }));
        // registry.createEntity( { '@c':'/component/flower', colour:'white'} ) );
        let component = entitySet.at(0).getComponentByIId('/component/flower');

        // calling set triggers an event which is forwarded by the enclosing
        // entity onto the surrounding entityset
        component.set({ colour: 'red' }, { debug: true });

        t.ok(spy.called, 'component:update should have been called');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('mutating a previously added component does not affect the entityset', t => {
    return initialise()
        .then(([registry, entitySet, entities]) => {
            const spy = Sinon.spy();
            // logEvents( entitySet );
            const component = registry.createComponent({ '@c': '/component/flower', colour: 'blue' });

            entitySet.addComponent(component);

            const esComponent = entitySet.at(0).Flower;

            component.set({ colour: 'white' });

            t.equals(esComponent.get('colour'), 'blue', 'the es component retains its colour');
        })
        .then(() => t.end())
        .catch(err => {
            Log.error(err.stack);
        });
});

// test('should clear all contained entities by calling reset', async t => {
//     try {
//         const [registry, entitySet, entities] = await initialise();
//         const spy = Sinon.spy();

//         entitySet.on('reset', spy);

//         entitySet.addEntity(entities);

//         t.equals(entitySet.size(), entities.size());

//         entitySet.reset(null);

//         t.equals(entitySet.size(), 0);

//         t.ok(spy.called, 'reset should have been called');

//         t.end();

//     } catch (err) {
//         Log.error(err.stack);
//     }
// });

// test('attached entitysets', async t => {
//     const [ registry, entitySet, entities ] = await initialise();

//     // other ES will accept only entities with Position and Realname
//     const oEntitySet = registry.createEntitySet();
//     // set a filter on the other entitySet so that it will only accept components that
//     // have /position and /realname
//     oEntitySet.setQuery(Q => Q.all([ '/component/position', '/component/realname' ]));

//     // make the other entitySet listen to the origin entitySet
//     oEntitySet.attachTo(entitySet);

//     // add some entities to the origin entitySet
//     entitySet.addEntity(entities.at(0));
//     entitySet.addEntity(entities.at(4));

//     // these added entities should end up in the other entityset
//     t.equals(oEntitySet.size(), 2);

//     t.end();
// });

// test('map transfers an entitySet through a filter into another entityset', t => {
//     let eventSpy = Sinon.spy();
//     return initialise()
//         .then(([ registry, entitySet, entities ]) => {
//             let oEntitySet = registry.createEntitySet();
//             let entityFilter = Q => Q.include('/component/score');

//             // printE( loadedEntitySet );
//             // Common.logEvents( oEntitySet );
//             oEntitySet.on('all', eventSpy);

//             // Common.logEvents( oEntitySet );
//             // map the entities from the loaded set into the other set, using the entityfilter
//             entities.map(entityFilter, oEntitySet);

//             // loadedEntitySet.map( entityFilter, oEntitySet );
//             // printIns( eventSpy.args[1] );
//             t.ok(eventSpy.calledWith('reset'), 'entitySet should trigger a reset event');
//             t.ok(eventSpy.calledWith('component:add'), 'entitySet should trigger a component:add event');
//             t.ok(eventSpy.calledWith('entity:add'), 'entitySet should trigger a entity:add event');

//             t.equal(_.size(eventSpy.args[1][1]), 3, 'three components reported as being added');
//             t.equal(_.size(eventSpy.args[2][1]), 3, 'three entities reported as being added');

//             t.end();
//         })
//         .catch(err => Log.error(err.stack));
// });

// test('map transfers an entitySet through a filter into another entityset again', t => {
//     let eventSpy = Sinon.spy();
//     return initialise()
//         .then(([ registry, entitySet, entities ]) => {
//             const oEntitySet = registry.createEntitySet();
//             let entityFilter = Q => Q.none('/component/position');

//             oEntitySet.on('all', eventSpy);
//             // Common.logEvents( oEntitySet );
//             // Common.logEvents( oEntitySet );
//             // map the entities from the loaded set into the other set, using the entityfilter
//             entities.map(entityFilter, oEntitySet);
//             // loadedEntitySet.map( entityFilter, oEntitySet );
//             // printE( loadedEntitySet );
//             // printE( oEntitySet );
//             t.equal(_.size(eventSpy.args[1][1]), 5, 'three components reported as being added');
//             t.equal(_.size(eventSpy.args[2][1]), 2, 'two entities reported as being added');

//             t.end();
//         })
//         .catch(err => Log.error(err.stack));
// });

test('possible to add 2 entities with same entityIds but different entityset ids', async t => {
    try {
        const [registry, entitySet, entities] = await initialise();

        // logEvents( entitySet );
        let entityA = entities.at(0);
        let entityB = entities.at(1);

        entityA.setEntityId(22);
        entityA.setEntitySetId(100);
        entityB.setEntityId(22);
        entityB.setEntitySetId(101);

        entitySet.addEntity(entityA);
        entitySet.addEntity(entityB);

        t.equals(entitySet.size(), 2, 'two entities should have been added');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity', async t => {
    try {
        t.plan(2);

        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        entitySet.addEntity([
            { '@c': '/component/name', name: 'susanne' },
            { '@c': '/component/status', status: 'active' }
        ]);

        // capture the single component:remove event that occurs
        captureEntitySetEvent(entitySet, 'component:remove', false, ids =>
            t.equals(ids.length, 1, '1 component:remove event should have been called')
        );

        // entitySet.on('all', (name,components) => Log.debug('es event', name, components.map(c=>c.toJSON()) ));

        // clone the entity so that we can operate on it -
        const entity = cloneEntity(entitySet.at(0)); // registry.createEntity( entity.toJSON() );

        // remove one of the components
        entity.removeComponent('/component/status');

        // logEvents(entitySet);
        // Log.debug('ok good', entity.toJSON() );
        // Log.debug('ok good', entityToString(cloneEntity) );
        // Log.debug('ok good', entityToString(entitySet) );

        // re-add the entity - this should update the entity in the set
        // and also fire an event
        entitySet.addEntity(entity);

        t.ok(entitySet.at(0).Status === undefined);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test.skip('removing a component from an entity again', async t => {
    try {
        // t.plan(2);

        const registry = await initialiseRegistry();
        let entitySet = registry.createEntitySet();

        entitySet.addEntity([{ '@c': '/component/status', status: 'active' }]);

        // capture the single component:remove event that occurs
        captureEntitySetEvent(entitySet, 'component:remove', false, ids =>
            t.equals(ids.length, 1, '1 component:remove event should have been called')
        );

        entitySet.on('all', (name, components) => Log.debug('es event', name, components.map(c => c.toJSON())));

        // clone the entity so that we can operate on it -
        const entity = entitySet.at(0, true); // registry.createEntity( entity.toJSON() );

        // remove Status and add Name
        entity.removeComponent('/component/status');
        entity.addComponent({ '@c': '/component/name', name: 'plaid' });

        // logEvents(entitySet);
        // Log.debug('ok good', entity.toJSON() );
        // Log.debug('ok good', entityToString(entity) );

        // re-add the entity - this should update the entity in the set
        // and also fire an event
        entitySet.addEntity(entity, { debug: true });

        Log.debug('ok good', entityToString(entitySet));

        t.ok(entitySet.at(0).Status === undefined);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

async function initialise() {
    const registry = await initialiseRegistry();
    let entitySet = registry.createEntitySet();
    let entities = loadEntities(registry);
    return [registry, entitySet, entities];
}
