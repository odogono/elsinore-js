import _ from 'underscore';
import test from 'tape';

import {
    Component, Entity, EntitySet,
    Query,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';


// test('parsing', t => {
//     let query = Query.pluck( '/component/channel_member', 'client' );
//     let stack = [
//             Query.LEFT_PAREN, 
//             [ Query.VALUE, '/component/channel_member' ], 
//             [ Query.VALUE, 'client' ], 
//             Query.RIGHT_PAREN, 
//             Query.PLUCK
//         ];

//     let ast = [
//             [ Query.PLUCK,
//                 [ Query.VALUE, '/component/channel_member' ], 
//                 [ Query.VALUE, 'client' ]
//             ]
//         ];

//     t.deepEqual( Query.toArray( query, false ), stack );        
//     t.deepEqual( Query.toArray( query, true ), ast );

//     t.end();
// });

test('pluck extracts a list of property values from the given component', t => {
    initialiseEntitySet('entity_set.entities').then( ([registry,entitySet]) => {
        t.deepEqual(
            entitySet.pluck( '/component/realname', 'name' ),
            [ 'John Smith', 'susan mayall', 'Terry June' ], 'three names should be returned' );
        // printE( entitySet.query( Query.all('/component/realname') ) );
        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


function initialiseEntitySet( entityDataName = 'query.entities' ){
    return initialiseRegistry(false).then( registry => {
        let entitySet = loadEntities( registry, entityDataName );
        return [registry,entitySet];
    });
}
