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
        // [
        //     'filter with component attribute',
        //     Query.component('/component/channel_member').attr('channel').equals(5).or( Query.greaterThan(10) ),
        //     [
        //         // TODO: implement this form
        //     ],
        //     [
        //         [ Query.FILTER,
        //             [ Query.VALUE, Query.ROOT ],
        //             [ Query.EQUALS, 
        //                 [ Query.ATTR, '/component/channel_member', 'channel' ],
        //                 [ Query.OR,
        //                     [ Query.VALUE, 5 ],
        //                     [ Query.GREATER_THAN, [ Query.VALUE, 10 ] ]
        //                     ] ] ]
        //     ]
        // ],
        [
            'filter with component attribute OR equality',
            Query.filter( Query.ROOT, Query.attr('/component/channel_member','channel').equals( 5 ).or( 11 ) ),
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
            ],
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
            'filter with entitySet',
            Query.filter( Query.all('/component/username') ),
            [
                Query.LEFT_PAREN,
                [ Query.ALL, Query.ROOT, '/component/username' ],
                Query.RIGHT_PAREN,
                Query.FILTER,
            ],
            [
                [ Query.FILTER, [ Query.ALL, Query.ROOT, '/component/username' ] ]
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
        ],
        [
            'aliasing a value',
            Query.filter( Query.none('/component/mode/invisible') ).as('present'),
            [
                Query.LEFT_PAREN,
                [ Query.NONE, Query.ROOT, '/component/mode/invisible' ],
                Query.RIGHT_PAREN,
                Query.FILTER,
                [Query.VALUE, 'present'],
                Query.ALIAS,
            ],
            [ 
                [ Query.ALIAS,
                    [ Query.VALUE, 'present' ],
                    [ Query.FILTER, 
                        [ Query.NONE, Query.ROOT, '/component/mode/invisible' ] 
                    ],
                ]
            ]
        ],
        [
            'using a stored alias',
            Query.filter( Query.alias('present') ),
            [
                Query.LEFT_PAREN,
                [ Query.VALUE, 'present' ],
                Query.ALIAS_GET,
                Query.RIGHT_PAREN,
                Query.FILTER
            ],
            [
                [ Query.FILTER,
                    [ Query.ALIAS_GET, [ Query.VALUE, 'present' ] ]
                ]
            ]
        ],
        [
            'plucking values',
            Query.filter(Query.ROOT)
                .pluck( '/component/channel_member', 'client' ),
            [
                Query.LEFT_PAREN, 
                
                Query.LEFT_PAREN, 
                    [ Query.VALUE, Query.ROOT ], 
                Query.RIGHT_PAREN, 
                Query.FILTER, // 17

                [ Query.VALUE, '/component/channel_member' ], 
                [ Query.VALUE, 'client' ], 

                Query.RIGHT_PAREN, 

                Query.PLUCK,
            ],
            [
                [ Query.PLUCK,
                    [ Query.FILTER,
                        [Query.VALUE, Query.ROOT],
                    ],
                    [ Query.VALUE, '/component/channel_member' ], 
                    [ Query.VALUE, 'client' ]
                ]
            ]
        ],
        [
            'aliasing a pluck',
            Query.filter(Query.ROOT).pluck('/component/channel','name').as('channel_names'),
            [
                Query.LEFT_PAREN, 
                Query.LEFT_PAREN, 
                [ Query.VALUE, Query.ROOT ], 
                Query.RIGHT_PAREN, 
                Query.FILTER, 
                [ Query.VALUE, '/component/channel' ], 
                [ Query.VALUE, 'name' ], 
                Query.RIGHT_PAREN, 
                Query.PLUCK, 
                [ Query.VALUE, 'channel_names' ], 
                Query.ALIAS
            ],
            [
                [ Query.ALIAS, 
                    [ Query.VALUE, 'channel_names' ], 
                    [ Query.PLUCK, 
                        [ Query.FILTER, 
                            [ Query.VALUE, Query.ROOT ] 
                        ], 
                        [ Query.VALUE, '/component/channel' ], 
                        [ Query.VALUE, 'name' ] 
                    ] 
                ]
            ]
        ],
        [
            'without',
            Query.filter(Query.ROOT).pluck('/component/channel', 'id').without( [1,2] ),
            [
                Query.LEFT_PAREN,
                Query.LEFT_PAREN, 
                [ Query.VALUE, Query.ROOT ], 
                Query.RIGHT_PAREN, 
                Query.FILTER, 
                [ Query.VALUE, '/component/channel' ], 
                [ Query.VALUE, 'id' ], 
                Query.RIGHT_PAREN, 
                Query.PLUCK, 
                [Query.VALUE, [1,2]],
                Query.WITHOUT
            ],
            [
                [ Query.WITHOUT, 
                    [ Query.PLUCK, 
                        [ Query.FILTER, 
                            [ Query.VALUE, Query.ROOT ] 
                        ], 
                        [ Query.VALUE, '/component/channel' ], 
                        [ Query.VALUE, 'id' ] 
                    ],
                    [Query.VALUE, [1,2]],
                ]
            ]
        ]
    ];

    test('query toArray', t => {

        _.each( cases, function(queryCase){
            t.deepEqual( queryCase[1].toArray( false ), queryCase[2], queryCase[0] );
            if( queryCase[3] ){
                let tree = Query.rpnToTree( queryCase[2] ); //= queryCase[1].toArray(true);
                // let tree = queryCase[1].toArray(true);
                t.deepEqual( tree, queryCase[3], 'ast ' + queryCase[0] );
            }
        });

        t.end();
    });


    test('pop last arg', t => {
        t.deepEqual( Query.popLastArg( [ 100 ], 0 ), [ [100], [] ] );
        t.deepEqual( Query.popLastArg( [ 100, 200 ], 1 ), [ [200], [100] ] );
        t.deepEqual( 
            Query.popLastArg( [ Query.LEFT_PAREN, 200, Query.RIGHT_PAREN ], 2), 
            [ [Query.LEFT_PAREN, 200, Query.RIGHT_PAREN], [] ] );
        t.deepEqual( 
            Query.popLastArg( [ 100, Query.LEFT_PAREN, 200, Query.RIGHT_PAREN ], 3), 
            [ [Query.LEFT_PAREN, 200, Query.RIGHT_PAREN], [100] ] );
        t.deepEqual( 
            Query.popLastArg( [ 100, Query.LEFT_PAREN, Query.LEFT_PAREN, 200, Query.RIGHT_PAREN, Query.RIGHT_PAREN ], 5), 
            [ [Query.LEFT_PAREN, Query.LEFT_PAREN, 200, Query.RIGHT_PAREN, Query.RIGHT_PAREN], [100] ] );
        t.end();
    });

    test('pop last command', t => {
        let popCases = [
            {
                msg: 'pop a command with two args',
                arg:[[ Query.VALUE, true ],
                    [ Query.VALUE, false ],
                    Query.AND ],
                expected:[ [[Query.VALUE,true], [Query.VALUE,false], Query.AND ], [] ]
            },
            {
                msg: 'pop command with one arg',
                arg:[
                    Query.LEFT_PAREN, [Query.VALUE,20], [Query.VALUE,21], Query.RIGHT_PAREN, Query.PLUCK
                ],
                expected:[
                    [ Query.LEFT_PAREN, [Query.VALUE,20], [Query.VALUE,21], Query.RIGHT_PAREN, Query.PLUCK], []
                ]
            }
        ]

        _.each( popCases, kase => {
            // log.debug('kase ' + JSON.stringify(kase) );
            t.deepEqual( Query.popLastCommand( kase.arg ), kase.expected, kase.msg );
        });

        // log.debug( JSON.stringify( Query.popLastCommand(valStack) ) );
        t.end();
    });
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    require('../lib/query/dsl');
    run( require('tape'), require('./common'), Elsinore );
}