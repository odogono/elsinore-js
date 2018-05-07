import _ from 'underscore';
import test from 'tape';
import BitField from 'odgn-bitfield';
import { Base } from '../src/base';
import { EntitySet } from '../src/entity_set';
import { isComponent, isEntity, isEntitySet } from '../src/util/is';

// import Sinon from 'sinon';

import { toInteger } from '../src/util/to';

import {
    Component,
    // Entity, EntityFilter, EntitySet,
    // Registry, Query,
    // ComponentRegistry,
    initialiseRegistry,
    // loadEntities,
    // loadComponents,
    // loadFixtureJSON,
    entityToString,
    logEvents,
    createLog,
    // getEntityIdFromId,
    // getEntitySetIdFromId,
    setEntityIdFromId
} from './common';

import { AsyncCmdBuffer as CmdBuffer } from '../src/cmd_buffer/async';
// import { AsyncEntitySet } from '../src/entity_set/async';

const Log = createLog('TestCmdBufferAsync');

test('adding a component with no entity id', async t => {
    try {
        const registry = await initialiseRegistry();
        const cb = new CmdBuffer();
        const es = createEntitySet(registry);
        const com = createComponent();

        await cb.addComponent(es, com);

        reportUpdates(t, es, 1, 0, 0, 1, 0, 0);

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('adding a component with an eid, but not a member of the es', async t => {
    const registry = await initialiseRegistry();
    let cb = new CmdBuffer();
    let es = createEntitySet(registry, 50);
    let com = createComponent({ '@e': 10 });

    try {
        await cb.addComponent(es, com);
        reportUpdates(t, es, 1, 0, 0, 1, 0, 0);

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('adding a component with an eid, a non-member of the es', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const com = createComponent({ '@e': 11, '@es': 51 });
    const es = createEntitySet(registry, 50);

    try {
        const added = await cb.addComponent(es, com);

        reportUpdates(t, es, 1, 0, 0, 1, 0, 0);
        // t.equal( es.entitiesAdded.length, 1, 'one entity should be added' );
        // t.equal( es.componentsAdded.length, 1, 'one component should be added' );
        t.ok(isComponent(added));
        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('adding a component with an eid, an existing member of the es', async t => {
    try {
        const registry = await initialiseRegistry();
        const cb = new CmdBuffer();
        const com = createComponent({ '@e': 11, '@es': 50 });
        // Log.debug('com', com.attributes, com.getEntitySetId() );
        const es = createEntitySet(registry, 50, [11]);

        const added = await cb.addComponent(es, com);

        reportUpdates(t, es, 0, 1, 0, 1, 0, 0);
        t.ok(isComponent(added));

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('updating an existing component', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const com = createComponent({ '@e': 11, '@es': 50, '@s': 5 });
    const es = createEntitySet(registry, 50, [11], [com]);
    const added = await cb.addComponent(es, com);

    reportUpdates(t, es, 0, 1, 0, 0, 1, 0);
    // t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated' );
    // t.equal( es.componentsUpdated.length, 1, 'one component should be updated' );
    t.ok(isComponent(added));

    t.end();
});

test('adding an entity with multiple components', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const coms = createComponent({ tag: 'soft', '@s': 3 }, { tag: 'hard', '@s': 10 });
    const es = createEntitySet(registry, 60);
    const e = registry.createEntity();

    //add created coms to created entity
    e.addComponent(coms);
    // coms.forEach(com => e.addComponent(com));

    try {
        await cb.addEntity(es, e);

        reportUpdates(t, es, 1, 0, 0, 2, 0, 0 );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('updating an entity with a new component', async t => {
    try {
        const registry = await initialiseRegistry();

        const cmdBuffer = new CmdBuffer();

        const coms = createComponent({ tag: 'soft', '@s': 3 }, { tag: 'hard', '@s': 10 });

        const entitySet = createEntitySet(registry, 62, [10], [coms[1]]);

        // logEvents(entitySet);

        const entity = registry.createEntityWithId(10, 62);

        entity.addComponent(coms);

        // Log.debug(`entity ids`, entity.id, entity.getEntityId(), entity.getEntitySetId(), entityToString(entity));

        const added = await cmdBuffer.addEntity(entitySet, entity);

        reportUpdates(t, entitySet, 0, 1, 0, 1, 1, 0);

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('removing a component from an entity', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const coms = createComponent({ tag: 'soft', '@s': 4 }, { tag: 'hard', '@s': 10 }, { tag: 'kik', '@s': 13 });

    const es = createEntitySet(registry, 63, [12], coms);
    const e = registry.createEntityWithId(12, 63);

    coms.forEach(com => e.addComponent(com));

    try {
        await cb.removeComponent(es, coms[1]);

        reportUpdates(t, es, 0, 1, 0, 0, 0, 1);

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('removing the last component from an entity', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();

    const component = createComponent({ tag: 'soft', '@s': 4 });

    const entitySet = createEntitySet(registry, 63, [12], [component]);

    const entity = registry.createEntityWithId(12, 63);

    entity.addComponent(component);

    entitySet.getEntity = function(entityId) {
        entity.hasComponent = cIId => true;
        return Promise.resolve(entity);
    };

    await cb.removeComponent(entitySet, component);

    reportUpdates(t, entitySet, 0, 0, 1, 0, 0, 1);

    t.end();
});

test('removing all components from an entity', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const coms = createComponent({ tag: 'soft', '@s': 4 }, { tag: 'hard', '@s': 10 }, { tag: 'kik', '@s': 13 });

    const es = createEntitySet(registry, 63, [12], coms);
    const e = registry.createEntityWithId(12, 63);

    coms.forEach(com => e.addComponent(com));

    await cb.removeComponent(es, coms);

    reportUpdates(t, es, 0, 0, 1, 0, 0, 3);

    t.end();
});

test('removing an existing entity', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const components = createComponent({ tag: 'soft', '@s': 4 }, { tag: 'hard', '@s': 10 }, { tag: 'kik', '@s': 13 });

    const entitySet = createEntitySet(registry, 64, [13], components);
    const entity = registry.createEntityWithId(13, 64);

    entity.addComponent(components);

    try {
        await cb.removeEntity(entitySet, entity);

        reportUpdates(t, entitySet, 0, 0, 1, 0, 0, 3);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding multiple', async t => {
    try {
        const registry = await initialiseRegistry();
        const cmdBuffer = new CmdBuffer();
        const es = createEntitySet(registry, 66);

        const data = [
            { '@e': 1, '@c': '/component/channel', '@s': 1, name: 'ecs' },
            { '@e': 1, '@c': '/component/topic', '@s': 2, topic: 'Entity Component Systems' },
            { '@e': 5, '@c': '/component/username', '@s': 3, username: 'aveenendaal' },
            { '@e': 5, '@c': '/component/nickname', '@s': 4, nickname: 'alex' },
            { '@e': 12, '@c': '/component/channel_member', '@s': 5, channel: 1, client: 5 }
        ];

        const entities = registry.createEntitySet({ '@e': data });
        // console.log( entities );
        // let entities = loadEntities( registry, data );

        await cmdBuffer.addEntity(es, entities.getEntities() );

        reportUpdates(t, es, 3, 0, 0, 5, 0, 0);

        t.end();
    } catch (err) {
        Log.error(err);
    }
});

test.skip('the added component is a clone of the original', async t => {
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const es = registry.createEntitySet();
    const component = registry.createComponent({ '@c': '/component/flower', colour: 'blue' });

    await cb.addComponent(es, component);

    t.end();
});

function reportUpdates(t, es, eAdded, eUpdated, eRemoved, cAdded, cUpdated, cRemoved) {
    t.equal(es.entitiesAdded.size(), eAdded, `${eAdded} entities should be added`);
    t.equal(es.entitiesUpdated.size(), eUpdated, `${eUpdated} entities should be updated`);
    t.equal(es.entitiesRemoved.size(), eRemoved, `${eRemoved} entity should be removed`);
    t.equal(es.componentsAdded.size(), cAdded, `${cAdded} components should be added`);
    t.equal(es.componentsUpdated.size(), cUpdated, `${cUpdated} components should be updated`);
    t.equal(es.componentsRemoved.size(), cRemoved, `${cRemoved} components should be removed`);
}

/**
*   Creates a Mock ES that we can assert against
*/
function createEntitySet(registry, entitySetId, entityIds, existingComponents) {
    // return result;
    const existingComponentDefIds = _.compact(_.map(existingComponents, c => c.getDefId()));

    entityIds = _.map(entityIds, id => setEntityIdFromId(id, entitySetId));

    return Object.assign({}, EntitySet.prototype, {
        id: entitySetId,
        type: 'MockEntitySet',
        update: function(eAdd, eUp, eRem, cAdd, cUp, cRem) {
            // printIns( arguments, 1 );
            [
                this.entitiesAdded,
                this.entitiesUpdated,
                this.entitiesRemoved,
                this.componentsAdded,
                this.componentsUpdated,
                this.componentsRemoved
            ] = arguments;
            return Promise.resolve(true);
        },
        getEntity: function(entityId, options) {
            if (entityIds.indexOf(entityId) !== -1) {
                return Promise.resolve(registry.createEntityWithId(entityId));
            }
            return Promise.resolve({});
        },
        getEntitySignatures: function(entityIds, options) {
            return new Promise((resolve, reject) => {
                const result = _.map(entityIds, eid => {
                    eid = toInteger(eid);
                    const comBf = BitField.create(existingComponentDefIds);
                    // console.log('YO', comBf.toJSON());
                    return registry.createEntity(null, { id: eid, comBf });
                });
                return resolve(result);
            });
        },
        getRegistry: function() {
            return registry;
        }
    });
}

/**
*   Creates a mock component
*/
function createComponent(attrs) {
    // let args = _.toArray(arguments);
    if (arguments.length > 1) {
        return _.map(arguments, arg => {
            return createComponent.call(this, arg);
        });
    }

    attrs = { '@s': 1, ...attrs };

    const result = Component.create(attrs);

    return result;
}
