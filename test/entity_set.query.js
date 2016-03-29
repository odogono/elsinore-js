import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query, SchemaRegistry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';



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
    .catch( err => log.error('test error: %s', err.stack) )
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
        
        // this query selects the other entities which are members of the same channel
        // as entity id 5
        let clientId = 5;

        let result = entitySet.query([
            // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            Query.all('/component/channel_member')
                .where(Query.attr('client').equals(clientId)),
            Query.pluck('/component/channel_member', 'channel'), // get all the values for 'channel'
            Query.aliasAs( 'channelIds' ), // save the pluck result (array) in the context for later

            // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            Query.root(), // this resets the context back to the original entitySet
            Query.all('/component/channel_member')
                .where( Query.attr('channel').equals( Query.alias('channelIds')) ),

            // pluck returns an array of the specified attribute from the components
            Query.pluck('/component/channel_member', 'client', {unique:true}),
            Query.without( clientId ), // remove the clientId from the result of the pluck

            // 3. using the channel_member client ids, select an entityset of client entities by entity ids
            // creates a new ES from selected ids - note that the function uses the result of the last
            // query option
            Query.selectById()
            ]);

        // the result should have 3 entities - channel_member, channel and client
        t.equal( result.size(), 4 );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});


test('removing entities from an entityset', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const initialSize = entitySet.size();

        entitySet.removeByQuery( Query.all('/component/channel_member') );

        t.ok( entitySet.query(Query.all('/component/channel_member')).size() === 0, 'no channel members remaining');
        t.ok( initialSize !== entitySet.size(), 'entities should have been removed');
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
})

function initialiseEntitySet( entityDataName = 'query.entities' ){
    return initialiseRegistry(false).then( registry => {
        let entitySet = loadEntities( registry, entityDataName );
        return [registry,entitySet];
    });
}
