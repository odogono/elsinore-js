import test from 'tape';


import Sinon from 'sinon';


import {
    createLog,
    // Component, Entity, EntityFilter, EntitySet,
    // Registry, ComponentRegistry,
    entityToString,
    initialiseRegistry, 
    stringify,
} from './common';

import { Base } from '../src/base';
import { Events } from '../src/util/events';
// import '../src/entity_set/view';
import '../src/entity_set/async_view';
import { create as createROView } from '../src/entity_set/ro_view';

const Log = createLog('TestEntityEvents');


test('triggering an event on an entity', async t => {
    try{
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        // listen to all msg events from all entities
        entitySet.on( 'msg', eventSpy );
        // entitySet.listenToEntityEvent( 'all', function(){
        //     Log.debug('!eevt ' + JSON.stringify(arguments));
        // } );

        // entitySet.listenToEntityEvent( 'msg', function( name ){
        //     Log.debug('2!eevt '  + JSON.stringify(arguments));
        // } );
        
        entitySet.addEntity( {'@c':'/component/animal', name:'tiger'} );

        // entitySet.addComponent( registry.createComponent( '/component/animal', {id:5,_e:1, name:'tiger'}) );

        entitySet.triggerEntityEvent( 'msg', entitySet.at(0), 'hello there' );

        t.ok( eventSpy.called, 'msg event should have been called' );

        t.end();
    } catch( err ){
        Log.error( err.stack );
    }
});


test('the registry triggers the event on entitysets', async t => {
    try{
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        // Common.logEvents( entitySet, 'ese!' );
        entitySet.on('all', eventSpy );
        
        entitySet.addEntity( {'@c':'/component/animal', name:'tiger'} );
        entity = entitySet.getUpdatedEntities();

        entity.triggerEntityEvent( 'msg', 'close the door');

        t.ok( eventSpy.calledWith('msg', entity, entitySet, 'close the door'), 'entity was called with event' );

        t.end();
    } catch( err ){
        Log.error( err.stack );
    }
});


test('the registry triggers the event on a compatible entityset', async t => {
    try{
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;
        
        let mineralCalled = false, animalCalled = false, mainCalled = false;

        let mineralEntitySet = createROView( entitySet, Q => Q.all('/component/mineral'));
        let animalEntitySet = createROView( entitySet, Q => Q.all('/component/animal'));

        // registry.addEntitySet( mineralEntitySet );
        // registry.addEntitySet( animalEntitySet );

        entitySet.on('msg', () => mainCalled = true );    
        mineralEntitySet.on('msg', () => mineralCalled = true );
        animalEntitySet.on('msg', () => animalCalled = true );

        entitySet.addEntity({'@c':'/component/animal', name:'tiger'});
        entity = entitySet.getUpdatedEntities();

        // Log.debug('altered e', entity, entityToString(entity) );

        entity.triggerEntityEvent( 'msg', 'welcome' );

        t.notOk( mineralCalled, 'events not triggered on mineral entitySet');
        t.ok( animalCalled, 'events triggered on animal entitySet');
        t.ok( mainCalled, 'events triggered on base entitySet');
        
        t.end();
    } catch( err ){
        Log.error( err.stack );
    }
    
});



test('triggers events which are stored until release', async t => {
    try{
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        let received = false;
        let listener = Object.assign({}, Events);

        listener.listenToAsync( entitySet, 'msg', (evt,msgEntity,...args) => {
            received = true;
            t.equals( msgEntity.Animal.get('name'), 'tiger' );
        });

        
        entitySet.addEntity({'@c':'/component/animal', name:'tiger'});
        entity = entitySet.getUpdatedEntities();

        entitySet.triggerEntityEvent( 'msg', entity );

        listener.releaseAsync();

        t.ok( received, 'the msg was received' );

        t.end();
    } catch( err ){
        Log.error( err.stack );
    }
});


test('still triggers on normal listeners', async t => {
    try{
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        let received = false;
        let listener = Object.assign({}, Events);

        listener.listenTo( entitySet, 'msg', msgEntity => {
            received = true;
            t.equals( msgEntity.Animal.get('name'), 'tiger' );
        });

        entitySet.addEntity({'@c':'/component/animal', name:'tiger'});
        entity = entitySet.getUpdatedEntities();

        entitySet.triggerEntityEvent( 'msg', entity );

        t.ok( received, 'the msg was received' );
        
        t.end();
    } catch( err ){
        Log.error( err.stack );
    }
});

// test('listen to events on entities that have certain components');

test.skip('triggering an event on all entities', function(t){
    return registerComponents().then( function(){

        var eventSpy = Sinon.spy();
        entitySet.listenToEntityEvent( 'msg', eventSpy );

        entitySet.addComponent([
            registry.createComponent( '/component/animal', {id:6,_e:2, name:'snake'}),
            registry.createComponent( '/component/animal', {id:7,_e:3, name:'chicken'}),
        ]);

        entitySet.triggerEntityEvent( null, 'msg', 'who ate the fish?' );

        t.ok( eventSpy.calledOnce );

        t.equal( eventSpy.getCall(0).args[0][1].id, 3, 'first argument should be an array of entities called' );
        t.equal( eventSpy.getCall(0).args[1], 'msg', 'second argument should be the name' ); 
        t.equal( eventSpy.getCall(0).args[2], 'who ate the fish?', 'third argument should be the message' ); 

        t.end();
    })
})

/**

// 
// Registers to listen to events sent to entities
// the 1st arg describes which components the entity should have
// the 3rd arg specifies the callback and the 3rd details the this argument for the callback
this.registry.listenToEntityEvent( '/component/connection', 'msg', this.onEntityMessage, this );

entitySet.listenTo( 'msg', this.onEntityMessage, this );

*/



/**

triggerEntityEvent will forward the event to each of the entitysets which have listeners

// send to one
this.registry.triggerEntityEvent( entity, 'msg', 'welcome to the room' );
entitySet.triggerEntityEvent( entity, 'msg', 'welcome to the room');

// sent to all
this.registry.triggerEntityEvent( [entity, entityB], 'msg', 'welcome to the room' );

// send to all entities
this.registry.triggerEntityEvent( null, 'msg', 'welcome to the room' );

*/



// compile a map of schema id(uri) to schema
// var componentData = _.reduce( require('./fixtures/components.json'), 
//                         function(memo, entry){
//                             memo[ entry.id ] = entry;
//                             return memo;
//                         }, {});


// function initialiseRegistry(logEvents){
//     var registry = Registry.create();
//     // ComponentDefs = registry.ComponentDef;
//     if( logEvents ){
//         Common.logEvents( registry );
//     }

//     registry.registerComponent( componentData );

//     return registry;
// }