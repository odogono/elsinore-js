var _ = require('underscore');
var test = require('tape');

var Common = require('./common');


var Es = require('event-stream');
var Sinon = require('sinon');
var Promise = require('bluebird');
// Promise.longStackTraces();

var Elsinore = require('../lib');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;
// var JSONComponentParser = require('../lib/streams').JSONComponentParser;


// var registry, storage, ComponentDefs;

// compile a map of schema id(uri) to schema
var componentData = _.reduce( require('./fixtures/components.json'), 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});

// test.only('a component type added to an entityset will have an integer id', function(t){
//     var registry = initialiseRegistry();
//     var entitySet = EntitySet.create();

//     entitySet.on('component:add', function(component){
//         t.equals( component.defId, 1 );
//         t.end();
//     });

//     entitySet.addComponent( registry.createComponent( '/component/position', {x:15,y:2}) );
// });


test('adding a component without an id or an entity id creates a new component and a new entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );

    // return registerComponents().then(function(){
        
    entitySet.on('all', eventSpy);
    entitySet.addComponent( registry.createComponent( '/component/position', {x:15,y:2}) );

    t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
    // t.ok( entitySet.doesEntityHaveComponent( 0, '/component/position' ), 'the entity should have a Position component' );
    t.notStrictEqual( entitySet.at(0).Position, undefined, 'the entity should have the Position component as a property' );
    // t.ok( entitySet.at(0).hasComponent( '/component/position' ), 'the entity should have a Position component' );

    t.end();
});

test('adding several components without an entity adds them to the same new entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );

    // return registerComponents().then(function(){
        // var eventSpy = Sinon.spy();
        entitySet.on('all', eventSpy);
        // logEvents( entitySet );
        entitySet.addComponent( [
            registry.createComponent( '/component/flower', {colour:'yellow'}),
            registry.createComponent( '/component/radius', {radius:2.0} )
            ]);

        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
        t.notStrictEqual( entitySet.at(0).Flower, undefined, 'the entity should have a Flower component' );
        t.notStrictEqual( entitySet.at(0).Radius, undefined, 'the entity should have a Radius component' );

        return t.end();
    // });
});

test('adding a component generates events', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );
        entitySet.on('all', eventSpy);

        entitySet.addComponent( 
            registry.createComponent( '/component/position', {id:160,_e:15, x:0, y:20}) );

        t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
        // printIns( eventSpy.args[0] );
        t.equals( eventSpy.args[1][1].id, 160, 'single argument of the component' );

        t.end();
    // });
});

test('adding several components at once generates a single add event', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );
        entitySet.on('all', eventSpy);

        entitySet.addComponent( [
            registry.createComponent( '/component/position', {id:1,_e:2, x:19, y:-2}),
            registry.createComponent( '/component/nickname', {id:2,_e:2, nick:'isaac'})
        ]);

        t.equals( eventSpy.callCount, 4, 'four events should have been emitted' );
        t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
        t.equals( eventSpy.args[2][1].length, 2, 'should contain an array of components added' );

        t.end();
    // });
    
});


test('adding an entity with components', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );

        entitySet.on('all', eventSpy);

        var entity = Entity.create(16);
        entity.addComponent( registry.createComponent( '/component/position', {id:5, x:2,y:-2}) );
        entity.addComponent( registry.createComponent( '/component/score', {id:6, score:100}) );
        entitySet.addEntity( entity );

        t.equals( eventSpy.callCount, 4, 'four events should have been emitted' );
        t.equals( entitySet.at(0).Position.get('x'), 2 );

        t.end();
    // });
});



test('should return the number of entities contained', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );

        var pos = registry.createComponent( '/component/position', {id:1,_e:3});
        var nick = registry.createComponent( '/component/nickname', {id:2,_e:3});

        entitySet.addComponent( pos );
        t.equals( entitySet.length, 1, 'should only be one entity' );

        entitySet.addComponent( nick );
        t.equals( entitySet.length, 1, 'should only be one entity' );

        var entity = entitySet.getEntity(3);
        // printIns( entity );
        t.ok( entity.Position, 'entity should have position' );
        t.ok( entity.Nickname, 'entity should have nickname' );
        t.end();
    // });
});


