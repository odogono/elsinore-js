import _  from 'underscore';
import test from 'tape';


import Es from 'event-stream';
import Sinon from 'sinon';


import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query, SchemaRegistry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';

import * as EventsAsync from '../src/util/events.async';
import '../src/entity_set/view';


test('triggering an event on an entity', function(t){
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        // listen to all msg events from all entities
        entitySet.on( 'msg', eventSpy );
        // entitySet.listenToEntityEvent( 'all', function(){
        //     log.debug('!eevt ' + JSON.stringify(arguments));
        // } );

        // entitySet.listenToEntityEvent( 'msg', function( name ){
        //     log.debug('2!eevt '  + JSON.stringify(arguments));
        // } );
        
        entity = Entity.create(registry, [{'@c':'/component/animal', name:'tiger'}]);
        entity = entitySet.addEntity( entity );

        // entitySet.addComponent( registry.createComponent( '/component/animal', {id:5,_e:1, name:'tiger'}) );

        entitySet.triggerEntityEvent( 'msg', entitySet.at(0), 'hello there' );

        t.ok( eventSpy.called, 'msg event should have been called' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});


test('the registry triggers the event on entitysets', function(t){
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        // Common.logEvents( entitySet, 'ese!' );
        entitySet.on('all', eventSpy );
        entitySet.on('all', entity => {
            // printIns( arguments );
            // log.debug('called msg with ' + entity.id );
        });

        entity = Entity.create(registry, [{'@c':'/component/animal', name:'tiger'}]);
        entity = entitySet.addEntity(entity);

        // registry.triggerEntityEvent( 'msg', entity, 'close the door' );
        entity.triggerEntityEvent( 'msg', 'close the door');

        t.ok( eventSpy.calledWith('msg', entity, 'close the door'), 'entity was called with event' );

    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});


test('the registry triggers the event on a compatible entityset', function(t){
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;
    
        let mineralCalled = false, animalCalled = false, mainCalled = false;

        let mineralEntitySet = entitySet.view( Query.all('/component/mineral'));
        let animalEntitySet = entitySet.view( Query.all('/component/animal'));


        registry.addEntitySet( mineralEntitySet );
        registry.addEntitySet( animalEntitySet );

        entitySet.on('msg', () => mainCalled = true );    
        mineralEntitySet.on('msg', () => mineralCalled = true );
        animalEntitySet.on('msg', () => animalCalled = true );

        entity = Entity.create(registry, [{'@c':'/component/animal', name:'tiger'}]);
        entity = entitySet.addEntity(entity);

        entity.triggerEntityEvent( 'msg', 'welcome' );

        t.notOk( mineralCalled, 'events not triggered on mineral entitySet');
        t.ok( animalCalled, 'events triggered on animal entitySet');
        t.ok( mainCalled, 'events triggered on base entitySet');
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});



test('triggers events which are stored until release', t => {
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        let entity;

        var received = false;
        var listener = _.extend({
        }, EventsAsync);

        listener.listenToAsync( entitySet, 'msg', (evt,msgEntity) => {
            received = true;
            t.equals( msgEntity.Animal.get('name'), 'tiger' );
        });

        entity = Entity.create(registry, [{'@c':'/component/animal', name:'tiger'}]);
        entity = entitySet.addEntity(entity);

        entitySet.triggerEntityEvent( 'msg', entity );

        listener.releaseAsync();

        t.ok( received, 'the msg was received' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});


test('still triggers on normal listeners', function(t){
    return initialiseRegistry().then( registry => {
            const entitySet = registry.createEntitySet();
            const eventSpy = Sinon.spy();
            let entity;

        let received = false;
        let listener = _.extend({}, EventsAsync);

        listener.listenTo( entitySet, 'msg', function(msgEntity){
            received = true;
            t.equals( msgEntity.Animal.get('name'), 'tiger' );
        });

        entity = Entity.create(registry, [{'@c':'/component/animal', name:'tiger'}]);
        entity = entitySet.addEntity(entity);

        entitySet.triggerEntityEvent( 'msg', entity );

        t.ok( received, 'the msg was received' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
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