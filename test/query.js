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
        // let filter = Query.filter( Query.all('/component/name').all('/component/channel') ).compile(true);
        // printIns( filter.toArray(true), 6 );

        let compiled = filter.compile( registry );

        t.ok( Query.isQuery(compiled) );
        t.ok( compiled.isCompiled );

        // printIns( compiled, 6 );

        let result = compiled.execute( entity );

        // printIns( result );
        t.ok( Entity.isEntity(result) );

        t.end();
    })
}

// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    require('./common');
    require('../lib/query/dsl');
    
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}