import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, SchemaRegistry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE, entityToString, 
    printIns,
    logEvents,
    createLog,
} from './common';

import '../src/entity_set/view';

const Log = createLog('TestEntitySetView');

test('.where returns an entityset of entities', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const result = entitySet.query(Q => Q.all('/component/name') );
        t.ok( result.isEntitySet, 'the result is an entityset');
        t.equals( result.length, 7, '7 entities returned');

        t.end();
    });
});

test('.query returns entities which the attributes', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
    
        // let result = entitySet.where('/component/status', {status:'active'} );
        const result = entitySet.query(Q => 
            Q.all('/component/status', 
                Q.attr('status').equals('active')) );

        t.ok( result.isEntitySet, 'the result is an entityset');
        t.equals( result.length, 6, '6 entities returned');

        t.end();
    });
});



test('the view should be identified as a view', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
    
        const view = entitySet.view();

        t.ok( view.isEntitySetView, 'its an entityset view');
        t.ok( view.isEntitySet, 'its an entityset');
        t.equals( view.type, 'EntitySetView', 'its type is EntitySetView');
        
        t.notEqual( view.getUuid(), entitySet.getUuid() );
        t.equals( view.getUuid().length, 36 );

        t.end();
    });
});


test('the view should have the same entities', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        let eventSpy = Sinon.spy();

        let view = entitySet.view();

        // printE( entitySet );
        
        t.equals( entitySet.size(), view.size(), 'same number of entities');

        t.end();
    });
});


test('removing an entity from the entitySet should also remove it from the view', async t => {
    try{ const [registry,entitySet] = await initialiseEntitySet();
    const eventSpy = Sinon.spy();

    const view = entitySet.view(null,{updateOnEvent: true});

        // Common.logEvents( entitySet, 'entitySet' );
        // Common.logEvents( view, 'view' );

    entitySet.removeEntity( entitySet.at(0) );
        // view.update();
        
    t.equals( entitySet.size(), view.length, 'same number of entities');

    t.end();
    }catch(err){ console.log('test error',err.stack); }
});

test('adding an entity to the entityset also adds it to the view', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const view = entitySet.view(null,{updateOnEvent:true});

        const component = registry.createComponent( '/component/position', {x:-2,y:5} );
        entitySet.addComponent( component );

        console.log('view size', view.size());
        console.log('es size', entitySet.size());
        t.equals( entitySet.size(), view.size(), 'same number of entities');
        t.end();
    });
});

test('adding an entity to the view also adds it to the entityset', async t => {
    try{
    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();

    const view = entitySet.view( Q => Q.all('/component/position') );

    view.addEntity( {'@c':'/component/position', x:0,y:2});
    // entitySet.addEntity( {'@c':'/component/status', status:'active'});
    // entitySet.addEntity( {'@c':'/component/name', name:'alice'});

    // Log.debug('es is', entityToString(entitySet));
    // Log.debug('view is', entityToString(view));

    t.equals(entitySet.length,1,'only 1 entity added');

    t.end();
    }catch(err){Log.error(err.stack);}
})


test('removing a component from an entity', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        let entity;
        entitySet = registry.createEntitySet();
        const view = entitySet.view(null, {updateOnEvent: true} );

        // Common.logEvents( view );
        // Common.logEvents( entitySet );

        entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/flower', colour:'red'},
                { '@c':'/component/position', x:-2, y:5 }] ));
            
        // view.update();
        // printE( view );

        t.ok( view.at(0).Position, 'the entity should have position' );

        entity = entitySet.at(0);
        entitySet.removeComponent( entity.Position );

        // printE( entitySet );
        // printE( view );

        t.ok( _.isUndefined( view.at(0).Position ), 'the entity should have no position' );
        t.end();
    })
    .catch( err => console.log('test error', err, err.stack))
});

