var test = require('tape');
var Common = require('./common');
var P = require('bluebird');
P.longStackTraces();

var entities, registry, storage, ComponentDefs;


test('throw an error attempting to save a component without an entity', function(t){
    return beforeEach().then( function(){
        var component = Elsinore.Component.create();
        return storage.saveComponents( [component] )
            .catch(Error, function(e){
                t.equals(e.message, 'component is not attached to an entity')
                t.end();
            });
    });
});

test('throw an error attempting to save a component without a ComponentDef', function(t){
    return beforeEach().then( function(){
        var component = Elsinore.Component.create();
        component.setEntityId( 122 );
        return storage.saveComponents( [component] )
            .catch(Error, function(e){
                t.equals(e.message, 'component has no def')
                t.end();
            });
    });
});

test('give a new component an id after creating', function(t){
    return beforeEach().then( function(){
        var component = registry.getComponentDef('/component/flower').create({colour:'yellow', _e:123});
        t.equals(component.isNew(), true, 'component should be new' );
        t.equals(component.id, undefined, 'component should not have an id');

        return storage.saveComponents( [component] )
            .then( function(components){
                t.equal(components[0].isNew(), false, 'component should not be new');
                t.notEqual(components[0].id, undefined,'component should have an id');
                t.end();
            });
        });
});


test('should create an array of components', function(t){
    return beforeEach().then( function(){
        var components = registry.createComponent([
            {_s:'/component/flower', name:'daisy', _e:125},
            {_s:'/component/flower', name:'rose', _e:125},
            {_s:'/component/flower', name:'bluebell', _e:125}
        ], {save:false});

        return storage.saveComponents( components )
            .then( function(components){
                t.equal( components[2].isNew(),false, 'component should not be new' );
                t.end();
            });
        });
});

test('retrieve a component by id', function(t){
    return beforeEach().then( function(){
        var component = registry.createComponent({_s:'/component/flower',_e:126,name:'nog'}, {save:false});
        return storage.saveComponents( [component] )
            .then( function(components){
                return storage.retrieveComponentById( components[0].id )
                    .then( function(component){
                        t.equals( component.get('name'), 'nog' );
                        t.end();
                    })
            });
        });
});

test('throw an error when retrieving an unknown component', function(t){
    return beforeEach().then( function(){
        return storage.retrieveComponentById( 403 )//.should.be.rejectedWith(Error, 'component 403 not found');
            .catch( Error, function(e){
                t.equals(e.message, 'component 403 not found', 'the component should not be found');
                t.end();
            });
    });
});


test('retrieve components by a schema id', function(t){
    return beforeEach().then( function(){
        var def = registry.getComponentDef('/component/realname');
        return registry.createComponent({ _s:'/component/realname', name:'alex', _e:128})
            .then( function(component){
                return storage.retrieveComponentsByComponentDef( def );
            })
            .then( function(components){
                t.equals( components.length, 1 );
                t.equals( components[0].get('name'), 'alex');
                t.end();
            });
        });
});


test('should delete all components', function(t){
    return beforeEach().then( createComponents ).then( function(){
        return storage.retrieveComponents()
            .then( function(components){
                t.equals( components.length, 6, 'there should be 6 components');
                return storage.destroyComponents();
            })
            .then( function(){
                return storage.retrieveComponents();
            })
            .then( function( components){
                t.equals( components.length, 0, 'there should be no components' );
                t.end();
            });
        });
});

test('should delete all components of a given type', function(t){
    return beforeEach().then( createComponents ).then( function(){
        var def = registry.getComponentDef('/component/mineral')
        return storage.destroyComponents( def )
            .then( function(){
                return storage.retrieveComponents();
            })
            .then( function( components){
                t.equals( components.length, 3 );
                t.end();
            });
        });
});

// test('should update the status of a component');

// test('should retrieve components that belong to a set of ids');

// test('should retrieve active components');

// test('should retrieve inactive components');

// test('should retrieve components that do not have an entity');


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


function createComponents(){
    return registry.createComponent([
        { _s:'/component/vegetable', name:'carrot', _e:129 },
        { _s:'/component/vegetable', name:'tomato', _e:130 },
        { _s:'/component/vegetable', name:'broccoli', _e:131 },
        { _s:'/component/mineral', name:'quartz', _e:129 },
        { _s:'/component/mineral', name:'topaz', _e:130 },
        { _s:'/component/mineral', name:'diamond', _e:131 }
    ]);
}