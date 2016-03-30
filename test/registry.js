import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';


import mapComponentEntityRefs from '../src/util/map_entity_refs';


test.skip('keeping a map of entitySets and views', t => {
    return initialiseRegistry().then( registry => {

        let query = Query.all('/component/position');
        
        // let eso = registry.createEntitySet();

        // printE( es );
        let es = registry.createEntitySet();
        let view = es.view( query );
        let oview = es.view( query);
        let tview = es.view();

        log.debug( 'es hash ' + es.hash() );
        // log.debug( 'eso hash ' + eso.hash() );
        log.debug( 'view hash ' + view.hash());
        log.debug( 'oview hash ' + oview.hash() );
        log.debug( 'tview hash ' + tview.hash() );

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});



test('creating an entityset with an identical uuid throws an error', t => {
    return initialiseRegistry().then( registry => {
        const es = registry.createEntitySet({uuid:'50FC7026-C6DB-4FEB-991D-061A07CBD210'});
        t.equals( es.getUuid(), '50FC7026-C6DB-4FEB-991D-061A07CBD210' );

        t.throws( () => registry.createEntitySet({uuid:'50FC7026-C6DB-4FEB-991D-061A07CBD210'}), 
            new Error('entityset with uuid 50FC7026-C6DB-4FEB-991D-061A07CBD210 already exists') );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});




// creating components

test('create from a schema', t => {
    return initialiseRegistry({loadComponents:false}).then( registry => {
        let componentData = loadComponents();
        // Common.logEvents( registry );
        // passing a schema as the first argument will cause the component to be
        // registered at the same time
        return registry.registerComponent( componentData['/component/position'] )
            .then( () => {
                let component = registry.createComponent( '/component/position', { x:200 } );
                t.equals( component.schemaUri, '/component/position' );
                t.equals( component.schemaHash, '9db8f95b' );
                t.equals( component.get('x'), 200 );

                t.end();
            })
    })
    .catch( err => log.error('test error: %s', err.stack) )
});

test('create from a schema hash', t => {
    return initialiseRegistry({loadComponents:true}).then( registry => {
    // let componentData = loadComponents();
    // var def = registry.registerComponent( componentData['/component/score'] );
        let component = registry.createComponent( 'd3f0bf51', {score:200} );
        
        t.equals( component.get('score'), 200 );
        t.equals( component.get('lives'), 3 );

        t.end();
    });
});

test('create from a pre-registered schema', t => {
    return initialiseRegistry({loadComponents:true}).then( registry => {
        let component = registry.createComponent( '/component/nickname', {nickname:'peter'} );

        t.equals( component.get('nickname'), 'peter' );

        t.end();
    });
});

test('create from a pre-registered schema using data object', t => {
    return initialiseRegistry({loadComponents:true}).then( registry => {
        let component = registry.createComponent( {'@c':'/component/nickname', nickname:'susan'} );
        t.equals( component.get('nickname'), 'susan', 'the component is created with attributes' );
        t.end();
    });
});

test('create from an array of data', t => {
    return initialiseRegistry({loadComponents:true}).then( registry => {
        let components = registry.createComponent( '/component/position', [ {x:0,y:-1}, {x:10,y:0}, {x:15,y:-2} ] );

        t.equals( components.length, 3, 'three components should have been created' );
        t.equals( components[1].get('x'), 10, 'the component attributes should be applied' );

        t.end();
    });
});

test('create with an entity id', t => {
    return initialiseRegistry().then( registry => {

        let component = registry.createComponent( {'@c':'/component/nickname', '@e':15} );
        t.equals( component.getEntityId(), 15, 'the entity id is retrieved' );

        component = registry.createComponent( {'@c':'/component/nickname', '@e':15, '@es':10} );
        t.equals( component.getEntityId(), 42949672975, 'the entity id is retrieved' );

        t.end();

    });
});


test('updating a components entity refs', t => {
    return initialiseRegistry().then( registry => {
        let component = registry.createComponent( 
            {"@e":12, "@c": "/component/channel_member", "channel": 1, "client": 5} );
        
        let aComponent = mapComponentEntityRefs( registry, component, { 5: 290, 1: 340} );

        t.equals( aComponent.get('channel'), 340 );
        t.equals( aComponent.get('client'), 290 );

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});
