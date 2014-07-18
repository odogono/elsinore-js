var test = require('tape');
var Common = require('./common');
var Es = require('event-stream');
var P = require('bluebird');
// P.longStackTraces();

var EntitySet = Elsinore.EntitySet;
var Registry = Elsinore.Registry;

var JSONComponentParser = require('../lib/streams').JSONComponentParser;


var entitySet, entities, registry, storage, ComponentDefs;



test('should return the number of entities contained', function(t){
    return beforeEach()
        .then(function(){
            var entity = entities[0];
            entitySet.addComponent( entity.Position );
            t.equals( entitySet.length, 1);
            entitySet.addComponent( entity.Nickname );
            t.equals( entitySet.length, 1);
            t.end();        
        });
});


test('should return an added entity', function(t){
    return beforeEach()
        .then(function(){
            var entity = entities[0];
            entitySet.addComponent( entity.Position );
            var addedEntity = entitySet.at(0);
            t.equals( addedEntity.id,  entity.id );
            t.equals( addedEntity.Position.id,  entity.Position.id );
            t.end();
        });
});

test('should remove the entity belonging to a component', function(t){
    return beforeEach().then( function(){
        var entity = entities[0];
        entitySet.addComponent( entity.Position );
        entitySet.removeComponent( entity.Position );
        t.equals( entitySet.length, 0);
        t.end();
    });
});

test('should remove a component reference from an entity', function(t){
    return beforeEach().then( function(){
        var entity = entities[0];
        entitySet.addComponent( [entity.Position, entity.Nickname, entity.Realname] );
        var addedEntity = entitySet.at(0);
        expect( addedEntity.Realname ).to.not.be.undefined;
        entitySet.removeComponent( entity.Realname );
        addedEntity = entitySet.at(0);
        expect( addedEntity.Realname ).to.be.undefined;
        t.end();
    });
});

test('should add an entity', function(t){
    return beforeEach().then( function(){
        var entity = entities[0];
        entitySet.addEntity( entity );
        t.equals( entitySet.length, 1);
        entitySet.addEntity( entity );
        t.equals( entitySet.length, 1);
        t.end();
    });
});


test('should remove an entity', function(t){
    return beforeEach().then( function(){
        var entity = entities[0];
        entitySet.addEntity( entity );
        t.equals( entitySet.length, 1);
        entitySet.removeEntity( entity );
        t.equals( entitySet.length, 0);
        t.end();
    });
});

test('should add the components of an entity', function(t){
    return beforeEach(true).then( function(entitySet){
        log.debug( '+++ ' + entitySet.cid + ' add here');
        entitySet.addEntity( entities[0], {debug:true} );
        var addedEntity = entitySet.at(0);
        // print_ins( entitySet.entities );
        t.notEqual( addedEntity.Realname, undefined );
        t.end();
    });
});

test('should emit an event when an entity is added', function(t){
    return beforeEach().then( function(){
        var spy = Sinon.spy();
        
        entitySet.on('entity:add', spy );
        entitySet.addEntity( entities[0] );
        
        t.ok( spy.called, 'entity:add should have been called' );
        t.end();
    });
});

test('should emit an event when an entity is removed', function(t){
    return beforeEach().then( function(){
        var spy = Sinon.spy();
        var entity = entities[0];
        
        entitySet.on('entity:remove', spy );
        entitySet.addEntity( entity );
        entitySet.removeEntity( entity );
    
        t.ok( spy.called, 'entity:remove should have been called' );
        t.end();
    });
});

// test('should emit an event when a component is added');
// test('should emit an event when a component is removed');


test('should only add an entity with components', function(t){
    return beforeEach().then( function(){
        entitySet.addEntity( 345 );
        t.equals( entitySet.length, 0);
        t.end();    
    });
});