test('should return an added entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );    

    // printE( entities );

    var entity = entities.at(0);
    entitySet.addComponent( entity.Position );
    var addedEntity = entitySet.at(0);
    t.equals( addedEntity.id,  entity.id );
    t.equals( addedEntity.Position.id,  entity.Position.id );
    t.end();
});

test('should remove the entity belonging to a component', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

        var entity = Entity.create(9);
        entity.addComponent( registry.createComponent( '/component/realname', {id:3, name:'tom smith'}) );
        
        entitySet.addComponent( entity.Realname );
        entitySet.removeComponent( entity.Realname );

        t.equals( entitySet.length, 0);
        t.end();
    // });
});

// test.skip('sanity check', function(t){
//     return beforeEach().then( function(){

//         registry.on('all', function(evt){
//             log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
//         });

//         return registry.createComponent([
//             {_e:10, _s:'position', x:1.2, y:2},
//             {_e:10, _s:'score', score:22 }
//         ]).then(function(coms){
//             print_ins( coms );
//             t.end();
//         });
//     });
// });

test('should remove a component reference from an entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );    

        var entity = entities.at(0);
        
        entitySet.addComponent( [entity.Position, entity.Nickname, entity.Realname] );
        var addedEntity = entitySet.at(0);

        t.ok( addedEntity.Realname !== undefined, 'the entity should have the Realname component' );
        
        entitySet.removeComponent( entity.Realname );
        
        addedEntity = entitySet.at(0);
        
        t.ok( addedEntity.Realname === undefined, 'the entity should not have the Realname component' );
        t.end();
    // });
});

test('should add an entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );  

        var entity = entities.at(0);
        entitySet.addEntity( entity );
        t.equals( entitySet.length, 1);
        entitySet.addEntity( entity );
        t.equals( entitySet.length, 1);
        t.end();
    // });
});


test('should remove an entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );  

        var entity = entities.at(0);
        entitySet.addEntity( entity );
        t.equals( entitySet.length, 1);
        entitySet.removeEntity( entity );
        t.equals( entitySet.length, 0);
        t.end();
    
});

test('should add the components of an entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );

    entitySet.addEntity( entities.at(0), {debug:true} );
    
    var addedEntity = entitySet.at(0);
    t.notEqual( addedEntity.Realname, undefined );
    t.end();
});

test('should emit an event when an entity is added', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );
        
    entitySet.on('entity:add', eventSpy );
    entitySet.addEntity( entities.at(0) );
    
    t.ok( eventSpy.called, 'entity:add should have been called' );
    t.end();
});

test('should emit an event when an entity is removed', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );
    var entity = entities.at(0);
        
    entitySet.on('entity:remove', eventSpy );
    entitySet.addEntity( entity );
    entitySet.removeEntity( entity );

    t.ok( eventSpy.called, 'entity:remove should have been called' );
    t.end();
});

// test('should emit an event when a component is added');
// test('should emit an event when a component is removed');


test('should only add an entity with components', function(t){
    // return beforeEach().then( function(){
    var entitySet = EntitySet.create();
        entitySet.addEntity( 345 );
        t.equals( entitySet.length, 0);
        t.end();
    // });
});

test.only('should only add a component of an accepted type', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var eventSpy = Sinon.spy();

    var entities = loadEntities( registry );

    // setting an entity filter means that the entitySet will
    // only add components that pass through the filter
    entitySet.setEntityFilter( EntityFilter.create(EntityFilter.ALL, '/component/position') );

    entitySet.addEntity( entities.at(1) );
    t.equals( entitySet.length, 0);
    entitySet.addEntity( entities.at(0) );
    t.equals( entitySet.length, 1);
    t.end();
});