test('adding a component to an entity', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        let component;
        const eventSpy = Sinon.spy();
        entitySet = registry.createEntitySet();
        const view = entitySet.view(null, {updateOnEvent:true});

        entitySet.addEntity(
            registry.createEntity([{'@c':'/component/flower', colour:'white'}] ));

        t.ok( view.at(0).Flower, 'the entity should have flower' );

        component = registry.createComponent( {'@c':'/component/position', x:-2, y:5}, entitySet.at(0), {debug:true} );

        t.equals( component.getEntityId(), entitySet.at(0).getEntityId(), 'the entity ids are identical' );

        // console.log( "component is", entityToString(component) );

        entitySet.addComponent( component );

        t.ok( view.at(0).Position, 'the views entity should have position' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('adding a component to an entity triggers an entity:add event', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const eventSpy = Sinon.spy();
        entitySet = registry.createEntitySet();
        const view = entitySet.view(null, {updateOnEvent:true});

        // Common.logEvents( entitySet, 'es ' );
        // Common.logEvents( view, 'vi ' );
        view.on('all', eventSpy);

        entitySet.addEntity(
            registry.createEntity( [{'@c':'/component/flower', colour:'magenta'}] ));

        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
        t.end();
    });
});


test('removing a relevant component from an entity should trigger a entity:remove event', t => {
    let entity;
    const eventSpy = Sinon.spy();
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const query = (Q) => Q.all('/component/channel');
        // var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
        const view = entitySet.view( query, {updateOnEvent:true} );

        // printIns( entitySet, 1 );
        view.on('all', eventSpy);

        // logEvents( entitySet, 'e es' );
        // logEvents( view, 'e view' );

        // remove an unrelated component to the view
        entitySet.removeComponent( entitySet.at(0).Status );
        
        // printE( view.at(0).Channel );
        // remove the score component from the first entity in the view
        entitySet.removeComponent( view.at(0).Channel, );

        // printE( entitySet.at(0) );
        // printE( view.at(0) );
        
        // t.ok( eventSpy.calledOnce, 'only one event emitted from the view' );
        t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

        t.end();
    });
});


test('adding selected entities', async t => {
    try{
    
    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();

    const view = entitySet.view( Q => Q.all('/component/status') );

    entitySet.addEntity( {'@c':'/component/position', x:0,y:2});
    entitySet.addEntity( {'@c':'/component/status', status:'active'});
    entitySet.addEntity( {'@c':'/component/name', name:'alice'});

    // Log.debug('es is', entityToString(entitySet));
    // Log.debug('view is', entityToString(view));

    t.equals(view.length,1,'only 1 entity added');

    t.end();
    }catch(err){Log.error(err.stack);}
});

test('deferred addition of components with a filter', async t => {
    try{
    
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        
        const query = (Q) => Q.all('/component/position');
        const view = entitySet.view(query);

        view.on('all', eventSpy);

        // const entity = entitySet.addEntity(
        //     registry.createEntity([
        //         { '@c':'/component/flower', colour:'blue'}] ));
        const entity = entitySet.addEntity( {'@c':'/component/flower', colour:'blue'} );

        // view.applyEvents();

        t.equals( view.length, 0, 'no entities yet' );

        entitySet.addEntity( {'@c':'/component/position', x:10, y:100} );
        // entitySet.addComponent(
        //     registry.createComponent({'@c':'/component/position', x:10, y:100}, entity ) );

        // a new component added to a view needs an event being applied
        view.applyEvents();

        t.equals( view.length, 1, 'only one entity added' );

        t.end();
    }catch(err){Log.error(err.stack);}
});


test('applying a filter', t => {
    initialiseEntitySet('entity_set.entities').then( ([registry,entitySet]) => {
        const query = (Q) => Q.all(['/component/position', '/component/realname']);
        const view = entitySet.view( query );
        
        // printE( entitySet );
        // printE( view );
        t.ok( view.at(0).Position, 'the entity should have /position' );
        t.ok( view.at(0).Realname, 'the entity should have /realname' );

        t.ok( view.at(1).Position, 'the entity should have /position' );
        t.ok( view.at(1).Realname, 'the entity should have /realname' );

        t.end();
    });
});


