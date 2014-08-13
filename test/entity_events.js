var test = require('tape');
var Common = require('./common');
var Es = require('event-stream');
var Sinon = require('sinon');
var P = require('bluebird');
P.longStackTraces();

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;


test('triggering an event on an entity', function(t){
    return registerComponents().then(function(){
        var eventSpy = Sinon.spy();
        entitySet.listenToEntityEvent( 'msg', eventSpy );
        
        entitySet.addComponent( createComponent( ComponentDefs.Animal, {id:5,_e:1, name:'tiger'}) );

        entitySet.triggerEntityEvent( entitySet.at(0), 'msg', 'hello there' );

        t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );

        t.end();
    });
});

test('triggering an event on all entities', function(t){
    return registerComponents().then( function(){

        var eventSpy = Sinon.spy();
        entitySet.listenToEntityEvent( 'msg', eventSpy );

        entitySet.addComponent([
            createComponent( ComponentDefs.Animal, {id:6,_e:2, name:'snake'}),
            createComponent( ComponentDefs.Animal, {id:7,_e:3, name:'chicken'}),
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

function registerComponents(logEvents){
    entitySet = EntitySet.create();
    return Registry.create().initialize()
        .then(function(reg){
            registry = reg;
            ComponentDefs = registry.ComponentDef;
            if( logEvents ){
                logEvents( registry );
            }
            return registry.registerComponent( Common.loadJSONFixture('components.json') );
        });
}

function createComponent( type, attrs ){
    return registry.getComponentDef( type ).create(attrs);
}