test('should only retain the included component on entity', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();

        entitySet.setEntityFilter( EntityFilter.create(EntityFilter.INCLUDE, ComponentDefs.Nickname ) );
        entitySet.addEntity( entities.at(0) );
        // the entity won't have any of the other components
        expect( entitySet.at(0).getComponentCount() ).to.equal(1);
        t.end();
    });
});

test('should not add entities that have excluded components', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();

        entitySet.setEntityFilter( EntityFilter.create(EntityFilter.NONE, ComponentDefs.Score ) );

        entitySet.addEntity( entities.at(1) );
        t.equals( entitySet.length, 0);
        entitySet.addEntity( entities.at(0), {debug:true} );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should not add entities that have multiple excluded components', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();

        entitySet.setEntityFilter( EntityFilter.create(EntityFilter.NONE, [ComponentDefs.Score, ComponentDefs.Nickname] ) );
        entitySet.addEntity( entities.toArray() );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should only add entities that are included', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        // this means that any entity MUST have a Position and Nickname
        entitySet.setEntityFilter( EntityFilter.create(EntityFilter.ALL, [ComponentDefs.Position, ComponentDefs.Nickname] ) );
        entitySet.addEntity( entities.toArray() );
        t.equals( entitySet.length, 2);
        t.end();
    });
});

test('should only add entities that are optional', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        // this means that the entity MAY have Position and/or Nickname
        entitySet.setEntityFilter( EntityFilter.create(EntityFilter.ANY, [ComponentDefs.Position, ComponentDefs.Nickname] ));
        entitySet.addEntity( entities.toArray() );
        t.equals( entitySet.length, 4);
        t.end();
    });
});


test('should only add entities that pass include/exclude', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();

        entitySet.setEntityFilter( EntityFilter.create(EntityFilter.ALL, ComponentDefs.Position) )
            .setNext( EntityFilter.create(EntityFilter.NONE, ComponentDefs.Realname) );

        entitySet.addEntity( entities.toArray() );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should remove entities that are excluded after their components change', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();

        var RealnameDef = registry.getComponentDef( ComponentDefs.Realname );
        entitySet.setEntityFilter( EntityFilter.NONE, [ComponentDefs.Realname] );
        entitySet.addEntity( entities.toArray() );
        t.equals( entitySet.length, 2);
        
        var entity = entities.at(1);
        var component = RealnameDef.create({name:'mike smith', _e:entity.id});
        // this action should cause the entity to be removed
        entitySet.addComponent( component );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should remove entities that no longer included after their components change', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();

        entitySet.setEntityFilter( EntityFilter.ALL, ComponentDefs.Nickname );
        entitySet.addEntity( entities.toArray() );
        
        t.equals( entitySet.length, 3, 'two entities which have Nickname');
        var entity = entities.at(0);

        // removing the Nickname component should mean the entity is also removed
        entitySet.removeComponent( entity.Nickname );
        t.equals( entitySet.length, 2);
        t.end();
    });
});

test('should remove entities that are no longer allowed when the component mask changes', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        
        entitySet.addEntity( entities.toArray() );
        t.equals( entitySet.length, 5);

        entitySet.setEntityFilter( EntityFilter.NONE, ComponentDefs.Score );
        t.equals( entitySet.length, 2);
        t.end();
    });
});

test('should filter', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        var self = this;
        
        entitySet.addEntity( entities.toArray() );

        var selected = entitySet.filter( function(e){
            return e.hasComponent( ComponentDefs.Position );
        });

        t.equals( selected.length, 3);
        t.end();
    });
});

// test('should remove components for an entity', function(t){
//     return beforeEach(true).then( function(){
//         var entity = entities.at(0);

//         entitySet.addEntity( entity );
//         entitySet.removeEntity( entity );
//         t.end();
//     });
// });

