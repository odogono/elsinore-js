'use strict';

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


test('the view should be identified as a view', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet );

    t.ok( view.isEntitySetView, 'its an entityset view');
    t.ok( view.isEntitySet, 'its an entityset');
    t.equals( view.type, 'EntitySetView', 'its type is EntitySetView');

    t.end();
});


test('the view should have the same entities', function(t){
    var registry = initialiseRegistry();
    var eventSpy = Sinon.spy();

    var entitySet = loadEntities( registry );
    var view = EntitySet.createView( entitySet );
    t.equals( entitySet.size(), view.length, 'same number of entities');

    t.end();
});



test('removing an entity from the entitySet should also remove it from the view', function(t){
    var registry = initialiseRegistry();
    var eventSpy = Sinon.spy();

    var entitySet = loadEntities( registry );
    var view = EntitySet.createView( entitySet, null, {updateOnEvent:true} );

    // Common.logEvents( entitySet, 'entitySet' );
    // Common.logEvents( view, 'view' );

    entitySet.removeEntity( entitySet.at(0) );
    // view.update();
    
    // printE( view );
    t.equals( entitySet.size(), view.length, 'same number of entities');

    t.end();    
});

test('adding an entity should also see it appear in the view', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet, null, {updateOnEvent:true} );

    var component = registry.createComponent( '/component/position', {x:-2,y:5} );
    entitySet.addComponent( component );

    t.equals( entitySet.size(), view.size(), 'same number of entities');
    t.end();
});


test('removing a component from an entity', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet, null, {updateOnEvent:true} );

    // Common.logEvents( view );
    // Common.logEvents( entitySet );

    entitySet.addEntity(
        registry.createEntity([
            { id:'/component/flower', colour:'red'},
            { id:'/component/position', x:-2, y:5 }] ));
        
    // view.update();
    // printE( view );

    t.ok( view.at(0).Position, 'the entity should have position' );

    entity = entitySet.at(0);
    entitySet.removeComponent( entity.Position );

    // printE( entitySet );
    // printE( view );

    t.ok( _.isUndefined( view.at(0).Position ), 'the entity should have no position' );
    t.end();
});

test('adding a component to an entity', function(t){
    var component;
    var eventSpy = Sinon.spy();
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet, null, {updateOnEvent:true} );

    entitySet.addEntity(
        registry.createEntity( { id:'/component/flower', colour:'white'} ));

    t.ok( view.at(0).Flower, 'the entity should have flower' );

    component = registry.createComponent( {id:'/component/position', x:-2, y:5}, entitySet.at(0) );

    t.equals( component.getEntityId(), entitySet.at(0).getEntityId(), 'the entity ids are identical' );

    entitySet.addComponent( component );

    t.ok( view.at(0).Position, 'the views entity should have position' );

    t.end();
});

test('adding a component to an entity triggers an entity:add event', function(t){
    var eventSpy = Sinon.spy();
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet, null, {updateOnEvent:true} );

    // Common.logEvents( entitySet, 'es ' );
    // Common.logEvents( view, 'vi ' );
    view.on('all', eventSpy);

    entitySet.addEntity(
        registry.createEntity( { id:'/component/flower', colour:'magenta'} ));

    t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
    t.end();
});


test('removing a relevant component from an entity should trigger a entity:remove event', function(t){
    var entity;
    var eventSpy = Sinon.spy();
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
    var view = EntitySet.createView( entitySet, entityFilter, {updateOnEvent:true} );

    view.on('all', eventSpy);

    // Common.logEvents( entitySet, 'e es' );
    // Common.logEvents( view, 'e view' );

    // remove an unrelated component to the view
    entitySet.removeComponent( entitySet.at( 0 ).Position );
    
    // remove the score component from the first entity in the view
    entitySet.removeComponent( view.at( 0 ).Score );

    t.ok( eventSpy.calledOnce, 'only one event emitted from the view' );
    t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

    t.end();
});

test('removing a relevant component from an entity should eventually trigger a entity:remove event', function(t){
    var entity;
    var eventSpy = Sinon.spy();
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
    var view = EntitySet.createView( entitySet, entityFilter );

    view.on('all', eventSpy);

    // Common.logEvents( entitySet, 'e es' );
    // Common.logEvents( view, 'e view' );

    // remove an unrelated component to the view
    entitySet.removeComponent( entitySet.at( 0 ).Position );
    
    // remove the score component from the first entity in the view
    entitySet.removeComponent( view.at( 0 ).Score );

    view.applyEvents();

    t.ok( eventSpy.calledOnce, 'only one event emitted from the view' );
    t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

    t.end();
});

