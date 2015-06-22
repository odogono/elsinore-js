'use strict';

let _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let Query = Elsinore.Query;

    test('EQUALS op', t => {
        t.deepEqual(
            Query.execute( null, [ Query.EQUALS, 8, 8 ] ), true );
        t.deepEqual(
            Query.execute( null, [ Query.EQUALS, 8, [ Query.VALUE, [1,3,5,8] ] ] ), true );
        t.end();
    });

    test('Logic op', t => {

        let commands = [
            Query.value(true).and( Query.value(true) ),
            Query.value(false).or( Query.value(true) )
        ];
        // let commands = [
        //     [ Query.AND, [ Query.VALUE, true ], [ Query.VALUE, true ] ],
        //     [ Query.OR, [ Query.VALUE, false ], [ Query.VALUE, true ] ],
        // ];

        _.each( commands, command => {
            // let result = Query.execute( null, command );
            t.deepEqual( Query.execute( null, command ), true );
        });

        t.end();
    });

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

        result = Query.all( '/component/name' ).execute( entity, {debug:false} );

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

        query = Query.create( registry, query );
        t.ok( query.isCompiled );
        
        let result = query.execute( entity );
        t.ok( Entity.isEntity(result) );

        t.end();
    })


    test('accepting an entity based on its attributes', t => {
        let [registry,entitySet] = initialiseEntitySet();
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
        let [registry,entitySet] = initialiseEntitySet();

        let query = Query.create( registry, Query.all('/component/channel') );
        
        let result = query.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result), 
            'the returned value is an entityset' );
        // printE( result );
        t.equals( result.size(), 4, 
            'the entityset contains 4 entities each with a /component/channel' );
        
        t.end();
    });


    test('filter query on an entityset', t => {
        let [registry,entitySet] = initialiseEntitySet();

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

    test('ALIAS op', t => {
        let result = Query.execute( null,[
            Query.value( [9,10,11] ),
            Query.aliasAs('channelIds'),
            Query.value( [9,10,11] ).equals( Query.alias('channelIds') )
            ]);
        // let result = Query.execute( null,[ 
        //     [ Query.VALUE, [9, 10, 11]] ,
        //     [ Query.ALIAS, 'channelIds' ],
        //     [ Query.EQUALS,
        //         [ Query.VALUE, [ 9, 10, 11 ] ],
        //         [ Query.ALIAS_GET, [ Query.VALUE, 'channelIds' ] ]] ]
        // ,{debug:false}); 

        t.deepEqual( result,  true );

        t.end();
    });

    test('passing an alias into a query', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let query = Query.create(registry, [
            Query.all('/component/channel_member', 
                Query.attr('channel').equals( Query.alias('channelIds')))
            ]);

        let result = query.execute( entitySet, {
            alias:{ channelIds:2 }
        });

        t.deepEqual(
            result.pluck('/component/channel_member', 'eid'),
            [ 15,16,17 ] );

        t.end();
    });

    test('multiple commands with a single result', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let clientId = 5;

        let query = Query.create( registry,[
            // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            Query.all('/component/channel_member', 
                Query.attr('client').equals(clientId) ),
            Query.pluck('/component/channel_member', 'channel'), // get all the values for 'channel'
            Query.aliasAs( 'channelIds' ), // save the pluck result (array) in the context for later

            // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            Query.root(), // this resets the context back to the original entitySet
            Query.all('/component/channel_member', 
                Query.attr('channel').equals( Query.alias('channelIds'))),
            Query.pluck('/component/channel_member', 'client', {unique:true}),
            Query.without( clientId ), // remove the clientId from the result of the pluck
            Query.aliasAs('clientIds'),

            // 3. using the channel_member client ids, select an entityset of client entities by entity ids
            Query.root(),
            Query.selectById( Query.alias('clientIds') ) // creates a new ES from selected ids
            ]);


        let result = query.execute( entitySet );

        t.ok( EntitySet.isEntitySet(result) );
        // printE( result );
        t.equals( result.size(), 4 );

        t.end();

    });

    test('hashing queries', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let queryA = Query.create( registry, Query.all('/component/username') );
        let queryB = Query.create( registry, Query.all('/component/username') );
        let queryC = Query.create( registry, Query.any('/component/username') );

        t.equals( queryA.hash(), queryB.hash() );
        t.notEqual( queryA.hash(), queryC.hash() );

        t.end();
    });

    test('query serialisation', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let query = Query.create( registry, [
                Query.all('/component/channel_member'),
                Query.none('/component/mode/invisible'),
                Query.all('/component/channel_member', Query.attr('channel').equals(2) )
            ] );

        let json = query.toJSON();

        t.deepEqual( json, [
            [ 0, [ 16, '/component/channel_member' ] ], 
            [ 3, [ 16, '/component/mode/invisible' ] ], 
            [ 34, 
                [ 16, '/component/channel_member' ], 
                [ 7, [ 19, 'channel' ], [ 16, 2 ] ] 
            ] ] );

        let reQuery = Query.create( registry, json );

        t.equals( query.execute(entitySet).size(), 
            reQuery.execute(entitySet).size() );

        t.end();
    })

    function initialiseEntitySet(){
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );
        return [registry,entitySet];
    }
}

// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}