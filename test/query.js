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
        let command;// = Query.all('/component/channel').all('/component/topic');
        let compiled;

        command = Query.pipe(
            Query.all('/component/channel'),
            Query.all('/component/topic') 
        );
        compiled = command.compile( registry );

        // printIns( compiled, 6 );

        // t.equals( compiled.commands[0][0], Query.ENTITY_FILTER );

        // printIns( Query.value(10).and(Query.value(30)).compile(registry), 6 );

        t.end();
    });

    test('compiling an entity filter', t => {
        let registry = Common.initialiseRegistry();

        let entity = registry.createEntity( [{ id:'/component/channel', name:'test'},
            {id: "/component/topic", topic: "Javascript" }] );

        let filter = Query.all('/component/topic','/component/channel');
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

        // let filter = Query.pipe(
        //     Query.all('/component/channel_member')
        //     Query.none('/component/mode/invisible'),
        //     Query.attr('channel').equals(2) );

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


    test('multiple commands with a single result', t => {
        let registry = Common.initialiseRegistry();
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let clientId = 5;

        // Query.create(
        //     // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
        //     Query.all('/component/channel_member', Query.attr('client').equals(clientId) ) // NOTE: equiv of above
        //     Query.pluck('/component/channel_member', 'channel'),
        //     Query.as('channelIds'),

        //     // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
        //     Query.value( Query.ROOT ), // reset the query back again
        //     Query.all('/component/channel_member'), // all won't work with an array, so the prev is disregarded
        //     Query.all('/component/channel_member', Query.attr('channel').equals( Query.alias('channelIds') ) )
        //     Query.pluck('/component/channel_member', 'channel', {unique:true}), // result is now an array of channel values
        //     Query.without( clientId ), // the value `clientId` is removed from the list
        //     Query.as('clientIds'), // the list is stored into alias `clientIds`

        //     // 3. using the channel_member client ids, select an entityset of client entities by entity ids
        //     Query.selectById( Query.ROOT ) // list used as argument to select entities into ES
        //     );

        let query = Query.commands(
            
            Query.filter( 
                    Query.all('/component/channel_member'), 
                    Query.attr('/component/channel_member','client').equals( clientId ) )
                .pluck('/component/channel_member', 'channel')
                .as('channelIds'),
            
            Query.filter( 
                    Query.all('/component/channel_member'), 
                    Query.attr('/component/channel_member','channel').equals( Query.alias('channelIds')) )
                .pluck('/component/channel_member', 'client', {unique: true})
                .without( clientId )
                .as('clientIds'),

            Query.selectById( null, Query.alias('clientIds') )
        );

        let compiled = query.compile( registry );

        let result = compiled.execute( entitySet );

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