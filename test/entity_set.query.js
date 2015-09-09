'use strict';

var _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){

    var Component = Elsinore.Component;
    var Entity = Elsinore.Entity;
    var Query = Elsinore.Query;

    test('entityset filter ALL', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

            let result = entitySet.query(
                Query.all('/component/mode/invite_only') );
            // let result = entitySet.query( 
            //     [ [ Query.ALL, '/component/mode/invite_only' ] ],
            //     {debug:false, result:false} );

            t.ok( EntitySet.isEntitySet(result), 'the result should be an entityset' );
            t.equals( result.size(), 1, 'there should be a single entity' );

            t.end();
        });
    });

    test('entityset filter by attribute', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
            // select entities which have the component /channel_member and 
            //  have the client attribute
            // aka Query.all( '/component/channel_member', Query.attr('client').equals(5) );
            let result = entitySet.query(
                Query.all( '/component/channel_member', 
                    Query.attr('client').equals(5)) );
            // let result = Query.execute( entitySet, 
            //     [ Query.ALL_FILTER, 
            //         [Query.VALUE, '/component/channel_member'],
            //         [ Query.EQUALS,
            //             [ Query.ATTR, 'client' ],
            //             [ Query.VALUE, 5 ]
            //         ]
            //     ], {debug:false} );
            
            t.equals( result.size(), 2 );
            t.end();
        });
    });

    test('include will filter an entity', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
            let query = Query.include('/component/nickname');
            let entity = entitySet.getEntity( 5 );
            
            let result = query.execute( entity, {debug:false} );
            t.equals( result.getComponentCount(), 1, 'all but one component passes');

            t.end();
        })
        .catch( err => log.error('test error: ' + err.stack) )
    });

    test('entityset filter by attribute being within a value array', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

            // select entities which have the component /channel_member and 
            //  have the client attribute
            let result = Query.execute( entitySet, 
                Query.all('/component/channel_member').where( Query.attr('channel').equals([2,4])) );
            // let result = Query.execute( entitySet, 
            //     [ Query.ALL_FILTER, 
            //         [Query.VALUE, '/component/channel_member'],
            //         [ Query.EQUALS, 
            //             [ Query.ATTR, 'channel' ],
            //             [ Query.VALUE, [2, 4] ] ] ] );

            t.equals( result.size(), 4 );
            t.end();
        });
    });

    test('multiple component filters', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

            // select entities which have /channel_member but not /mode/invisible
            let result = entitySet.query([
                Query.all('/component/channel_member'),
                Query.none('/component/mode/invisible')] );
            // let result = Query.execute( entitySet, 
            //     [ 
            //         [Query.ALL, [Query.VALUE, '/component/channel_member'] ],
            //         [Query.NONE, [Query.VALUE, '/component/mode/invisible'] ] 
            //     ]
            //     ,{debug:false});
            
            // printE( result );
            t.equals( result.size(), 5 );
            t.end();
        });
    });

    test('PLUCK op', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

            let result = entitySet.query(
                Query.pluck( '/component/topic', 'topic' )
                );
            // let result = Query.execute( entitySet,
            //     [ Query.PLUCK,
            //         [ Query.VALUE, '/component/topic' ], 
            //         [ Query.VALUE, 'topic' ]
            //     ]
            // ,{debug:false});
            
            t.deepEqual( result,
                ['Entity Component Systems', 'Javascript', 'Welcome to Politics'] );

            t.end();
        });
    });

    test('plucking entity ids from the given entityset', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

            let result = entitySet.query(
                Query.pluck( null, 'eid', {unique:true})
                );
            
            t.deepEqual(
                result,
                [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 ]
                );

            t.end();
        });
    });

    test('resetting the context entitySet', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

            let result = entitySet.query([
                Query.any( ['/component/username','/component/channel'] ),
                Query.root(),
                Query.pluck( null, 'eid', {unique:true} )
                ], {debug: false});

            t.equal( result.length, 18 );
            t.end();
        })
        .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
    });

    

    test.skip('stuff', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {

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
    });

    test('sub-queries', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
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
                    '/component/channel_member',
                    [ Query.EQUALS,
                        [ Query.ATTR, 'client' ], 
                        clientId
                    ]
                ],

                [ Query.PLUCK, '/component/channel_member',  'channel' ],

                [ Query.ALIAS, 'channelIds' ],

                // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
                // clear the value
                [Query.ROOT],

                [ Query.ALL_FILTER, 
                    '/component/channel_member',
                    [ Query.EQUALS,
                        [ Query.ATTR, 'channel' ], 
                        [ Query.ALIAS_GET, 'channelIds' ]
                    ]
                ],

                [ Query.PLUCK, '/component/channel_member', 'client', {unique:true} ],

                [ Query.WITHOUT, clientId ],

                [Query.ALIAS, 'clientIds'],
                // // 3. using the channel_member client ids, select an entityset of client entities 
                [ Query.ROOT ],

                [ Query.SELECT_BY_ID, [ Query.ALIAS_GET, 'clientIds' ] ],

                ], {value:true, debug:false} ); 

            // the result should have 3 entities - channel_member, channel and client
            t.equal( result.size(), 4 );

            t.end();
        });
    });

    function initialiseEntitySet(entities){
        return Common.initialiseRegistry(false).then( registry => {
            let entitySet = Common.loadEntities( registry, (entities||'query.entities') );
            return [registry,entitySet];
        });
    }
}


// serverside only execution of tests
if( !process.browser ){
    let Common = require('./common');
    run( require('tape'), Common, Common.Elsinore, Common.Elsinore.EntitySet );
}