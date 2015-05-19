'use strict';

var _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Query = Elsinore.Query;

    let cases = [
        [
            'value OR equality',
            Query.value( 10 ).equals( 5 ).or( 6 ),
            [ [ Query.VALUE, 10 ], [ Query.VALUE, 5 ], [ Query.VALUE, 6 ], Query.OR, Query.EQUALS ]
        ],
        [
            'value AND',
            Query.value( true ).and( true ),
            [ [ Query.VALUE, true ], [ Query.VALUE, true ], Query.AND ]
        ],
        [
            'attribute equality',
            Query.attr('/component/channel_member','channel').equals( [2,4] ),
            [ [Query.ATTR, '/component/channel_member', 'channel'], [Query.VALUE, [2,4] ], Query.EQUALS]
        ],
        [
            'filter with single string argument',
            Query.filter( '/component/channel_member' ),
            [
                Query.LEFT_PAREN,
                [ Query.ALL, Query.ROOT, '/component/channel_member' ],
                Query.RIGHT_PAREN,
                Query.FILTER
            ]
        ],
        [
            'filter with single ALL argument',
            Query.filter( Query.all('/component/channel_member') ),
            [
                Query.LEFT_PAREN,
                [ Query.ALL, Query.ROOT, '/component/channel_member' ],
                Query.RIGHT_PAREN,
                // Query.AND_FILTER,
                Query.FILTER
            ]
        ],
        [
            'filter with component attribute equality',
            Query.filter( null, Query.attr('/component/channel_member','channel').equals( [2,4] )),
            [
                Query.LEFT_PAREN,
                [ Query.VALUE, Query.ROOT ],
                [ Query.ATTR, '/component/channel_member', 'channel' ],
                [ Query.VALUE, [2, 4] ],
                Query.EQUALS,
                Query.RIGHT_PAREN,
                Query.FILTER
            ]
        ],
        [
            'filter with component attribute OR equality',
            Query.filter( null, Query.attr('/component/channel_member','channel').equals( 5 ).or( 11 ) ),
            [
                Query.LEFT_PAREN,
                [ Query.VALUE, Query.ROOT ],
                [ Query.ATTR, '/component/channel_member', 'channel' ],
                [ Query.VALUE, 5 ],
                [ Query.VALUE, 11 ],
                Query.OR,
                Query.EQUALS,
                Query.RIGHT_PAREN,
                Query.FILTER
            ]
        ],
        [
            'filter with multiple entityset selection',
            Query.filter( Query.all('/component/username').all('/component/nickname').none('/component/mode/invisible') ),
            [
                Query.LEFT_PAREN,
                [ Query.ALL, Query.ROOT, '/component/username' ],
                [ Query.ALL, Query.ROOT, '/component/nickname' ],
                [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                Query.RIGHT_PAREN,
                // Query.AND_FILTER,
                Query.FILTER
            ] 
        ]
    ];

    test('query toArray', t => {

        _.each( cases, function(queryCase){
            t.deepEqual( queryCase[1].toArray(), queryCase[2], queryCase[0] );
        });

        t.end();
    });
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore );
}