test('should emit an event when a component is changed', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        var entity = entities.at(0);
        var component = entity.Position;
        var spy = Sinon.spy();

        entitySet.on('component:change', spy);

        entitySet.addEntity( entity );

        component = component.clone();
        component.set({x:0,y:-2});

        entitySet.addComponent( component );

        t.ok( spy.called, 'component:change should have been called' );
        t.end();
    });
});

// NOTE - don't think this is needed? 
test.skip('should emit events when components change', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        var entity = entities.at(0);
        var spy = Sinon.spy();

        entitySet.on('component:change', spy);
        
        entitySet.addEntity( entity );
        entity.Position.set('x',100);

        t.ok( spy.called, 'component:change should have been called' );
        t.end();
    });
});


test('should clear all contained entities by calling reset', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        var spy = Sinon.spy();

        entitySet.on('reset', spy);
        entitySet.addEntity( entities );
        t.equals( entitySet.length,  entities.length );

        entitySet.reset(null, {debug:true});
        t.equals( entitySet.length, 0);
        t.ok( spy.called, 'reset should have been called' );
        t.end();
    });
});


test('attached entitysets', function(t){
    return beforeEach().then(function(entities){
        var entitySet = EntitySet.create();
        // other ES will accept only entities with Position and Realname
        var oEntitySet = EntitySet.create();
        oEntitySet.setEntityFilter( EntityFilter.ALL, [ComponentDefs.Position, ComponentDefs.Realname] );

        oEntitySet.attachTo( entitySet );

        entitySet.addEntity( entities.at(0) );
        entitySet.addEntity( entities.at(4) );

        // these added entities should end up in the other entityset
        t.equals( oEntitySet.length, 2 );

        t.end();
    });
});






function beforeEach(logEvents, noLoadEntities){
    return registerComponents()
        .then( function(){
            if( noLoadEntities ){
                return entitySet;
            }
            return new Promise( function(resolve){
                var es = EntitySet.create();
                Common.createFixtureReadStream('entity_set.entities.ldjson')
                    // convert JSON objects into components by loading into registry
                    .pipe( JSONComponentParser(registry) )
                    .pipe(Es.through( 
                        function(com){
                            es.addComponent( com );
                        }, 
                        function end(){
                            return resolve(es);
                        }));
            });
        });
        // .then( function(es){
        //     return entitySet;
        // });
}



function loadEntities( registry, fixtureName ){
    var data;
    var lines;
    var result;

    fixtureName = fixtureName || 'entity_set.entities.ldjson';

    result = registry.createEntitySet();
    data = Common.loadFixture( fixtureName );
    lines = data.split(/\r\n|\r|\n/g);

    _.map( _.compact( lines ), function(line){
        line = JSON.parse( line );
        var com = registry.createComponent( line );
        result.addComponent( com );
        return com;
    });

    return result;
}

// function loadEntities( registry, fixtureName ){
//     fixtureName = fixtureName || 'entity_set.entities.ldjson';

//     return new Promise( function(resolve){
//         var result = registry.createEntitySet();

//         Common.createFixtureReadStream(fixtureName)
//             .pipe( Es.through(
//                 function(com){
//                     var com = registry.createComponent( com );
//                     result.addComponent( com );
//                 },
//                 function end(){
//                     return resolve( result );
//                 }));
//         });
// }



function initialiseRegistry(logEvents){
    var registry = Registry.create();
    // ComponentDefs = registry.ComponentDef;
    if( logEvents ){
        logEvents( registry );
    }

    registry.registerComponent( componentData );

    return registry;
    // return new Promise(function(resolve){
    //     registry.registerComponent( Common.loadJSONFixture('components.json') ); 
    //     return resolve( registry );
    // });
}

function createComponent( type, attrs ){
    return registry.getComponentDef( type ).create(attrs);
}

function logEvents(reg){
    reg = reg || registry;
    reg.on('all', function(evt){
        log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
    });
}