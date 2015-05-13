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

    test('calling query returns a Query object', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry );

        let query = entitySet.query("/component/status");

        t.ok( Query.isQuery(query), 'the result is an instance of Query' );

        let result = query.execute();

        t.ok( EntitySet.isEntitySet(result) );
        t.equal( result.size(), 3 );

        t.end();
    });

    test('query filtering by component attribute', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry );

        let result = entitySet
            .query('/component/status')
            .filter( entity => entity.Status.get('status') == 'active' )
            //.filter( Query.component('/component/status').attr('status').equals('active') )
            .execute();

        t.equal( result.size(), 2 );

        t.end();
    });


    test.skip('retrieving referenced entities', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );

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

    test('EQ op', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let result = Query.execute( entitySet, [ Query.EQ, '/component/topic', 'topic' ] );

        t.equals( result,
            [Query.VALUE, ['Entity Component Systems', 'Javascript', 'Welcome to Politics']] );

        t.end();
    });

    test.only('entityset filter ALL', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let result = Query.execute( entitySet, [ Query.ALL, Query.ROOT, '/component/mode/invite_only'] );

        t.equal( result[0], Query.VALUE );
        t.ok( EntitySet.isEntitySet(result[1]) );
        t.ok( result[1].size(), 1 );

        t.end();
    })


    test('PLUCK op', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let result = Query.execute( entitySet, [ Query.PLUCK, Query.ROOT, '/component/topic', 'topic' ] );

        t.deepEqual( result,
            [Query.VALUE, ['Entity Component Systems', 'Javascript', 'Welcome to Politics']] );

        t.end();
    });


    test.skip('sub-queries', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        // query consists of two parts:
        // - /channel_member components which have the client attr set to `clientId` are
        //   selected.
        // - the channel attr from /channel_member is plucked out and placed into the alias `channelIds`
        // - /channel_member components are selected which have their channel_ref attribute match one
        //   of the values from the previously saved channelIds array
        let result = entitySet
            .query()
                .where( 
                    Query.component('/component/channel_member')
                        .attr('client')
                        .equals(clientId) )
                .pluck( '/component/channel_member', 'channel' )
                .as( 'channelIds' )
            .query()
                .filter( 
                    Query.component('/component/channel_member')
                        .attr('channel_ref')
                        .equals( 
                            Query.alias('channelIds') ))
                .execute();
        /*
            [ ALIAS, // alias op1 to op2
                'channelIds', // name of the alias to set
                [ PLUCK, // select the attributes from op2
                    [ FILTER, // select a subset of entities in op1 by using op2
                        [ ALL, ROOT, '/channel_member' ], 
                        [ EQ, 
                            [ ATTR, '/channel_member', 'client' ],
                            [ VALUEOF, clientId ] ] ], 
                    '/channel_member', // components
                    'channel' ], // attributes
                

            [ FILTER,
                [ ALL, ROOT, '/channel_member' ],
                [ EQ, 
                    [ ATTR, '/channel_member', 'client' ],
                    [ ALIAS, 'channelIds' ] ] ], 
        */

        printE( result );
        // the result should have 3 entities - channel_member, channel and client
        t.equal( result.size(), 3 );

        t.end();
    })
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}