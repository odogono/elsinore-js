'use strict';

let _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let Query = Elsinore.Query;


    test('Accepting an entity', t => {
        let result;
        let registry = Common.initialiseRegistry();
        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );
        
        result = Query.filter( '/component/channel' ).execute( entity );

        t.ok( Entity.isEntity(result) );
        
        t.end();
    });

    test('Rejecting an entity', t => {
        let result;
        let registry = Common.initialiseRegistry();
        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        result = Query.filter( '/component/name' ).execute( entity );

        t.equal( result, null, 'entity doesnt pass the filter');
        
        t.end();
    });

    test('compiling an entity filter', t => {
        let registry = Common.initialiseRegistry();

        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        let filter = Query.filter( Query.all('/component/topic').all('/component/channel') );
        let compiled = filter.compile( registry );

        t.ok( Query.isQuery(compiled) );
        t.ok( compiled.isCompiled );

        // printIns( compiled, 6 );
        // log.debug('filter hash ' + filter.hash() );
        // log.debug('hashed ' + compiled.hash() );

        let result = compiled.execute( entity );
        t.ok( Entity.isEntity(result) );

        t.ok( Entity.isEntity( filter.execute(entity) ));

        t.end();
    });

    test('a single filter query on an entity', t => {
        let registry = Common.initialiseRegistry();
        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        let filter = Query.all('/component/channel');
        let compiled = filter.compile( registry );
        
        let result = compiled.execute( entity );

        t.ok( Entity.isEntity(result) );

        t.end();
    })


    test('accepting an entity based on its attributes', t => {
        let registry = Common.initialiseRegistry();
        let query = Query.attr('/component/mode/limit', 'limit').greaterThan(9);

        t.ok( query.execute(
            registry.createEntity( { id:'/component/mode/limit', limit:10} )
            ));

        t.notOk( query.execute(
            registry.createEntity( { id:'/component/mode/limit', limit:9} )
            ));

        t.notOk( query.execute(
            registry.createEntity( { id:'/component/mode/limit'} )
            ));

        t.end();
    });


    test('a single filter query on an entityset', t => {
        let registry = Common.initialiseRegistry();
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let filter = Query.all('/component/channel');
        let compiled = filter.compile( registry );

        // printIns( compiled, 6 );

        let result = compiled.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result) );
        t.equals( result.size(), 4 );
        // printE( result );

        t.end();
    });


    test('filter query on an entityset', t => {
        let registry = Common.initialiseRegistry();
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let filter = Query.filter( 
            Query.all('/component/channel_member').none('/component/mode/invisible'),
            Query.attr('/component/channel_member', 'channel').equals(2) );
        let compiled = filter.compile( registry );

        // printIns( compiled, 6 );

        let result = compiled.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result) );
        t.equals( result.size(), 2 );
        // printE( result );

        t.end();
    }); 
}

// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    // require('./common');
    require('../lib/query/dsl');
    
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}