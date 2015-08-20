var _ = require('underscore');
var test = require('tape');

var Common = require('./common');


var Es = require('event-stream');
var Sinon = require('sinon');

var Elsinore = Common.Elsinore;

var EventsAsync = Common.requireLib('util/events.async');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;


test('triggering an event on an entity', function(t){
    var entity, registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    // listen to all msg events from all entities
    entitySet.on( 'msg', eventSpy );
    // entitySet.listenToEntityEvent( 'all', function(){
    //     log.debug('!eevt ' + JSON.stringify(arguments));
    // } );

    // entitySet.listenToEntityEvent( 'msg', function( name ){
    //     log.debug('2!eevt '  + JSON.stringify(arguments));
    // } );
    
    entity = registry.createEntity( { id:'/component/animal', name:'tiger' } );
    entity = entitySet.addEntity( entity );

    // entitySet.addComponent( registry.createComponent( '/component/animal', {id:5,_e:1, name:'tiger'}) );

    entitySet.triggerEntityEvent( 'msg', entitySet.at(0), 'hello there' );

    t.ok( eventSpy.called, 'msg event should have been called' );

    t.end();
});


test('the registry triggers the event on entitysets', function(t){
    var entity, registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    // Common.logEvents( entitySet, 'ese!' );
    entitySet.on('all', eventSpy );
    entitySet.on('all', function( entity ){
        // printIns( arguments );
        // log.debug('called msg with ' + entity.id );
    });

    entity = entitySet.addEntity( 
        registry.createEntity( { id:'/component/animal', name:'tiger' } ) );

    // registry.triggerEntityEvent( 'msg', entity, 'close the door' );
    entity.triggerEntityEvent( 'msg', 'close the door');

    t.ok( eventSpy.calledWith('msg', entity, 'close the door'), 'entity was called with event' );

    t.end();
});


test('the registry triggers the event on a compatible entityset', function(t){
    var entity, registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    
    var mineralCalled = false, animalCalled = false, mainCalled = false;

    var mineralEntitySet = entitySet.where('/component/mineral');
    var animalEntitySet = entitySet.where('/component/animal');

    registry.addEntitySet( mineralEntitySet );
    registry.addEntitySet( animalEntitySet );

    entitySet.on('msg', function(){ mainCalled = true; });    
    mineralEntitySet.on('msg', function(){ mineralCalled = true; });
    animalEntitySet.on('msg', function(){ animalCalled = true; });

    entity = entitySet.addEntity( 
        registry.createEntity( { id:'/component/animal', name:'tiger' } ) );

    entity.triggerEntityEvent( 'msg', 'welcome' );
    // registry.triggerEntityEvent( 'msg', entity, 'welcome' );

    t.notOk( mineralCalled, 'events triggered only on base entitySet and animal entitySet');
    t.ok( animalCalled, 'events triggered only on base entitySet and animal entitySet');
    
    t.end();
});



test('triggers events which are stored until release', function(t){
    var entity, registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var received = false;
    var listener = _.extend({
    }, EventsAsync);

    listener.listenToAsync( entitySet, 'msg', function(msgEntity){
        received = true;
        t.equals( msgEntity.Animal.get('name'), 'tiger' );
    });

    entity = entitySet.addEntity( 
        registry.createEntity( { id:'/component/animal', name:'tiger' } ) );

    entitySet.triggerEntityEvent( 'msg', entity );

    listener.releaseAsync();

    t.ok( received, 'the msg was received' );
    t.end();
});


test('still triggers on normal listeners', function(t){
    var entity, registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var received = false;
    var listener = _.extend({
    }, EventsAsync);

    listener.listenTo( entitySet, 'msg', function(msgEntity){
        received = true;
        t.equals( msgEntity.Animal.get('name'), 'tiger' );
    });

    entity = entitySet.addEntity( 
        registry.createEntity( { id:'/component/animal', name:'tiger' } ) );

    entitySet.triggerEntityEvent( 'msg', entity );

    t.ok( received, 'the msg was received' );
    t.end();
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
var componentData = _.reduce( require('./fixtures/components.json'), 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});


function initialiseRegistry(logEvents){
    var registry = Registry.create();
    // ComponentDefs = registry.ComponentDef;
    if( logEvents ){
        Common.logEvents( registry );
    }

    registry.registerComponent( componentData );

    return registry;
}