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
        
        result = Query.filter( '/component/channel' ).execute( entity, {value:true} );

        t.ok( Entity.isEntity(result) );
        
        t.end();
    });

    test('Rejecting an entity', t => {
        let result;
        let registry = Common.initialiseRegistry();
        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        result = Query.filter( '/component/name' ).execute( entity, {value:true});

        t.equal( result, null, 'entity doesnt pass the filter');
        
        t.end();
    });
}

// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    require('./common');
    require('../lib/query/dsl');
    
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}