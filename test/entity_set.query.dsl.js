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
            Query.value( true ).and( true ).toArray(), 
            [ Query.AND, [ Query.VALUE, true ], [ Query.VALUE, true ] ]
        );
        
        t.deepEqual(
            Query.attr('/component/channel_member','channel').equals( [2,4] ).toArray(),
            [ Query.EQUALS, [Query.ATTR, '/component/channel_member', 'channel'], [ Query.VALUE, [2,4] ] ] );

        t.end();
    });

    test('filter', t => {
        // printIns( Query.filter(null, Query.attr('/component/channel_member','channel').equals( [2,4] )).toArray() );
        t.deepEqual(
            Query.filter( null, Query.attr('/component/channel_member','channel').equals( [2,4] )).toArray(),
            [ Query.FILTER,
                [ Query.VALUE, Query.ROOT ], //[ Query.ALL, Query.ROOT, '/channel_member' ], 
                [ Query.EQUALS, 
                    [ Query.ATTR, '/component/channel_member', 'channel' ],
                    [ Query.VALUE, [2, 4] ]] ]  );
        t.end();
    });
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore );
}