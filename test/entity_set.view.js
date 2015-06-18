'use strict';

var _ = require('underscore');
var Sinon = require('sinon');


export default function run( test, Common, Elsinore, EntitySet ){

    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let Query = Elsinore.Query;
    let Registry = Elsinore.Registry;

    test('.where returns an entityset of entities', t => {
        let [registry,entitySet] = initialise();

        // var result = entitySet.where('/component/name');
        let result = entitySet.query( Query.all('/component/name') );
        t.ok( result.isEntitySet, 'the result is an entityset');
        t.equals( result.length, 7, '7 entities returned');

        t.end();
    });

    test('.where returns entities which the attributes', t => {
        let [registry,entitySet] = initialise();
        
        // var result = entitySet.where('/component/status', {status:'active'} );
        let result = entitySet.query( 
            Query.all('/component/status', 
                Query.attr('status').equals('active')) );

        t.ok( result.isEntitySet, 'the result is an entityset');
        t.equals( result.length, 6, '3 entities returned');

        t.end();
    });



    test('the view should be identified as a view', t => {
        let [registry,entitySet] = initialise();
        
        let view = entitySet.view();

        t.ok( view.isEntitySetView, 'its an entityset view');
        t.ok( view.isEntitySet, 'its an entityset');
        t.equals( view.type, 'EntitySetView', 'its type is EntitySetView');

        t.end();
    });


    test('the view should have the same entities', t => {
        let [registry,entitySet] = initialise();
        let eventSpy = Sinon.spy();

        let view = entitySet.view();
        
        t.equals( entitySet.length, view.length, 'same number of entities');

        t.end();
    });



    test('removing an entity from the entitySet should also remove it from the view', t => {
        let [registry,entitySet] = initialise();
        var eventSpy = Sinon.spy();

        let view = entitySet.view(null,{updateOnEvent: true});

        // Common.logEvents( entitySet, 'entitySet' );
        // Common.logEvents( view, 'view' );

        entitySet.removeEntity( entitySet.at(0) );
        // view.update();
        
        t.equals( entitySet.size(), view.length, 'same number of entities');

        t.end();    
    });

    test('adding an entity should also see it appear in the view', t => {
        let [registry,entitySet] = initialise();
        let view = entitySet.view(null,{updateOnEvent:true});

        var component = registry.createComponent( '/component/position', {x:-2,y:5} );
        entitySet.addComponent( component );

        t.equals( entitySet.size(), view.size(), 'same number of entities');
        t.end();
    });


    test('removing a component from an entity', t => {
        var entity;
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        let view = entitySet.view(null, {updateOnEvent: true} );

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

    test('adding a component to an entity', t => {
        var component;
        var eventSpy = Sinon.spy();
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        var view = entitySet.view(null, {updateOnEvent:true});

        entitySet.addEntity(
            registry.createEntity( { id:'/component/flower', colour:'white'} ));

        t.ok( view.at(0).Flower, 'the entity should have flower' );

        component = registry.createComponent( {id:'/component/position', x:-2, y:5}, entitySet.at(0) );

        t.equals( component.getEntityId(), entitySet.at(0).getEntityId(), 'the entity ids are identical' );

        entitySet.addComponent( component );

        t.ok( view.at(0).Position, 'the views entity should have position' );

        t.end();
    });

    test('adding a component to an entity triggers an entity:add event', t => {
        var eventSpy = Sinon.spy();
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        var view = entitySet.view(null, {updateOnEvent:true});

        // Common.logEvents( entitySet, 'es ' );
        // Common.logEvents( view, 'vi ' );
        view.on('all', eventSpy);

        entitySet.addEntity(
            registry.createEntity( { id:'/component/flower', colour:'magenta'} ));

        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
        t.end();
    });


    test('removing a relevant component from an entity should trigger a entity:remove event', t => {
        var entity;
        var eventSpy = Sinon.spy();
        let [registry,entitySet] = initialise();
        let query = Query.all('/component/channel');
        // var entityFilter = registry.createEntityFilter( EntityFilter.ALL, '/component/score' );
        let view = entitySet.view( query, {updateOnEvent:true} );

        // printIns( entitySet, 1 );
        view.on('all', eventSpy);

        // Common.logEvents( entitySet, 'e es' );
        // Common.logEvents( view, 'e view' );

        // remove an unrelated component to the view
        entitySet.removeComponent( entitySet.at( 0 ).Status );
        // printE( entitySet.at(0) );
        
        // remove the score component from the first entity in the view
        entitySet.removeComponent( view.at( 0 ).Channel );

        // t.ok( eventSpy.calledOnce, 'only one event emitted from the view' );
        t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

        t.end();
    });

    test('deferred addition of components with a filter', t => {
        var eventSpy = Sinon.spy();
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        let query = Query.all('/component/position');
        let view = entitySet.view( query );

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


    test('applying a filter', t => {
        let [registry,entitySet] = initialise('entity_set.entities');
        let query = Query.all(['/component/position', '/component/realname']);
        let view = entitySet.view( query );
        
        t.ok( view.at(0).Position, 'the entity should have /position' );
        t.ok( view.at(0).Realname, 'the entity should have /realname' );

        t.ok( view.at(1).Position, 'the entity should have /position' );
        t.ok( view.at(1).Realname, 'the entity should have /realname' );

        t.end();
    });


    test('views created with a filter', t => {
        var entity;
        let [registry,entitySet] = initialise('entity_set.entities');
        let query = Query.none('/component/position');

        var view = entitySet.query( query );

        entitySet.addComponent([
            registry.createComponent( '/component/flower', {colour:'red'}),
            registry.createComponent( '/component/position', {x:-2,y:5})] );

        t.equals( view.length, 2, 'two entities');

        t.end();
    });


    // test.skip('deferred addition of a component', t => {
    //     let [registry,entitySet] = initialise();
    //     var view = entitySet.where( null, null, {view:true});
    //     var entity;

    //     // Common.logEvents( entitySet, 'e es' );
    //     // Common.logEvents( view, 'e view' );

    //     entity = entitySet.addEntity(
    //         registry.createEntity({ id:'/component/flower', colour:'blue'} ));
        
    //     t.equals( view.size(), 1, 'the view has the new entity');

    //     entitySet.addComponent( 
    //         registry.createComponent( {id:'/component/position', x:-2,y:5}, entity) );

    //     // printE( view );

    //     t.equals( view.at(0).Position, undefined, 'the component is not added yet');
    //     // t.equals( view.size(), 0, 'no components added yet');

    //     t.ok( view.isModified, 'the view has been modified' );

    //     view.applyEvents();

    //     t.ok( view.at(0).Position, 'component added');

    //     t.end();
    // });

    test('deferred removal of an entity', t => {
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        var view = entitySet.view();

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


    test('deferred removal of an entity triggers correct events', t => {
        // entity:remove
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        var view = entitySet.view();

        var entityA, entityB;
        
        var eventSpy = Sinon.spy();

        // Common.logEvents( view );

        entityA = entitySet.addEntity(
            registry.createEntity([
                { id:'/component/flower', colour:'blue'},
                { id:'/component/position', x:10, y:60 }] ));

        entityB = entitySet.addEntity(
            registry.createEntity([
                { id:'/component/vegetable', name:'cauliflower'},
                { id:'/component/radius', radius:0.3 }] ));

        view.applyEvents();

        view.on('all', eventSpy);
        entitySet.removeEntity( entityA );
        entitySet.removeEntity( entityB );

        t.ok( eventSpy.calledTwice, 'only two event emitted from the view' );
        t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');

        t.end();
    });

    test('altering a component in the view also changes the component in the entityset', t => {
        let [registry] = initialise();
        let entitySet = registry.createEntitySet();
        var view = entitySet.view();

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




    function initialise( entities ){
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, (entities||'query.entities') );
        return [registry,entitySet];
    }
}


// serverside only execution of tests
if( !process.browser ){
    
    let Elsinore = require('../lib');
    require('./common');
    
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}