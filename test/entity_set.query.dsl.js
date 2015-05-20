'use strict';

var _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Query = Elsinore.Query;

    let cases = [
        [
            'single value',
            Query.value(6),
            [
                [Query.VALUE, 6]
            ],
            [
                [Query.VALUE, 6]
            ],
        ],
        [
            'value OR equality',
            Query.value( 10 ).equals( 5 ).or( 6 ),
            [ 
                [ Query.VALUE, 10 ], 
                [ Query.VALUE, 5 ], 
                [ Query.VALUE, 6 ], 
                Query.OR, 
                Query.EQUALS ]
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
                Query.FILTER
            ],
            [
                [Query.FILTER,
                    [ Query.ALL, Query.ROOT, '/component/channel_member' ] ]
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
            ],
            [
                [ Query.FILTER,
                    [ Query.VALUE, Query.ROOT ],
                    [ Query.EQUALS, 
                        [ Query.ATTR, '/component/channel_member', 'channel' ],
                        [ Query.VALUE, [2, 4] ] ] ]
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
            ],
            [
                [ Query.FILTER,
                    [ Query.VALUE, Query.ROOT ],
                    [ Query.EQUALS, 
                        [ Query.ATTR, '/component/channel_member', 'channel' ],
                        [ Query.OR,
                            [ Query.VALUE, 5 ],
                            [ Query.VALUE, 11 ] ] ] ]
            ]
        ],
        [
            'component filter tree',
            Query.all('/component/username').all('/component/nickname').none('/component/mode/invisible'),
            [
                [Query.ALL, Query.ROOT, '/component/username'],
                [Query.ALL,  Query.ROOT, '/component/nickname'],
                [Query.NONE, Query.ROOT, '/component/mode/invisible'],
                Query.AND,
                Query.AND,
            ],
            [
                [ Query.AND,
                    [Query.ALL, Query.ROOT, '/component/username'],
                    [ Query.AND,
                        [Query.ALL,  Query.ROOT, '/component/nickname'],
                        [Query.NONE, Query.ROOT, '/component/mode/invisible'] ] ]
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
                Query.AND,
                Query.AND,
                Query.RIGHT_PAREN,
                Query.FILTER
            ],
            [ 
                [ Query.FILTER,
                  [ Query.AND, 
                      [ Query.ALL, Query.ROOT, '/component/username' ],
                      [ Query.AND,
                          [ Query.ALL, Query.ROOT, '/component/nickname' ],
                          [ Query.NONE, Query.ROOT, '/component/mode/invisible' ] ] ] ]
            ]
        ],
        [
            'multi AND',
            Query.value(24).and( 14 ).and(20).and(5),
            [
                [Query.VALUE, 24],
                [Query.VALUE, 14],
                [Query.VALUE, 20],
                Query.AND,
                [Query.VALUE, 5],
                Query.AND,
                Query.AND,
            ],
            [
                [Query.AND,
                    [Query.VALUE, 24],
                    [Query.AND,
                        [Query.AND,
                            [Query.VALUE, 14],
                            [Query.VALUE, 20] ],
                        [Query.VALUE, 5] ]
                ]
            ]
        ],
        [
            'component filter',
            Query.all('/component/username').none('/component/mode/invisible'),
            [
                [ Query.ALL, Query.ROOT, '/component/username' ],
                [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                Query.AND,
            ]
        ],
        [
            '4 component filter',
            Query.all('/component/username').none('/component/mode/invisible').all('/component/ex').none('/component/why'),
            [
                [ Query.ALL, Query.ROOT, '/component/username' ],
                [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                [ Query.ALL, Query.ROOT, '/component/ex' ],
                Query.AND,
                [ Query.NONE, Query.ROOT, '/component/why' ],
                Query.AND,
                Query.AND,
            ],
            [
                [ Query.AND,
                    [ Query.ALL, Query.ROOT, '/component/username' ],
                    [ Query.AND,
                        [Query.AND,
                            [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                            [ Query.ALL, Query.ROOT, '/component/ex' ] ],
                        [ Query.NONE, Query.ROOT, '/component/why']
                    ]
                ]
            ]
        ],
        [
            'filter with two complex arguments',
            Query.filter( 
                Query.all('/component/username').none('/component/mode/invisible'), 
                Query.attr('/component/channel_member', 'channel').equals(10) ),
            [
                Query.LEFT_PAREN,
                [ Query.ALL, Query.ROOT, '/component/username' ],
                [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                Query.AND,
                [ Query.ATTR, '/component/channel_member', 'channel' ],
                [ Query.VALUE, 10 ],
                Query.EQUALS,
                Query.RIGHT_PAREN,
                Query.FILTER
            ],
            [
                [ Query.FILTER,
                    [ Query.AND, 
                        [ Query.ALL, Query.ROOT, '/component/username' ],
                        [ Query.NONE, Query.ROOT, '/component/mode/invisible' ] ],
                    [ Query.EQUALS, 
                        [ Query.ATTR, '/component/channel_member', 'channel' ],
                        [ Query.VALUE, 10 ] ]
                    ]
            ]
        ]//*/
    ];

    test('query toArray', t => {

        _.each( cases, function(queryCase){
            t.deepEqual( queryCase[1].toArray(), queryCase[2], queryCase[0] );
            if( queryCase[3] ){
                t.deepEqual( queryCase[1].toArray( true ), queryCase[3], 'ast ' + queryCase[0] );
            }
        });

        t.end();
    });
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore );
}