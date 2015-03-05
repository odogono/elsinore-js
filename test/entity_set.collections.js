var _ = require('underscore');
var test = require('tape');
var Sinon = require('sinon');

var Common = require('./common');
var Elsinore = require('../lib');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;



test('the collection should have the same entities', function(t){
    var registry = initialiseRegistry();
    var eventSpy = Sinon.spy();

    var entitySet = loadEntities( registry );
    var collection = EntitySet.createCollection( entitySet );
    t.equals( entitySet.size(), collection.length, 'same number of entities');

    t.end();
});

test('removing an entity from the entitySet should also remove it from the collection', function(t){
    var registry = initialiseRegistry();
    var eventSpy = Sinon.spy();

    var entitySet = loadEntities( registry );
    var collection = EntitySet.createCollection( entitySet );

    // Common.logEvents( entitySet, 'entitySet' );
    // Common.logEvents( collection, 'collection' );

    entitySet.remove( entitySet.atSync(0) );
    collection.update();
    
    // printE( collection );
    t.equals( entitySet.size(), collection.length, 'same number of entities');

    t.end();    
});

test('adding an entity should also see it appear in the collection', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var collection = EntitySet.createCollection( entitySet, null, {updateOnEvent:true} );

    entitySet.addComponent( 
        registry.createComponent( '/component/position', {x:-2,y:5}) );

    t.equals( entitySet.size(), collection.length, 'same number of entities');
    t.end();
});


test('removing a component from an entity', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var collection = EntitySet.createCollection( entitySet, null, {updateOnEvent:true} );

    // Common.logEvents( collection );
    // Common.logEvents( entitySet );

    entitySet.add(
        registry.createEntity([
            { id:'/component/flower', colour:'red'},
            { id:'/component/position', x:-2, y:5 }] ));
        
    // collection.update();
    
    // printE( collection );

    t.ok( collection.at(0).Position, 'the entity should have position' );

    entity = entitySet.atSync(0);
    entitySet.removeComponent( entity.Position );

    t.ok( _.isUndefined( collection.at(0).Position ), 'the entity should have no position' );
    t.end();
});

test('removing a relevant component from an entity should trigger a component:remove event', function(t){
    var entity;
    var eventSpy = Sinon.spy();
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
    var collection = EntitySet.createCollection( entitySet, entityFilter, {updateOnEvent:true} );

    collection.on('all', eventSpy);

    // Common.logEvents( entitySet );
    // Common.logEvents( collection );

    // remove an unrelated component to the collection
    entitySet.removeComponent( entitySet.at( 0 ).Position );
    
    // remove the score component from the first entity in the collection
    // printIns( collection.at( 0 ).Score );
    entitySet.removeComponent( collection.at( 0 ).Score );

    t.ok( eventSpy.calledOnce, 'only one event emitted from the collection' );
    t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');

    t.end();
});


test('applying a filter', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/position', '/component/realname' )
    var collection = EntitySet.createCollection( entitySet, entityFilter );

    t.ok( collection.at(0).Position, 'the entity should have /position' );
    t.ok( collection.at(0).Realname, 'the entity should have /realname' );

    t.ok( collection.at(1).Position, 'the entity should have /position' );
    t.ok( collection.at(1).Realname, 'the entity should have /realname' );

    t.end();
});

test('collections created with a filter', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.NONE, '/component/position' )
    var collection = EntitySet.createCollection( entitySet, entityFilter );

    entitySet.addComponent([ 
        registry.createComponent( '/component/flower', {colour:'red'}),
        registry.createComponent( '/component/position', {x:-2,y:5})] );

    t.equals( collection.length, 2, 'two entities');

    t.end();
});



/**
*   Returns an entityset with the given entities
*/
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



function initialiseRegistry(logEvents){
    var componentData;
    var registry = Registry.create();
    // ComponentDefs = registry.ComponentDef;
    if( logEvents ){
        Common.logEvents( registry );
    }
    
    componentData = Common.loadComponents();
    registry.registerComponent( componentData );

    return registry;
}
