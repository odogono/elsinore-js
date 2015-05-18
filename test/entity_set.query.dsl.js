'use strict';

var _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Query = Elsinore.Query;

    // printIns( Query,1 );

    // test.only('value', t => {
    //     t.deepEqual(
    //         Query.value( true ).toArray(),
    //         [ [ Query.VALUE, true ] ]
    //         );
    //     t.end();
    // });

    test('Logic op', t => {

        t.deepEqual(
            Query.value( 10 ).equals( 5 ).or( 6 ).toArray(),
            [ [ Query.VALUE, 10 ], [ Query.VALUE, 5 ], [ Query.VALUE, 6 ], Query.OR, Query.EQUALS ]
        );

        t.deepEqual(
            Query.value( true ).and( true ).toArray(), 
            [ [ Query.VALUE, true ], [ Query.VALUE, true ], Query.AND ]
        );
        
        t.deepEqual(
            Query.attr('/component/channel_member','channel').equals( [2,4] ).toArray(),
            [ [Query.ATTR, '/component/channel_member', 'channel'], [Query.VALUE, [2,4] ], Query.EQUALS] );

        t.end();
    });

    test('filter', t => {
        t.deepEqual(
            Query.filter( null, Query.attr('/component/channel_member','channel').equals( [2,4] )).toArray(),
            [
                [ Query.VALUE, Query.ROOT ],
                [ Query.ATTR, '/component/channel_member', 'channel' ],
                [ Query.VALUE, [2, 4] ],
                Query.EQUALS,
                Query.FILTER
            ] );

        // V-ROOT
        // V-ROOT Q.ATTR
        // V-ROOT Q.ATTR V-2,4
        // V-ROOT [ EQUALS - Q.ATTR V-2,4 ]
        // FILTER V-ROOT [ EQUALS - Q.ATTR V-2,4 ]
            // [ Query.FILTER,
            //     [ Query.VALUE, Query.ROOT ], //[ Query.ALL, Query.ROOT, '/channel_member' ], 
            //     [ Query.EQUALS, 
            //         [ Query.ATTR, '/component/channel_member', 'channel' ],
            //         [ Query.VALUE, [2, 4] ]] ]  );
        t.end();
    });

    test('filter ex', t => {
        // printIns( Query.attr('/component/channel_member','channel').equals(5).or(11).toArray() );

        // [ Q.ATTR ] 
        // [ Q.ATTR ] 5
        // [ Q.ATTR ] 5 11
        // [ Q.ATTR ] 5 11 OR
        // [ Q.ATTR ] [ 5, 11, OR ]
        // [ Q.ATTR ] [ 5, 11, OR ] ==
        // [ [ Q.ATTR ], [ 5, 11, OR ], == ]

        t.deepEqual(
            Query.filter( null, Query.attr('/component/channel_member','channel').equals( 5 ).or( 11 ) ).toArray(),
            [
                [ Query.VALUE, Query.ROOT ],
                [ Query.ATTR, '/component/channel_member', 'channel' ],
                [ Query.VALUE, 5 ],
                [ Query.VALUE, 11 ],
                Query.OR,
                Query.EQUALS,
                Query.FILTER
            ] );
            // [ Query.FILTER,
            //     [ Query.VALUE, Query.ROOT ], //[ Query.ALL, Query.ROOT, '/channel_member' ], 
            //     [ Query.EQUALS, 
            //         [ Query.ATTR, '/component/channel_member', 'channel' ],
            //         [ Query.OR,
            //             [Query.VALUE, 5 ],
            //             [Query.VALUE, 11 ] ]
            //     ]] );
        t.end();
    });

    test('filter with component bitmask', t => {
        t.deepEqual(
            Query.filter( Query.all('/component/username').all('/component/nickname').none('/component/mode/invisible') ).toArray(true),
            [
                [ Query.ALL, Query.ROOT, '/component/username' ],
                [ Query.ALL, Query.ROOT, '/component/nickname' ],
                [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                Query.AND_FILTER,
                Query.FILTER
            ] );

        t.end();
    });
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore );
}