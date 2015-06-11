'use strict';

var _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){

    var Component = Elsinore.Component;
    var Entity = Elsinore.Entity;
    var Query = Elsinore.Query;

    test.skip('excluding', t => {
        let f = EntityFilter.create();
        let e = createEntity( {_c:Components.Animal, colour:'orange'}, {_c:Components.Robot, age:41} );


        // {
        //     entity: [{_c:Components.Animal, colour:'orange'}, {_c:Components.Robot, age:41}],
        //     ok: [ EntityFilter.EXCLUDE, Components.Animal ]
        // }


        EntityFilter.accept( e, EntityFilter.EXCLUDE, Components.Animal );

        // f.add( [ Query.FILTER, Query.ROOT, [ Query.EXCLUDE, Components.Animal] ] );

        t.ok( f.accept( e ) );

        t.end();
    });

    // test('calling query returns a Query object', t => {
    //     let registry = Common.initialiseRegistry(false);
    //     let entitySet = Common.loadEntities( registry );

    //     let query = entitySet.query("/component/status");

    //     t.ok( Query.isQuery(query), 'the result is an instance of Query' );

    //     let result = query.execute();

    //     t.ok( EntitySet.isEntitySet(result) );
    //     t.equal( result.size(), 3 );

    //     t.end();
    // });

    // test('query filtering by component attribute', t => {
    //     let registry = Common.initialiseRegistry(false);
    //     let entitySet = Common.loadEntities( registry );

    //     let result = entitySet
    //         .query('/component/status')
    //         .filter( entity => entity.Status.get('status') == 'active' )
    //         //.filter( Query.component('/component/status').attr('status').equals('active') )
    //         .execute();

    //     t.equal( result.size(), 2 );

    //     t.end();
    // });


    test.skip('retrieving referenced entities', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let result = entitySet
            // select all entities which have the ChannelMember component
            .query('/component/channel_member')
            // filter those ChannelMember entities to those which have a value of 11 for the 'client' attribute
            // the filter gets applied to each entity in the selected set
            .filter( entity => entity.ChannelMember.get('client') === 11 )
            .filter( Query.component('/component/channel_member').attr('client').eq(11) )
            // (==, value(/component/channel_member(client)), value(11))
            // selects all the values for the attributes channel and client in the /component/channel_member component
            // and then uses those values to add entities into the result using the top level entitySet.
            // if we had missed out the last argument, it would select entities from the current filter
            .addEntities( 
                Query.component('/component/channel_member').attr('client','channel'), entitySet )
            // value(/component/channel_member(client,channel))
            .execute();

        // filterEntities( rootEntitySet, /component/channel_member)
        // -- the working set now has entities with /channel_member components
        // filterEntities( `prev`, (==, value(/component/channel_member(client)), value(11))
        // -- the working set now has the entity with a channel_member.client value of 11
        // addEntities( rootEntitySet, value(/component/channel_member(client,channel)) )
        // -- into the working set we add additional entities selected 


        printE( result );
        // the result should have 3 entities - channel_member, channel and client
        t.equal( result.size(), 3 );

        t.end();
    });

    // test('EQ op', t => {
    //     let registry = Common.initialiseRegistry(false);
    //     let entitySet = Common.loadEntities( registry, 'query.entities' );

    //     let result = Query.execute( entitySet, [ Query.EQUALS, '/component/topic', 'topic' ] );

    //     t.equals( result,
    //         [Query.VALUE, ['Entity Component Systems', 'Javascript', 'Welcome to Politics']] );

    //     t.end();
    // });

    test('entityset filter ALL', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let result = entitySet.query( 
            [ Query.ALL, '/component/mode/invite_only' ],
            {debug:false, result:false} );

        t.equal( result[0], Query.VALUE );
        t.ok( EntitySet.isEntitySet(result[1]) );
        t.ok( result[1].size(), 1 );

        t.end();
    });

    test('EQUALS op', t => {
        t.deepEqual(
            Query.execute( null, [ Query.EQUALS, 8, 8 ] ), true );
        t.deepEqual(
            Query.execute( null, [ Query.EQUALS, 8, [ Query.VALUE, [1,3,5,8] ] ] ), true );
        t.end();
    })

    test('entityset filter by attribute', t => {
        let [registry,entitySet] = initialiseEntitySet();

        // select entities which have the component /channel_member and 
        //  have the client attribute
        // aka Query.all( '/component/channel_member', Query.attr('client').equals(5) );
        let result = Query.execute( entitySet, 
            [ Query.ALL_FILTER, 
                [Query.VALUE, '/component/channel_member'],
                [ Query.EQUALS,
                    [ Query.ATTR, 'client' ],
                    [ Query.VALUE, 5 ]
                ]
            ], {debug:false} );
        
        t.equals( result.size(), 2 );
        t.end();
    });

    test('entityset filter by attribute being within a value array', t => {
        let [registry,entitySet] = initialiseEntitySet();

        // select entities which have the component /channel_member and 
        //  have the client attribute
        let result = Query.execute( entitySet, 
            [ Query.ALL_FILTER, 
                [Query.VALUE, '/component/channel_member'],
                [ Query.EQUALS, 
                    [ Query.ATTR, 'channel' ],
                    [ Query.VALUE, [2, 4] ] ] ] );

        t.equals( result.size(), 4 );
        t.end();
    });

    test('multiple component filters', t => {
        let [registry,entitySet] = initialiseEntitySet();

        // select entities which have /channel_member but not /mode/invisible
        let result = Query.execute( entitySet, 
            [ 
                [Query.ALL, [Query.VALUE, '/component/channel_member'] ],
                [Query.NONE, [Query.VALUE, '/component/mode/invisible'] ] 
            ]
            ,{debug:false});
        
        // printE( result );
        t.equals( result.size(), 5 );
        t.end();
    });

    test('PLUCK op', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let result = Query.execute( entitySet,
            [ Query.PLUCK,
                [ Query.VALUE, '/component/topic' ], 
                [ Query.VALUE, 'topic' ]
            ]
        ,{debug:false});
        
        t.deepEqual( result,
            ['Entity Component Systems', 'Javascript', 'Welcome to Politics'] );

        t.end();
    });

    test('plucking entity ids from the given entityset', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let result = Query.execute( entitySet, [
            [ Query.PLUCK, null, 'eid', {unique:true} ]
            ], {debug:false});

        t.deepEqual(
            result,
            [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 ]
            );

        t.end();
    });

    test('resetting the context entitySet', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let result = Query.execute( entitySet, [
            [ Query.ANY, [ Query.VALUE, ['/component/username','/component/channel'] ]],
            // at this point, the context entityset is a subset of the root
            [ Query.VALUE, Query.ROOT ],
            // the context entityset is now === the root
            [ Query.PLUCK, null, 'eid', {unique:true} ]
            ]);

        t.equal( result.length, 18 );
        t.end();
    });

    test('ALIAS op', t => {
        let result = Query.execute( null,[ 
            [ Query.VALUE, [9, 10, 11]] ,
            [ Query.ALIAS, 'channelIds' ],
            [ Query.EQUALS,
                [ Query.VALUE, [ 9, 10, 11 ] ],
                [ Query.ALIAS_GET, [ Query.VALUE, 'channelIds' ] ]] ]
        ,{debug:false}); 

        t.deepEqual( result,  true );

        t.end();
    });


    test('Logic op', t => {

        let commands = [
            [ Query.AND, [ Query.VALUE, true ], [ Query.VALUE, true ] ],
            [ Query.OR, [ Query.VALUE, false ], [ Query.VALUE, true ] ],
        ];

        _.each( commands, command => {
            // let result = Query.execute( null, command );
            t.deepEqual( Query.execute( null, command ), true );
        });

        t.end();
    });

    test.skip('stuff', t => {
        let [registry,entitySet] = initialiseEntitySet();

        let result = Query.execute( entitySet, [
            // [ Query.ANY, [ Query.VALUE, ['/component/username','/component/channel'] ]],
            // [ Query.VALUE, Query.ROOT ],
            // [ Query.PLUCK, null, 'eid', {unique:true} ]
            [Query.VALUE, [ 1,2,5 ] ],
            [Query.ALIAS, [Query.VALUE, 'entityIds'] ],

            [Query.VALUE, Query.ROOT],
            [ Query.SELECT_BY_ID, [Query.ALIAS_GET, [Query.VALUE,'entityIds']] ]

            ], {debug:false});

        t.equal( result.length, 18 );
        t.end();
    });

    test('sub-queries', t => {
        let [registry,entitySet] = initialiseEntitySet();
        let clientId = 5;

        // this query selects the other entities which are members of the same channel
        // as entity id 5
        //
        // query consists of two parts:
        // - /channel_member components which have the client attr set to `clientId` are
        //   selected.
        // - the channel attr from /channel_member is plucked out and placed into the alias `channelIds`
        // - /channel_member components are selected which have their channel_ref attribute match one
        //   of the values from the previously saved channelIds array
        let result = Query.execute( entitySet,[

            // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            [ Query.ALL_FILTER, 
                [ Query.VALUE, '/component/channel_member' ],
                [ Query.EQUALS,
                    [ Query.ATTR, 'client' ], 
                    [ Query.VALUE, clientId ]
                ]
            ],

            [ Query.PLUCK,
                [ Query.VALUE, '/component/channel_member' ], 
                [ Query.VALUE, 'channel' ]
            ],

            [ Query.ALIAS, 'channelIds' ],

            // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            // clear the value
            [ Query.VALUE, Query.ROOT ],

            [ Query.ALL_FILTER, 
                [ Query.VALUE, '/component/channel_member' ],
                [ Query.EQUALS,
                    [ Query.ATTR, 'channel' ], 
                    [ Query.ALIAS_GET, [Query.VALUE, 'channelIds'] ]
                ]
            ],

            [ Query.PLUCK,
                [ Query.VALUE, '/component/channel_member' ], 
                [ Query.VALUE, 'client' ], {unique:true}
            ],

            [ Query.WITHOUT, [Query.VALUE, clientId] ],

            [Query.ALIAS, [Query.VALUE,'clientIds']],
            // // 3. using the channel_member client ids, select an entityset of client entities 
            [Query.VALUE, Query.ROOT],
            [ Query.SELECT_BY_ID, [Query.ALIAS_GET, [Query.VALUE,'clientIds']] ],

            // // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            // [ Query.ALIAS, // alias op1 to op2
            //     'channelIds', // name of the alias to set
            //     [ Query.PLUCK, // select the attributes from op2
            //         [ Query.FILTER, // select a subset of entities in op1 by using op2
            //             [ Query.ALL, Query.ROOT, '/component/channel_member' ], 
            //             [ Query.EQUALS, 
            //                 [ Query.ATTR, '/component/channel_member', 'client' ],
            //                 [ Query.VALUE, clientId ] ] ], 
            //         '/component/channel_member', // components
            //         'channel' ]], // attributes
            // // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            // [ Query.ALIAS, 
            //     'clientIds',
            //     [ Query.WITHOUT,
            //         [ Query.PLUCK,
            //             [ Query.FILTER,
            //                 [ Query.ALL, Query.ROOT, '/component/channel_member' ],
            //                 [ Query.EQUALS, 
            //                     [ Query.ATTR, '/component/channel_member', 'channel' ],
            //                     [ Query.ALIAS, 'channelIds' ] ] ],
            //             '/component/channel_member', 'client', {unique: true} ],
            //         [ Query.VALUE, clientId ] ], // without the client id included
            // ],

            // // 3. using the channel_member client ids, select an entityset of client entities 
            // //   by the entity ids
            // [ Query.SELECT_BY_ID,
            //     Query.ROOT,
            //     [ Query.ALIAS, 'clientIds' ]],

            ], {value:true, debug:false} ); 
        
        // printIns( result, 2 );
        // printE( result );
        // the result should have 3 entities - channel_member, channel and client
        t.equal( result.size(), 4 );

        t.end();
    });

    function initialiseEntitySet(){
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );
        return [registry,entitySet];
    }
}


// serverside only execution of tests
if( !process.browser ){
    
    let Elsinore = require('../lib');
    require('./common');
    require('../lib/entity_set/query');
    
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}