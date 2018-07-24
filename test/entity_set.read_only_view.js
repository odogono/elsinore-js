import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    Component,
    Entity,
    EntityFilter,
    EntitySet,
    Registry,
    ComponentRegistry,
    initialiseRegistry,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    printE,
    entityToString,
    printIns,
    logEvents,
    createLog
} from './common';

import { cloneEntity } from '../src/util/clone';
import { create as createView } from '../src/entity_set/ro_view';

const Log = createLog('TestEntitySetView');

test('the view should have the same entities', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        let view = createView(entitySet);

        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('vw is', entityToString(view));
        // logEvents( entitySet, 'entitySet' );

        t.equals(entitySet.size(), view.size(), 'same number of entities');

        // Log.debug( entityToString(view) );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('the view should be identified as a view', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        const view = createView(entitySet);

        t.ok(view.isEntitySetView, 'its an entityset view');
        t.notOk(view.isEntitySet, 'its an entityset');
        t.equals(
            view.type,
            'EntitySetReadOnlyView',
            'its type is EntitySetReadOnlyView'
        );

        t.notEqual(view.getUUID(), entitySet.getUUID());
        t.equals(view.getUUID().length, 36);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an entity to the entityset also adds it to the view', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        const view = createView(entitySet);

        // logEvents( entitySet );

        entitySet.addComponent({ '@c': '/component/position', x: -2, y: 5 });

        // console.log('view size', view.size());

        // console.log('es size', entitySet.size());

        t.equals(entitySet.size(), view.size(), 'same number of entities');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing an entity from the entitySet should also remove it from the view', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        const view = createView(entitySet);
        Log.debug('es', entitySet.cid, 'vw', view.cid);

        // Log.debug('es is', entityToString(entitySet.at(0)));
        // Log.debug('vw is', entityToString(view.at(0)));
        // logEvents( entitySet, 'entitySet' );
        // logEvents(view, 'view');

        entitySet.removeEntity(entitySet.at(0), { debug: false });
        t.equals(entitySet.size(), view.size(), 'same number of entities');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding selected entities', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        const view = createView(entitySet, Q => Q.all('/component/status'), {
            debug: true
        });
        // logEvents(entitySet);

        entitySet.addEntity([
            { '@c': '/component/position', x: 0, y: 2 },
            { '@c': '/component/name', name: 'bob' }
        ]);
        entitySet.addEntity({ '@c': '/component/status', status: 'active' });
        entitySet.addEntity({ '@c': '/component/name', name: 'alice' });

        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        t.equals(view.size(), 1, 'only 1 entity added'); // because only 1 entity has a /status

        // grab the entity from the source entityset and remove its /status component, which
        // should cause the entity to be removed from the view
        // the second argument means that the entity will be cloned
        const entity = cloneEntity(entitySet.at(1));
        // add a replacement component so that the entity isn't completely removed from the es
        entity.addComponent({ '@c': '/component/name', name: 'clare' });
        entity.removeComponent('/component/status');

        // Log.debug('altered e', entityToString(entity) );

        // console.log('>--- add new ', entity.id, entitySet.at(1).id );
        // console.log('>--- .fin');
        entitySet.addEntity(entity, { debug: false });

        // Log.debug('2 es is', entityToString(entitySet));
        // Log.debug('2 view is', entityToString(view));

        t.equals(entitySet.size(), 3);
        t.equals(view.size(), 0);

        // _.delay( () => {
        t.end();
        // }, 1000) ;
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        let entity;
        const view = await createView(entitySet, null, { debug: false });
        // const view = entitySet.view(null, { updateOnEvent: true });

        // Common.logEvents( view );
        // Common.logEvents( entitySet );
        entitySet.addEntity([
            { '@c': '/component/flower', colour: 'red' },
            { '@c': '/component/position', x: -2, y: 5 }
        ]);
        // Log.debug('entitySet', entitySet.cid);
        // Log.debug('view', view.cid);
        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        t.ok(view.at(0).Position, 'the entity should have position');

        // logEvents( entitySet );
        entity = entitySet.at(0);
        // console.log('>--');
        // entity.Position.msg = '🐰'
        entity.removeComponent('/component/position', { debug: false });
        // entity.addComponent( {'@c':'/component/name', name:'kai'});
        // entitySet.removeComponent( entity.Position, {debug:true} );
        // entitySet.addEntity(entity, {debug:true});

        // _.delay( () => {
        t.equals(
            view.at(0).Position,
            undefined,
            'the entity should have no position'
        );

        // console.log('>~~~~');
        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));//*/
        t.end();
        // }, 1000);
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding a component to an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const view = await createView(entitySet, null, { debug: false });
        const eventSpy = Sinon.spy();
        let entity;
        let component;

        // const view = entitySet.view(null, { updateOnEvent: true });

        entitySet.addEntity(
            registry.createEntity([
                { '@c': '/component/flower', colour: 'white' }
            ])
        );

        t.ok(view.at(0).Flower, 'the entity should have flower');

        component = registry.createComponent(
            { '@c': '/component/position', x: -2, y: 5 },
            entitySet.at(0),
            {
                debug: true
            }
        );

        t.equals(
            component.getEntityID(),
            entitySet.at(0).getEntityID(),
            'the entity ids are identical'
        );

        // console.log( "component is", entityToString(component) );
        entitySet.addComponent(component);

        t.ok(view.at(0).Position, 'the views entity should have position');
        t.end();
        // }, 1000);
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding a component to an entity triggers an entity:add event', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const view = await createView(entitySet, null, { debug: false });
        const eventSpy = Sinon.spy();

        // Common.logEvents( entitySet, 'es ' );
        // Common.logEvents( view, 'vi ' );
        view.on('all', eventSpy);

        entitySet.addEntity(
            registry.createEntity([
                { '@c': '/component/flower', colour: 'magenta' }
            ])
        );

        t.ok(
            eventSpy.calledWith('entity:add'),
            'entity:add should have been called'
        );
        t.end();
        // }, 1000);
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a relevant component from an entity should trigger a entity:remove event', async t => {
    try {
        t.plan(2);

        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        // const eventSpy = Sinon.spy();

        const query = Q => Q.all('/component/channel');

        // Log.debug(entityToString(entitySet));
        // var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
        const view = createView(entitySet, query, { debug: false });
        // const view = entitySet.view(query, { updateOnEvent: true });

        entitySet.addEntity([
            { '@c': '/component/status', status: 'active' },
            { '@c': '/component/channel', name: 'ecs' }
        ]);
        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        // printIns( entitySet, 1 );
        // view.on('all', (name,...args) => {
        //     Log.debug('View Evt', name);
        // });

        // logEvents( entitySet, 'e es' );
        // logEvents(view, '[e view]');
        // remove an unrelated component to the view
        // entitySet.removeComponent(entitySet.at(0).Status);

        view.on('entity:remove', () => t.ok(true));

        // remove the score component from the first entity in the view
        entitySet.removeComponent(view.at(0).Channel);

        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        t.equals(view.size(), 0);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('deferred addition of components with a filter', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();

        const query = Q => Q.all('/component/position');
        const view = await createView(entitySet, null, {
            deferEvents: true,
            debug: false
        });

        view.on('all', eventSpy);

        // const entity = entitySet.addEntity(
        //     registry.createEntity([
        //         { '@c':'/component/flower', colour:'blue'}] ));
        entitySet.addEntity({ '@c': '/component/flower', colour: 'blue' });
        let entity = entitySet.getUpdatedEntities();

        t.equals(view.size(), 0, 'no entities yet');

        entitySet.addComponent({
            '@c': '/component/position',
            x: 10,
            y: 100,
            '@e': entity.id
        });

        // Log.debug( entityToString(entitySet) );

        // entitySet.addComponent(
        //     registry.createComponent({'@c':'/component/position', x:10, y:100}, entity ) );
        // a new component added to a view needs an event being applied
        view.applyEvents();

        t.equals(view.size(), 1, 'only one entity added');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('applying a filter', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet(
            'entity_set.entities'
        );
        const query = Q =>
            Q.all(['/component/position', '/component/realname']);
        const view = createView(entitySet, query, { debug: true });

        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        t.ok(view.at(0).Position, 'the entity should have /position');
        t.ok(view.at(0).Realname, 'the entity should have /realname');

        t.ok(view.at(1).Position, 'the entity should have /position');
        t.ok(view.at(1).Realname, 'the entity should have /realname');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('views created with a filter', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet(
            'entity_set.entities'
        );
        const query = Q => Q.none('/component/position');
        const view = createView(entitySet, query);

        // add another entity to the ES which the view should ignore
        entitySet.addComponent([
            registry.createComponent('/component/flower', { colour: 'red' }),
            registry.createComponent('/component/position', { x: -2, y: 5 })
        ]);

        t.equals(view.size(), 2, 'two entities');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('deferred removal of an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const view = createView(entitySet, null, { deferEvents: true });

        // Common.logEvents( entitySet );
        entitySet.addEntity([
            { '@c': '/component/flower', colour: 'blue' },
            { '@c': '/component/position', x: 10, y: 60 }
        ]);

        entitySet.addEntity([
            { '@c': '/component/vegetable', name: 'cauliflower' },
            { '@c': '/component/radius', radius: 0.3 }
        ]);

        view.applyEvents();

        t.equals(view.size(), 2, 'two entities added');

        // Log.debug( entityToString(entitySet) );

        entitySet.removeEntity(entitySet.at(1));

        t.equals(view.size(), 2, 'still two entities');

        view.applyEvents();

        t.equals(view.size(), 1, 'now one entity');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('deferred removal of an entity triggers correct events', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const view = createView(entitySet);

        const eventSpy = Sinon.spy();

        // Common.logEvents( view );
        // view.on('all' , name => Log.debug(`[view][evt][${name}]`));
        // logEvents( entitySet );

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

        // view.applyEvents();
        // view.on('all', (name, es) => Log.debug('view evt', name, es.map(e=>e.id)))
        view.on('all', eventSpy);

        // console.log('>--');
        // Log.debug('removing', entityA.id, 'and', entityB.id );
        entitySet.removeEntity(entityA, { debug: false });
        entitySet.removeEntity(entityB);

        t.ok(eventSpy.calledTwice, 'only two event emitted from the view');
        t.ok(
            eventSpy.calledWith('entity:remove'),
            'entity:remove should have been called'
        );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('a view with deferred events still populates from the entityset', async t => {
    // a sanity check to ensure that the view is still populated with the existing
    // entities even if it is created to defer events
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        entitySet.addEntity([
            { '@c': '/component/flower', colour: 'green' },
            { '@c': '/component/radius', radius: 3 }
        ]);

        const view = createView(entitySet, null, { deferEvents: true });

        t.equals(view.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('a view will add an entity which becomes relevent', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        entitySet.addEntity({ '@c': '/component/flower', colour: 'green' });

        const view = createView(entitySet, Q => Q.all('/component/radius'), {
            debug: true
        });

        // logEvents( entitySet );

        let entity = entitySet.getUpdatedEntities();
        // console.log('>--');

        // adding a component of interest to the view will ensure that the view now
        // contains this entity
        view.addComponent(
            { '@c': '/component/radius', radius: 3 },
            { debug: false }
        );

        // Log.debug(entityToString(view));

        t.equals(view.size(), 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('.where returns an entityset of entities', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        const result = entitySet.query(Q => Q.all('/component/name'));
        t.ok(result.isEntitySet, 'the result is an entityset');
        t.equals(result.size(), 7, '7 entities returned');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('.query returns entities which the attributes', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        // let result = entitySet.where('/component/status', {status:'active'} );
        const result = entitySet.query(Q =>
            Q.all('/component/status', Q.attr('status').equals('active'))
        );

        t.ok(result.isEntitySet, 'the result is an entityset');
        t.equals(result.size(), 6, '6 entities returned');

        t.end();
    });
});

function initialise(entities) {
    let registry = Common.initialiseRegistry(false);
    let entitySet = Common.loadEntities(registry, entities || 'query.entities');
    return [registry, entitySet];
}

function initialiseEntitySet(entityDataName = 'query.entities') {
    return initialiseRegistry(false).then(registry => {
        let entitySet = loadEntities(registry, entityDataName);
        return [registry, entitySet];
    });
}
