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


/***


*/

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
    Common.logEvents( entitySet, 'entitySet' );
    Common.logEvents( collection, 'collection' );

    entitySet.removeEntity( entitySet.atSync(0) );
    
    t.equals( entitySet.size(), collection.length, 'same number of entities');

    t.end();    
});

test('adding an entity should also see it appear in the collection', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var collection = EntitySet.createCollection( entitySet );

    entitySet.addComponent( 
        registry.createComponent( '/component/position', {x:-2,y:5}) );

    t.equals( entitySet.size(), collection.length, 'same number of entities');
    t.end();
});


test('removing a component from an entity', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var collection = EntitySet.createCollection( entitySet );

    entitySet.addComponent([ 
        registry.createComponent( '/component/flower', {colour:'red'}),
        registry.createComponent( '/component/position', {x:-2,y:5})] );

    t.ok( collection.at(0).Position, 'the entity should have position' );

    entity = entitySet.atSync(0);
    entitySet.removeComponent( entity.Position );

    t.ok( _.isUndefined( collection.at(0).Position ), 'the entity should have no position' );
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
