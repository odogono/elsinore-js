import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    Component,
    Entity,
    EntityFilter,
    EntitySet,
    Registry,
    SchemaRegistry,
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

import '../src/entity_set/async_view';

const Log = createLog('TestEntitySetView');

test('the view should have the same entities', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        let view = await entitySet.createView();

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

        const view = await entitySet.createView();

        t.ok(view.isEntitySetView, 'its an entityset view');
        t.ok(view.isEntitySet, 'its an entityset');
        t.equals(view.type, 'EntitySetAsyncView', 'its type is EntitySetAsyncView');

        t.notEqual(view.getUUID(), entitySet.getUUID());

        t.equals(view.getUUID().length, 36);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an entity to the entityset also adds it to the view', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        const view = await entitySet.createView();

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
        const view = await entitySet.createView();

        view.on('entity:remove', e => {
            t.equals(entitySet.size(), view.size(), 'same number of entities');
            t.end();
        });

        // Log.debug('es is', entityToString(entitySet));
        // logEvents( entitySet, 'entitySet' );
        // logEvents(view, 'view');

        entitySet.removeEntity(entitySet.at(0));
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding selected entities', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        const view = await entitySet.createView(Q => Q.all('/component/status'));

        entitySet.addEntity([{ '@c': '/component/position', x: 0, y: 2 }, { '@c': '/component/name', name: 'bob' }]);
        entitySet.addEntity({ '@c': '/component/status', status: 'active' });
        entitySet.addEntity({ '@c': '/component/name', name: 'alice' });

        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        t.equals(view.size(), 1, 'only 1 entity added'); // because only 1 entity has a /status

        // logEvents(entitySet);

        // grab the entity from the source entityset and remove its /status component, which
        // should cause the entity to be removed from the view
        // the second argument means that the entity will be cloned
        const entity = cloneEntity(entitySet.at(1));
        // add a replacement component so that the entity isn't completely removed from the es
        entity.addComponent({ '@c': '/component/name', name: 'clare' });
        entity.removeComponent('/component/status');

        // logEvents(entitySet);

        // Log.debug('altered e', entityToString(entity) );

        // console.log('>--- add new ', entity.id, entitySet.at(1).id );
        entitySet.addEntity(entity);

        // console.log('>--- .fin');
        // Log.debug('2 es is', entityToString(entitySet));
        // Log.debug('2 view is', entityToString(view));

        // console.log('BIG PROBLEM - when you add an entity which replaces an existing one, and the existing one')

        t.equals(entitySet.size(), 3);
        t.equals(view.size(), 1);

        // _.delay( () => {
        t.end();
        // }, 1000) ;
    } catch (err) {
        Log.error(err.stack);
    }
});