test('deferred addition of components with a filter', function(t){
    var eventSpy = Sinon.spy();
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/position' )
    var view = EntitySet.createView( entitySet, entityFilter );

    view.on('all', eventSpy);

    var entity = entitySet.addEntity(
        registry.createEntity([
            { id:'/component/flower', colour:'blue'}] ));

    view.applyEvents();

    t.equals( view.length, 0, 'no entities yet' );

    entitySet.addComponent(
        registry.createComponent({id:'/component/position', x:10, y:100}, entity ) );

    view.applyEvents();

    t.equals( view.length, 1, 'only one entity added' );

    t.end();
});




test('applying a filter', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/position', '/component/realname' )
    var view = EntitySet.createView( entitySet, entityFilter );

    t.ok( view.at(0).Position, 'the entity should have /position' );
    t.ok( view.at(0).Realname, 'the entity should have /realname' );

    t.ok( view.at(1).Position, 'the entity should have /position' );
    t.ok( view.at(1).Realname, 'the entity should have /realname' );

    t.end();
});

test('views created with a filter', function(t){
    var entity;
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    var entityFilter = registry.createEntityFilter( EntityFilter.NONE, '/component/position' )
    var view = EntitySet.createView( entitySet, entityFilter );

    entitySet.addComponent([
        registry.createComponent( '/component/flower', {colour:'red'}),
        registry.createComponent( '/component/position', {x:-2,y:5})] );

    t.equals( view.length, 2, 'two entities');

    t.end();
});


test.skip('deferred addition of a component', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet );
    var entity;

    // Common.logEvents( entitySet, 'e es' );
    // Common.logEvents( view, 'e view' );

    entity = entitySet.addEntity(
        registry.createEntity({ id:'/component/flower', colour:'blue'} ));
    
    t.equals( view.size(), 1, 'the view has the new entity');

    entitySet.addComponent( 
        registry.createComponent( {id:'/component/position', x:-2,y:5}, entity) );

    printE( view );

    t.equals( view.at(0).Position, undefined, 'the component is not added yet');
    // t.equals( view.size(), 0, 'no components added yet');

    t.ok( view.isModified, 'the view has been modified' );

    view.applyEvents();

    t.ok( view.at(0).Position, 'component added');

    t.end();
});

test('deferred removal of an entity', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet );

    // Common.logEvents( entitySet );

    entitySet.addEntity(
        registry.createEntity([
            { id:'/component/flower', colour:'blue'},
            { id:'/component/position', x:10, y:60 }] ));

    entitySet.addEntity(
        registry.createEntity([
            { id:'/component/vegetable', name:'cauliflower'},
            { id:'/component/radius', radius:0.3 }] ));

    view.applyEvents();

    t.equals( view.length, 2, 'two entities added' );

    entitySet.removeEntity( entitySet.at(1) );

    // t.equals( view.length, 2, 'still two entities' );    

    // view.applyEvents();

    t.equals( view.length, 1, 'now one entity' );    

    t.end();
});

test('altering a component in the view also changes the component in the entityset', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet();
    var view = EntitySet.createView( entitySet );

    // Common.logEvents( entitySet );

    entitySet.addEntity(
        registry.createEntity([
            { id:'/component/flower', colour:'blue'},
            { id:'/component/radius', radius:0.1 }] ));

    view.applyEvents();

    view.at(0).Flower.set('colour', 'cyan');

    t.equals( entitySet.at(0).Flower.get('colour'), 'cyan', 'colours should match');

    t.end();
});



test('.where returns an entityset of entities', function(t){
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    
    var result = entitySet.where('/component/realname');
    t.ok( result.isEntitySet, 'the result is an entityset');
    t.equals( result.length, 3, '3 entities returned');

    t.end();
});

test('.where returns entities which the attributes', function(t){
    var registry = initialiseRegistry();
    var entitySet = loadEntities( registry );
    
    var result = entitySet.where('/component/status', {status:'active'} );
    t.ok( result.isEntitySet, 'the result is an entityset');
    t.equals( result.length, 2, '3 entities returned');

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
        var com = registry.createComponent( line, null, {schemaKey:'id'} );
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
