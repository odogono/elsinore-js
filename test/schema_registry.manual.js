import _ from 'underscore';
import test from 'tape';

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

import ComponentRegistry from '../src/schema/index';


import * as Utils from '../src/util/index';



const COMPONENT_DEFINITIONS = [
    { uri:'/component/position', properties:{ x:0, y:0, z:0, rotation:0 }, name:'Position', hash:'bd12d7de' },
    { uri:'/component/radius', properties:{ radius:0}, name:'Radius' },
    { uri:'/component/status', properties:{ status:"active"}, name:'Status' },
    { uri:'/component/name', properties:{ name:""}, name:'Name', hash:'c6c1bcdf' },
    { uri:'/component/geo_location', properties:{ lat:0, lng:0 }, name:'Geolocation' },
];







test('basics', t => {

    const componentRegistry = ComponentRegistry.create();
    // console.log('we have here', componentRegistry);
    // logEvents( componentRegistry );

    componentRegistry.register( COMPONENT_DEFINITIONS );
    // const registry = Registry.create({schemaRegistry:componentRegistry});
    // console.log( componentRegistry.getSchema('/component/status', {throwOnNotFound:true}) );

    let component = componentRegistry.createComponent('/component/status');

    t.equals( component.get('status'), 'active' );
    
    t.end();
});

test('each component def has an integer id');


test('registering a schema without a name', t => {
    const registry = ComponentRegistry.create();
    registry.register( { uri:'/component/example' } );

    let component = registry.createComponent('/component/example');

    t.equals( component.name, 'Example' );

    t.end();
})

test('retrieving all of the registered schemas', t => {
    const registry = ComponentRegistry.create();
    registry.register([
        { uri:'/component/example' },
        { uri:'/component/removed' },
        {uri:'/component/position', properties:{ x:0, y:0 }},
        { uri:'/component/placeholder' },
    ]);

    registry.unregister( '/component/removed' );

    t.deepEquals(
        registry.getAll(),
        [ 
            { id: 1, name: 'Example', uri: '/component/example' }, 
            { id: 3, name: 'Position', properties: { x: 0, y: 0 }, uri: '/component/position' }, 
            { id: 4, name: 'Placeholder', uri: '/component/placeholder' } 
        ]
    );

    t.end();
})


test('registering a schema with default properties', t => {
    const registry = ComponentRegistry.create();
    registry.register( {
        uri: '/component/origin',
        properties: {
            place: 'Exeter',
            count: 22
        }
    } );

    let component = registry.createComponent('/component/origin');

    t.equals( component.get('place'), 'Exeter' );
    t.equals( component.get('count'), 22 );

    t.end();
})

test('registering a schema with typed default properties', t => {
    const registry = ComponentRegistry.create();
    registry.register( {
        "uri": "/component/score",
        "properties": {
            "score": { "type":"integer" },
            "lives": { "type":"integer", "default": 3 }
        }
    });

    let component = registry.createComponent('/component/score');

    t.equals( component.get('score'), 0);
    t.equals( component.get('lives'), 3);
    t.end();
});



test('attempting to retrieve an unknown schema throws an error', t => {
    const registry = ComponentRegistry.create(COMPONENT_DEFINITIONS);

    t.throws(()=>registry.getIId('/component/missing'), new Error('could not find schema /component/missing') );
    
    t.end();
});


test('returns an array of schema internal ids from a series of identifiers', t => {
    const registry = ComponentRegistry.create(COMPONENT_DEFINITIONS);

    // console.log( registry._componentDefs.map( c => c.id + ':' + c.getUri() + ':' + c.hash() ) )

    t.deepEqual(
        registry.getIId( ['/component/position', 'cc425723', 2, '/component/geo_location', '67667d21'] ),
        [ 1, 4, 2, 5, 1 ] );

    t.end();
});

test('unregistering a schema', t => {
    const registry = ComponentRegistry.create(COMPONENT_DEFINITIONS);
    
    registry.unregister( '/component/status' );
    
    t.throws(()=>registry.createComponent('/component/status'), 
        new Error('could not find schema /component/status') );
    
    t.end();
});

test('creating a component with attributes', t => {
    const registry = ComponentRegistry.create();
    registry.register( {name:'velocity', properties:{ x:0, y:0, z:0 }, uri:'/component/velocity'} );
    let component = registry.createComponent( '/component/velocity', { x:-200} );
    
    t.equals( component.get('x'), -200 );
    
    t.end();
    
})