test('should only add a component of an accepted type', function(t){
    return beforeEach().then( function(){
        entitySet.setComponentMask( EntitySet.INCLUDE, ComponentDefs.Position );

        entitySet.addEntity( entities[1] );
        t.equals( entitySet.length, 0);
        entitySet.addEntity( entities[0] );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test.only('should only retain the included component on entity', function(t){
    return beforeEach().then( function(){
        entitySet.setComponentMask( EntitySet.INCLUDE, ComponentDefs.Nickname );
        entitySet.addEntity( entities[0] );
        // the entity won't have any of the other components
        expect( entitySet.at(0).getComponentCount() ).to.equal(1);
        t.end();
    });
});

test('should not add entities that have excluded components', function(t){
    return beforeEach().then( function(){
        entitySet.setComponentMask( EntitySet.EXCLUDE, ComponentDefs.Score );

        entitySet.addEntity( entities[1] );
        t.equals( entitySet.length, 0);
        entitySet.addEntity( entities[0], {debug:true} );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should not add entities that have multiple excluded components', function(t){
    return beforeEach().then( function(){
        entitySet.setComponentMask( EntitySet.EXCLUDE, [ComponentDefs.Score, ComponentDefs.Nickname] );
        entitySet.addEntity( entities );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should only add entities that are included', function(t){
    return beforeEach().then( function(){
        // this means that any entity MUST have a Position and Nickname
        entitySet.setComponentMask( EntitySet.INCLUDE, [ComponentDefs.Position, ComponentDefs.Nickname] );
        entitySet.addEntity( entities );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should only add entities that are optional', function(t){
    return beforeEach().then( function(){
        // this means that the entity MAY have Position and/or Nickname
        entitySet.setComponentMask( EntitySet.OPTIONAL, [ComponentDefs.Position, ComponentDefs.Nickname] );
        entitySet.addEntity( entities );
        t.equals( entitySet.length, 3);
        t.end();
    });
});


test('should only add entities that pass include/exclude', function(t){
    return beforeEach().then( function(){
        // this means that the entity MAY have Position and/or Nickname
        entitySet.setComponentMask( EntitySet.INCLUDE, [ComponentDefs.Position] );
        entitySet.setComponentMask( EntitySet.EXCLUDE, [ComponentDefs.Realname] );
        entitySet.addEntity( entities );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should remove entities that are excluded after their components change', function(t){
    return beforeEach().then( function(){
        var RealnameDefId = ComponentDefs.Realname;
        var RealnameDef = registry.getComponentDef( RealnameDefId );
        entitySet.setComponentMask( EntitySet.EXCLUDE, [RealnameDefId] );
        entitySet.addEntity( entities );
        t.equals( entitySet.length, 2);
        
        var entity = entities[1];
        var component = RealnameDef.create({name:'mike smith', _e:entity.id});
        // this action should cause the entity to be removed
        entitySet.addComponent( component );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should remove entities that no longer included after their components change', function(t){
    return beforeEach().then( function(){
        // entitySet.on('all', function(evt){
        //     log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        // });

        entitySet.setComponentMask( EntitySet.INCLUDE, ComponentDefs.Nickname );
        entitySet.setComponentMask( EntitySet.OPTIONAL, ComponentDefs.Position );
        entitySet.addEntity( entities );
        
        t.equals( entitySet.length, 2);
        var entity = entities[0];

        // removing the Nickname component should mean the entity is also removed
        entitySet.removeComponent( entity.Nickname );
        t.equals( entitySet.length, 1);
        t.end();
    });
});

test('should remove entities that are no longer allowed when the component mask changes', function(t){
    return beforeEach().then( function(){
        // entitySet.on('all', function(evt){
        //     log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        // });
        entitySet.addEntity( entities );
         t.equals( entitySet.length, 4);

        entitySet.setComponentMask( EntitySet.EXCLUDE, ComponentDefs.Score );
        t.equals( entitySet.length, 2);
        t.end();
    });
});

test('should filter', function(t){
    return beforeEach().then( function(){
        var self = this;
        
        entitySet.addEntity( entities );

        var selected = entitySet.filter( function(e){
            return e.hasComponent( ComponentDefs.Position );
        });

        t.equals( selected.length, 2);
        t.end();
    });
});

test('should remove components for an entity', function(t){
    return beforeEach().then( function(){
        var entity = entities[0];

        entitySet.addEntity( entity );

        entitySet.removeEntity( entity );
        t.end();
    });
});

test('should emit an event when a component is changed', function(t){
    return beforeEach().then( function(){
        var entity = entities[0];
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
    return beforeEach().then( function(){
        var entity = entities[0];
        var spy = Sinon.spy();

        entitySet.on('component:change', spy);
        
        entitySet.addEntity( entity );
        entity.Position.set('x',100);

        t.ok( spy.called, 'component:change should have been called' );
        t.end();
    });
});


test('should clear all contained entities by calling reset', function(t){
    return beforeEach().then( function(){
        var spy = Sinon.spy();
        // entitySet.on('all', function(evt){
        //     log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        // });
        entitySet.on('reset', spy);
        entitySet.addEntity( entities );
        t.equals( entitySet.length,  entities.length );

        entitySet.reset();
        t.equals( entitySet.length, 0);
        t.ok( spy.called, 'reset should have been called' );
        t.end();
    });
});

function beforeEach(logEvents){
    entitySet = EntitySet.create();
    if( logEvents ){
        entitySet.on('all', function(evt){
            log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        });
    }
    return Registry.create().initialize()
        .then( function(reg){
            registry = reg;
            return registry.registerComponent( Common.loadJSONFixture('components.json') );
        }).then( function(){
            ComponentDefs = registry.ComponentDef;
        }).then( function(){
            return new Promise( function(resolve){
                Common.createFixtureReadStream('entity_set.entities.ldjson')
                    // convert JSON objects into components by loading into registry
                    .pipe( JSONComponentParser(registry) )
                    .pipe(Es.through( null, function end(){
                        entities = registry.storage.entities;
                        return resolve(entities);
                    }));
            });
        }).then( function(){
            return entitySet;
        });
}