test('adding an entity to the view also adds it to the entityset', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        // const view = entitySet.view(Q => Q.all('/component/position'));
        const view = await entitySet.createView(Q => Q.all('/component/position'));

        view.addEntity({ '@c': '/component/position', x: 0, y: 2 });
        // entitySet.addEntity( {'@c':'/component/status', status:'active'});
        // entitySet.addEntity( {'@c':'/component/name', name:'alice'});
        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));
        t.equals(entitySet.size(), 1, 'only 1 entity added');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a component from an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();

        let entity;
        const view = await entitySet.createView(null);
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
        entity.removeComponent('/component/position');
        // entity.addComponent( {'@c':'/component/name', name:'kai'});
        // entitySet.removeComponent( entity.Position, {debug:true} );
        // entitySet.addEntity(entity, {debug:true});

        // _.delay( () => {
        t.equals(view.at(0).Position, undefined, 'the entity should have no position');

        // console.log('>~~~~');
        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));
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
        const view = await entitySet.createView(null);
        const eventSpy = Sinon.spy();
        let entity;
        let component;

        // const view = entitySet.view(null, { updateOnEvent: true });

        entitySet.addEntity(registry.createEntity([{ '@c': '/component/flower', colour: 'white' }]));

        t.ok(view.at(0).Flower, 'the entity should have flower');

        component = registry.createComponent({ '@c': '/component/position', x: -2, y: 5 }, entitySet.at(0));

        t.equals(component.getEntityId(), entitySet.at(0).getEntityId(), 'the entity ids are identical');

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
        const view = await entitySet.createView(null);
        const eventSpy = Sinon.spy();

        // Common.logEvents( entitySet, 'es ' );
        // Common.logEvents( view, 'vi ' );
        view.on('all', eventSpy);

        entitySet.addEntity(registry.createEntity([{ '@c': '/component/flower', colour: 'magenta' }]));

        t.ok(eventSpy.calledWith('entity:add'), 'entity:add should have been called');
        t.end();
        // }, 1000);
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing a relevant component from an entity should trigger a entity:remove event', async t => {
    try {
        t.plan(1);

        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        // const eventSpy = Sinon.spy();

        const query = Q => Q.all('/component/channel');

        // Log.debug(entityToString(entitySet));
        // var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
        const view = await entitySet.createView(query);
        // const view = entitySet.view(query, { updateOnEvent: true });

        entitySet.addEntity([
            { '@c': '/component/status', status: 'active' },
            { '@c': '/component/channel', name: 'ecs' }
        ]);
        // Log.debug('es is', entityToString(entitySet));
        // Log.debug('view is', entityToString(view));

        // printIns( entitySet, 1 );
        // view.on('all', eventSpy);

        // logEvents( entitySet, 'e es' );
        // logEvents(view, '[e view]');
        // remove an unrelated component to the view
        entitySet.removeComponent(entitySet.at(0).Status);

        // remove the score component from the first entity in the view
        entitySet.removeComponent(view.at(0).Channel);

        // printE( entitySet.at(0) );
        // printE( view.at(0) );
        // t.ok( eventSpy.calledOnce, 'only one event emitted from the view' );
        // t.ok(eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

        view.on('entity:remove', () => {
            // Log.debug('view is', entityToString(view));
            t.ok(true);
            t.end();
        });

        // t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test.skip('deferred addition of components with a filter', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();

        const query = Q => Q.all('/component/position');
        const view = await entitySet.createView(null);

        view.on('all', eventSpy);

        // const entity = entitySet.addEntity(
        //     registry.createEntity([
        //         { '@c':'/component/flower', colour:'blue'}] ));
        const entity = entitySet.addEntity({ '@c': '/component/flower', colour: 'blue' });

        // view.applyEvents();
        t.equals(view.size(), 0, 'no entities yet');

        entitySet.addEntity({ '@c': '/component/position', x: 10, y: 100 });
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
        const [registry, entitySet] = await initialiseEntitySet('entity_set.entities');
        const query = Q => Q.all(['/component/position', '/component/realname']);
        const view = await entitySet.createView(query);

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
        const [registry, entitySet] = await initialiseEntitySet('entity_set.entities');
        const query = Q => Q.none('/component/position');
        const view = await entitySet.createView(query);

        // Log.debug('view is', entityToString(view));

        // add another entity to the ES which the view should ignore
        // because the query rejects entities with a /component/position
        await entitySet.addEntity([
            { '@c': '/component/flower', colour: 'red' },
            { '@c': '/component/position', x: -2, y: 5 }
        ]);

        // Log.debug('view is', entityToString(view));

        t.equals(view.size(), 2, 'two entities');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

// test.skip('deferred addition of a component', t => {
//     initialiseEntitySet().then( ([registry,entitySet]) => {
//     var view = entitySet.where( null, null, {view:true});
//     var entity;
//     // Common.logEvents( entitySet, 'e es' );
//     // Common.logEvents( view, 'e view' );
//     entity = entitySet.addEntity(
//         registry.createEntity({ '@c':'/component/flower', colour:'blue'} ));
//     t.equals( view.size(), 1, 'the view has the new entity');
//     entitySet.addComponent(
//         registry.createComponent( {'@c':'/component/position', x:-2,y:5}, entity) );
//     // printE( view );
//     t.equals( view.at(0).Position, undefined, 'the component is not added yet');
//     // t.equals( view.size(), 0, 'no components added yet');
//     t.ok( view.isModified, 'the view has been modified' );
//     view.applyEvents();
//     t.ok( view.at(0).Position, 'component added');
//     t.end();
// });
test('deferred removal of an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const view = await entitySet.createView();

        // Common.logEvents( entitySet );
        await entitySet.addEntity([
            { '@c': '/component/flower', colour: 'blue' },
            { '@c': '/component/position', x: 10, y: 60 }
        ]);

        await entitySet.addEntity([
            { '@c': '/component/vegetable', name: 'cauliflower' },
            { '@c': '/component/radius', radius: 0.3 }
        ]);

        // view.applyEvents();
        t.equals(view.size(), 2, 'two entities added');

        await entitySet.removeEntity(entitySet.at(1));

        // t.equals( view.length, 2, 'still two entities' );
        // view.applyEvents();
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
        const view = await entitySet.createView();

        let entityA, entityB;

        const eventSpy = Sinon.spy();

        // Common.logEvents( view );
        entitySet.addEntity([
            { '@c': '/component/flower', colour: 'blue' },
            { '@c': '/component/position', x: 10, y: 60 }
        ]);

        entityA = entitySet.getUpdatedEntities();

        entitySet.addEntity([
            { '@c': '/component/vegetable', name: 'cauliflower' },
            { '@c': '/component/radius', radius: 0.3 }
        ]);
        entityB = entitySet.getUpdatedEntities();

        // view.applyEvents();
        view.on('all', eventSpy);

        entitySet.removeEntity(entityA);
        entitySet.removeEntity(entityB);

        t.ok(eventSpy.calledTwice, 'only two event emitted from the view');
        t.ok(eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

// NOTE: views are read only so the below is no longer applicable
// test('altering a component in the view also changes the component in the entityset', async t => {
//     try {
//         const registry = await initialiseRegistry();
//         const entitySet = registry.createEntitySet();
//         const view = await entitySet.createView();

//         // Common.logEvents( entitySet );
//         entitySet.addEntity([
//                 { '@c': '/component/flower', colour: 'blue' },
//                 { '@c': '/component/radius', radius: 0.1 }
//             ]);

//         // view.applyEvents();
//         view.at(0).Flower.set('colour', 'cyan');

//         t.equals(entitySet.at(0).Flower.get('colour'), 'cyan', 'colours should match');

//         t.end();
//     } catch( err ){
//         Log.error( err.stack );
//     }
// });

// test('changing a component in the view triggers a change event', t => {
//     initialiseEntitySet()
//         .then(([registry, entitySet]) => {
//             entitySet = registry.createEntitySet();
//             let view = entitySet.view(null, { updateOnEvent: false });

//             let viewSpy = Sinon.spy(),
//                 esSpy = Sinon.spy();
//             entitySet.on('all', esSpy);
//             view.on('all', viewSpy);

//             // Common.logEvents( entitySet, 'es:evt' );
//             // Common.logEvents( view, 'view:evt' );
//             entitySet.addEntity(
//                 registry.createEntity([
//                     { '@c': '/component/flower', colour: 'yellow', type: 'daisy' },
//                     { '@c': '/component/radius', radius: 0.4 }
//                 ])
//             );

//             // log.debug('from here');
//             // view.on('component:update', component => {
//             // });
//             view.at(0).Flower.set('colour', 'magenta');

//             t.ok(viewSpy.calledWith('component:update'), 'update event emitted from view');
//             t.ok(esSpy.calledWith('component:update'), 'update event emitted from entitySet');

//             // view.applyEvents({debug:true});
//             t.end();
//         })
//         .catch(err => log.error('test error: %s', err.stack));
// });

test('.query returns an entityset of entities', async t => {
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

test('.query returns entities which the attributes', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        // let result = entitySet.where('/component/status', {status:'active'} );
        const result = entitySet.query(Q => Q.all('/component/status', Q.attr('status').equals('active')));

        t.ok(result.isEntitySet, 'the result is an entityset');

        t.equals(result.size(), 6, '6 entities returned');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});//*/

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
