'use strict';

var _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Query = Elsinore.Query;

    let cases = [
        [
            'root',
            [
                Query.all('/component/channel'),
                Query.root(),
                Query.all('/component/topic')
            ],
            [
                [ Query.VALUE, '/component/channel' ],
                Query.ALL,
                Query.ROOT,
                [ Query.VALUE, '/component/topic' ],
                Query.ALL
            ],
            [
                [ Query.ALL, [ Query.VALUE, '/component/channel' ] ], 
                [ Query.ROOT ], 
                [ Query.ALL, [ Query.VALUE, '/component/topic' ] ]
            ]
        ],
        [
            'multiple all with attr',
            [
                // entities should have a /channel component
                Query.all('/component/channel'),
                // entities should have a /topic component with a channel attr equal to 16 or 32
                Query.all('/component/topic', Query.attr('channel').equals( 16 ).or( 32 ) )
            ],
            [
                [ Query.VALUE, '/component/channel' ],
                Query.ALL,
                [ Query.VALUE, '/component/topic' ],
                [ Query.ATTR,  'channel' ],
                [ Query.VALUE, 16 ],
                [ Query.VALUE, 32 ],
                Query.OR,
                Query.EQUALS,
                Query.ALL_FILTER
            ],
            [
                [ Query.ALL, [Query.VALUE,'/component/channel'] ],
                [ Query.ALL_FILTER,
                    [Query.VALUE, '/component/topic'],
                    [ Query.EQUALS,
                        [ Query.ATTR, 'channel' ],
                        [ Query.OR,
                            [ Query.VALUE, 16 ],
                            [ Query.VALUE, 32 ] ] ]
                ]
            ]
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
            'value AND again',
            Query.value(10).and( Query.value(30) ),
            [ [ Query.VALUE, 10 ], [ Query.VALUE, 30 ], Query.AND ],
            [ 
                [Query.AND, [ Query.VALUE, 10 ], [Query.VALUE, 30]]
            ]
        ],
        [
            'value AND AND again',
            Query.value(10).and( Query.value(30).and( Query.value(5) ) ),
            [ 
                [Query.VALUE, 10], 
                [Query.VALUE, 30], 
                [Query.VALUE, 5], 
                Query.AND,
                Query.AND
            ],
            [ 
                [Query.AND, 
                    [ Query.VALUE, 10 ], 
                    [Query.AND,
                        [Query.VALUE, 30],
                        [Query.VALUE, 5] ]
                ]
            ]
        ],
        [
            'attribute equality',
            Query.attr('channel').equals( [2,4] ),
            [ [Query.ATTR, 'channel'], [Query.VALUE, [2,4] ], Query.EQUALS]
        ],
        [
            'component filter tree',
            [
                Query.all('/component/username'),
                Query.all('/component/nickname'),
                Query.none('/component/mode/invisible')
            ],
            // Query.all('/component/username').all('/component/nickname').none('/component/mode/invisible'),
            [
                [Query.VALUE, '/component/username'],
                Query.ALL,
                [Query.VALUE, '/component/nickname'],
                Query.ALL,
                [Query.VALUE, '/component/mode/invisible'],
                Query.NONE
            ],
            [
                [Query.ALL, [Query.VALUE, '/component/username'] ],
                [Query.ALL, [Query.VALUE, '/component/nickname'] ],
                [Query.NONE, [Query.VALUE, '/component/mode/invisible'] ] 
            ]
        ],
        [
            'filter with multiple entityset selection',
            [
                Query.all('/component/username'),
                Query.all('/component/nickname'),
                Query.none('/component/mode/invisible')
            ],
            // Query.filter( Query.all('/component/username').all('/component/nickname').none('/component/mode/invisible') ),
            [
                [ Query.VALUE, '/component/username' ], Query.ALL, 
                [ Query.VALUE, '/component/nickname' ], Query.ALL,
                [ Query.VALUE, '/component/mode/invisible' ], Query.NONE
            ],
            [ 
                [ Query.ALL, [Query.VALUE, '/component/username' ]],
                [ Query.ALL, [Query.VALUE, '/component/nickname' ]],
                [ Query.NONE, [Query.VALUE, '/component/mode/invisible' ]]
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
            [
                Query.all('/component/username'), 
                Query.none('/component/mode/invisible')
            ],
            [
                [ Query.VALUE, '/component/username' ],
                Query.ALL,
                [ Query.VALUE, '/component/mode/invisible' ],
                Query.NONE,
            ],
        ],
        [
            '4 component filter',
            [
                Query.all('/component/username'),
                Query.none('/component/mode/invisible'),
                Query.all('/component/ex'),
                Query.none('/component/why') 
            ],
            [
                [ Query.VALUE, '/component/username' ],
                Query.ALL,
                [ Query.VALUE, '/component/mode/invisible' ],
                Query.NONE,
                [ Query.VALUE, '/component/ex' ], 
                Query.ALL,
                [ Query.VALUE, '/component/why' ],
                Query.NONE,
            ],
            [
                [ Query.ALL, [Query.VALUE, '/component/username']  ],
                [ Query.NONE, [Query.VALUE, '/component/mode/invisible']  ],
                [ Query.ALL, [Query.VALUE, '/component/ex']  ],
                [ Query.NONE, [Query.VALUE, '/component/why'] ]
            ]
        ],
        [
            'filter with two complex arguments',
            [
                Query.all('/component/username'),
                Query.none('/component/mode/invisible'),
                Query.all('/component/channel_member', Query.attr('channel').equals(10) )
            ],
            [
                [ Query.VALUE, '/component/username' ],
                Query.ALL,
                [ Query.VALUE, '/component/mode/invisible' ],
                Query.NONE,
                [ Query.VALUE, '/component/channel_member' ],
                [ Query.ATTR, 'channel' ], 
                [ Query.VALUE, 10 ],
                Query.EQUALS,
                Query.ALL_FILTER,
            ],
            [
                [ Query.ALL, [ Query.VALUE, '/component/username' ] ],
                [ Query.NONE, [ Query.VALUE, '/component/mode/invisible' ] ],
                [ Query.ALL_FILTER,
                    [ Query.VALUE, '/component/channel_member' ],
                    [ Query.EQUALS, 
                        [ Query.ATTR, 'channel' ],
                        [ Query.VALUE, 10 ] ]
                ]
         
            ]
        ],
        [
            'aliasing a value',
            [
                Query.none('/component/mode/invisible'),
                Query.aliasAs('present')
            ],
            // Query.filter( Query.none('/component/mode/invisible') ).as('present'),
            [
                [ Query.VALUE, '/component/mode/invisible' ],
                Query.NONE,
                [ Query.VALUE, 'present' ],
                Query.ALIAS,
            ],
            [
                [ Query.NONE, [ Query.VALUE, '/component/mode/invisible' ] ] ,
                [ Query.ALIAS, [ Query.VALUE, 'present' ] ],
            ],
        ],
        [
            'using a stored alias',
            Query.alias('present'),
            [
                [ Query.VALUE, 'present' ],
                Query.ALIAS_GET
            ],
            [
                [ Query.ALIAS_GET, [ Query.VALUE, 'present' ] ]
            ]
        ],
        [
            'aliasing a pluck',
            [
                Query.pluck('/component/channel','name'),
                Query.aliasAs('channel_names')
            ],
            // Query.filter(Query.ROOT).pluck('/component/channel','name').as('channel_names'),
            [
                Query.LEFT_PAREN, 
                [ Query.VALUE, '/component/channel' ], 
                [ Query.VALUE, 'name' ], 
                Query.RIGHT_PAREN, 
                Query.PLUCK, 

                [ Query.VALUE, 'channel_names' ], 
                Query.ALIAS
            ],
            [
                [ Query.PLUCK, 
                    [ Query.VALUE, '/component/channel' ], 
                    [ Query.VALUE, 'name' ] 
                ],
                [ Query.ALIAS, [ Query.VALUE, 'channel_names' ] ]
            ]
        ],
        [
            'without',
            [
                Query.pluck('/component/channel','id'),
                Query.without( [1,2] )
            ],
            // Query.filter(Query.ROOT).pluck('/component/channel', 'id').without( [1,2] ),
            [   
                Query.LEFT_PAREN,
                [ Query.VALUE, '/component/channel' ], 
                [ Query.VALUE, 'id' ], 
                Query.RIGHT_PAREN, 
                Query.PLUCK, 

                [Query.VALUE, [1,2]],
                Query.WITHOUT,
            ],
            [
                [ Query.PLUCK, 
                    [ Query.VALUE, '/component/channel' ], 
                    [ Query.VALUE, 'id' ] 
                ],
                [ Query.WITHOUT, [Query.VALUE, [1,2]] ]
            ]
        ]//*/
    ];

    test('query toArray', t => {

        _.each( cases, function(queryCase){
            let queryArray = Query.toArray( queryCase[1], false );
            if( queryCase[2] ){
                
                t.deepEqual( queryArray, queryCase[2], queryCase[0] ); 
            }
            queryArray = Query.toArray( queryCase[1], true );
            if( queryCase[3] ){
                // let tree = Query.rpnToTree( queryCase[2] ); //= queryCase[1].toArray(true);
                // let tree = query.toArray(true);
                t.deepEqual( queryArray, queryCase[3], 'ast ' + queryCase[0] );
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