test('views created with a filter', t => {

    initialiseEntitySet('entity_set.entities').then( ([registry,entitySet]) => {
        const query = (Q) => Q.none('/component/position');
        const view = entitySet.query( query );

        // add another entity to the ES which the view should ignore
        entitySet.addComponent([
            registry.createComponent( '/component/flower', {colour:'red'}),
            registry.createComponent( '/component/position', {x:-2,y:5})] );

        t.equals( view.length, 2, 'two entities');

        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
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

test('deferred removal of an entity', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        entitySet = registry.createEntitySet();
        const view = entitySet.view();

        // Common.logEvents( entitySet );

        entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/flower', colour:'blue'},
                { '@c':'/component/position', x:10, y:60 }] ));

        entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/vegetable', name:'cauliflower'},
                { '@c':'/component/radius', radius:0.3 }] ));

        // view.applyEvents();

        t.equals( view.length, 2, 'two entities added' );

        entitySet.removeEntity( entitySet.at(1) );

        // t.equals( view.length, 2, 'still two entities' );    

        // view.applyEvents();

        t.equals( view.length, 1, 'now one entity' );    

        t.end();
    });
});


test('deferred removal of an entity triggers correct events', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
    
        entitySet = registry.createEntitySet();
        const view = entitySet.view();
        let entityA, entityB;
        
        const eventSpy = Sinon.spy();

        // Common.logEvents( view );

        entityA = entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/flower', colour:'blue'},
                { '@c':'/component/position', x:10, y:60 }] ));

        entityB = entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/vegetable', name:'cauliflower'},
                { '@c':'/component/radius', radius:0.3 }] ));

        // view.applyEvents();

        view.on('all', eventSpy);
        entitySet.removeEntity( entityA );
        entitySet.removeEntity( entityB );

        t.ok( eventSpy.calledTwice, 'only two event emitted from the view' );
        t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

        t.end();
    });
});

test('altering a component in the view also changes the component in the entityset', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        entitySet = registry.createEntitySet();
        const view = entitySet.view();

        // Common.logEvents( entitySet );

        entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/flower', colour:'blue'},
                { '@c':'/component/radius', radius:0.1 }] ));

        // view.applyEvents();

        view.at(0).Flower.set('colour', 'cyan');

        t.equals( entitySet.at(0).Flower.get('colour'), 'cyan', 'colours should match');

        t.end();
    });
});


test('changing a component in the view triggers a change event', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        entitySet = registry.createEntitySet();
        let view = entitySet.view(null,{updateOnEvent:false});

        let viewSpy = Sinon.spy(), esSpy = Sinon.spy();
        entitySet.on('all', esSpy);
        view.on('all', viewSpy);

        // Common.logEvents( entitySet, 'es:evt' );
        // Common.logEvents( view, 'view:evt' );

        entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/flower', colour:'yellow', type:'daisy'},
                { '@c':'/component/radius', radius:0.4 }] ));

        
        // log.debug('from here');
        // view.on('component:change', component => {
        // });

        view.at(0).Flower.set('colour', 'magenta');

        t.ok( viewSpy.calledWith('component:change'), 'change event emitted from view');
        t.ok( esSpy.calledWith('component:change'), 'change event emitted from entitySet');

        // view.applyEvents({debug:true});

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


function initialise( entities ){
    let registry = Common.initialiseRegistry(false);
    let entitySet = Common.loadEntities( registry, (entities||'query.entities') );
    return [registry,entitySet];
}

function initialiseEntitySet( entityDataName = 'query.entities' ){
    return initialiseRegistry(false).then( registry => {
        let entitySet = loadEntities( registry, entityDataName );
        return [registry,entitySet];
    });
}
