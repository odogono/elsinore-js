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
        
        result = Query.all( '/component/channel' ).execute( entity );

        t.ok( Entity.isEntity(result) );
        
        t.end();
    });

    test('Rejecting an entity', t => {
        let result;
        let registry = Common.initialiseRegistry();
        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        result = Query.all( '/component/name' ).execute( entity );

        t.equal( result, null, 'entity doesnt pass the filter');
        
        t.end();
    });

    test('compiling a basic two stage entity filter', t => {
        let registry = Common.initialiseRegistry();
        let query;// = Query.all('/component/channel').all('/component/topic');
        let compiled;

        query = Query.create( registry,[
            Query.all('/component/channel'),
            Query.all('/component/topic') 
        ]);

        // printIns( query, 6 );

        t.equals( query.commands.length, 1 );
        t.end();
    });

    test('compiling an entity filter', t => {
        let registry = Common.initialiseRegistry();

        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        let query = Query.all('/component/topic','/component/channel');
        // let compiled = filter.compile( registry );

        // printIns( query );

        t.ok( Query.isQuery(query) );
        t.ok( !query.isCompiled );

        // printIns( compiled, 6 );
        // log.debug('filter hash ' + filter.hash() );
        // log.debug('hashed ' + compiled.hash() );

        let result = query.execute( entity );

        // printIns( query );

        t.ok( Entity.isEntity(result) );
        // t.ok( Entity.isEntity( filter.execute(entity) ));

        t.end();
    });

    test('a single filter query on an entity', t => {
        let registry = Common.initialiseRegistry();
        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        let query = Query.all('/component/channel');
        t.ok( !query.isCompiled );

        query = query.compile( registry );
        t.ok( query.isCompiled );
        
        let result = query.execute( entity );
        t.ok( Entity.isEntity(result) );

        t.end();
    })


    test('accepting an entity based on its attributes', t => {
        let registry = Common.initialiseRegistry();
        // let query = Query.attr('/component/mode/limit', 'limit').greaterThan(9);
        let query = Query.create( registry,
            Query.all('/component/mode/limit', Query.attr('limit').greaterThan( 9 )),
            {debug:false} );

        // printIns( query );

        t.ok( Entity.isEntity(query.execute(
            registry.createEntity( { id:'/component/mode/limit', limit:10} ),
            {debug:false} )), 'the query returns the entity with a limit > 10' );

        t.notOk( query.execute(
            registry.createEntity( { id:'/component/mode/limit', limit:9} )
            ), 'query rejects entity with a limit > 10');

        t.notOk( query.execute(
            registry.createEntity( { id:'/component/mode/limit'} )
            ), 'query rejects entity with no limit');

        t.end();
    });


    test('a single filter query on an entityset', t => {
        let registry = Common.initialiseRegistry();
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let query = Query.create( registry, Query.all('/component/channel') );
        
        let result = query.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result), 
            'the returned value is an entityset' );
        t.equals( result.size(), 4, 
            'the entityset contains 4 entities each with a /component/channel' );
        
        t.end();
    });


    test('filter query on an entityset', t => {
        let registry = Common.initialiseRegistry();
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let query = Query.create( registry,
            [
                Query.all('/component/channel_member'),
                Query.none('/component/mode/invisible'),
                Query.all('/component/channel_member', Query.attr('channel').equals(2) ),
            ]);

        let result = query.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result) );
        t.equals( result.size(), 2 );
        // printE( result );

        t.end();
    });


    test('multiple commands with a single result', t => {
        let registry = Common.initialiseRegistry();
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let clientId = 5;

        let query = Query.create( registry,[
            // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            Query.all('/component/channel_member', 
                Query.attr('client').equals(clientId) ),
            Query.pluck('/component/channel_member', 'channel'),
            Query.aliasAs( 'channelIds' ),

            // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            Query.root(),
            Query.all('/component/channel_member', 
                Query.attr('channel').equals( Query.alias('channelIds'))),
            Query.pluck('/component/channel_member', 'client', {unique:true}),
            Query.without( clientId ),
            Query.aliasAs('clientIds'),

            // 3. using the channel_member client ids, select an entityset of client entities by entity ids
            Query.root(),
            Query.selectById( Query.alias('clientIds') )
            ]);


        let result = query.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result) );
        // printE( result );
        t.equals( result.size(), 4 );

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