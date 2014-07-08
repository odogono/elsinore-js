var test = require('tape');
var Common = require('./common');
var P = require('bluebird');
P.longStackTraces();

var entities, registry, storage, ComponentDefs;

test('not retrieve an entity by its id without it having a component', function(t){
    return beforeEach().then( function(){
        return storage.retrieveEntity( {id:36} )
            .catch(Error, function(e){
                t.equals(e.message, 'entity 36 not found')
                t.end();
            });
        });
});


test('retrieve an entity with a component', function(t){
    return beforeEach().then( function(){
        var component = registry.createComponent({_s:'/component/flower',colour:'yellow', _e:36},{save:false});
        return storage.saveComponents( [component] )
            .then(function(){
                return storage.retrieveEntity({id:36});
            })
            .then(function(entity){
                t.equal( entity.id, 36 );
                t.equal( entity.Flower.get('colour'), 'yellow');
                t.end();
            });
        });
});


test('should know that an entity does not exist', function(t){
    return beforeEach().then( function(){
        return storage.hasEntity( {id:37} )
            .then(function(val){
                t.equals(val, false)
                t.end();
            });
        });
});

test('create a new entity', function(t){
    return beforeEach().then( function(){
        // storage.on('all', function(evt){
        //     log.debug('storage evt ' + JSON.stringify( _.toArray(arguments)) );
        // });
        var component = registry.createComponent({_s:'/component/animal',name:'tiger'},{save:false});
        t.equals(component.getEntityId(), undefined);
        return storage.saveComponents( [component], {createEntity:true} )
            .then( function(components){
                t.ok( component.getEntityId(), 'the component entity id should be present' );
                t.end();
            });
        });
});



test('destroy an entity', function(t){
    return beforeEach().then( createTestComponent )
    .then( function(){
        return storage.destroyEntity( {id:981} )
            .then( function(){
                return storage.hasEntity( {id:981} );
            })
            .then( function(val){
                t.equal( val, false, 'the entity should not exist');
                t.end();
            })
        });
});

test('emit an event when the entity is destroyed', function(t){
    return beforeEach().then( createTestComponent )
    .then( function(){
        // storage.on('all', function(evt){
        //     log.debug('storage evt ' + JSON.stringify( _.toArray(arguments)) );
        // });
        var eventSpy = Sinon.spy();
        storage.on('entity:remove', eventSpy);

        return storage.destroyEntity({id:981})
            .then( function(){
                t.ok( eventSpy.called );
                t.equals( eventSpy.getCall(0).args[0], 981 );
                t.end();
            });
        });
});


function createTestComponent(){
    return registry.createComponent({_s:'/component/mineral', name:'rock', _e:981});
}

function beforeEach() {
    return Common.createAndInitialize()
        .then(function(pStorage){ 
            storage = pStorage;
            registry = storage.registry;
        })
        .then(function(){
            return registry.registerComponent( Common.loadJSONFixture('components.json') );
        });
}