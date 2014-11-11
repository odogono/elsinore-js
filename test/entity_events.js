var test = require('tape');
var Common = require('./common');
var Es = require('event-stream');
var Sinon = require('sinon');
var Promise = require('bluebird');
Promise.longStackTraces();

var Elsinore = Common.Elsinore;
var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;


test.only('triggering an event on an entity', function(t){
    var self = this;
    return registerComponents(self).then(function(){
        var eventSpy = Sinon.spy();
        self.entitySet.listenToEntityEvent( 'msg', eventSpy );
        
        self.entitySet.addComponent( self.createComponent( '/component/animal', {id:5,_e:1, name:'tiger'}) );

        self.entitySet.triggerEntityEvent( self.entitySet.at(0), 'msg', 'hello there' );

        t.ok( eventSpy.calledWith('msg'), 'msg event should have been called' );

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



function registerComponents(self, logEvents){
    self.entitySet = EntitySet.create();
    self.registry = Registry.create().initialize();
    self.ComponentDefs = self.registry.ComponentDef;
    if( logEvents ){
        logEvents( self.registry );
    }

    self.createComponent = function( type, attrs ){
        return self.registry.getComponentDef( type ).create(attrs);    
    }

    return new Promise(function(resolve){
        self.registry.registerComponent( Common.loadJSONFixture('components.json') ); 
        return resolve( self.registry );
    });
}

function logEvents(reg){
    reg = reg || registry;
    reg.on('all', function(evt){
        log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
    });
}