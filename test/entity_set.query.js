import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Component,
    Entity,
    EntityFilter,
    EntitySet,
    Registry,
    Query,
    ComponentRegistry,
    initialiseRegistry,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    createLog,
    logEvents,
    entityToString
} from './common';

const Log = createLog('TestEntitySetQuery');

test('entityset filter ALL', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        let result = entitySet.query(Q => Q.all('/component/mode/invite_only'));

        t.ok(EntitySet.isEntitySet(result), 'the result should be an entityset');
        t.equals(result.size(), 1, 'there should be a single entity');

        t.end();
    });
});

test('entityset filter ALL throws error with unknown component', async t => {
    const [registry, entitySet] = await initialiseEntitySet();

    t.throws(
        () => entitySet.query(Q => Q.all('/component/missing')),
        /could not find componentDef '\/component\/missing'/
    );

    t.end();
});

test('entityset filter by attribute', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        // select entities which have the component /channel_member and
        //  have the client attribute
        // aka Query.all( '/component/channel_member', Query.attr('client').equals(5) );
        const result = entitySet.query(Q => Q.all('/component/channel_member', Q.attr('client').equals(5)));

        t.equals(result.size(), 2);
    } catch (err) {
        Log.error(err.message, err.stack);
    }
    t.end();
});

test('include will filter an entity', t => {
    initialiseEntitySet()
        .then(([registry, entitySet]) => {
            const query = new Query(Q => Q.include('/component/nickname'));
            const entity = entitySet.getEntity(5);

            const result = query.execute(entity, { debug: false });
            t.equals(result.getComponentCount(), 1, 'all but one component passes');

            t.end();
        })
        .catch(err => log.error('test error: %s', err.stack));
});

test('entityset filter by attribute being within a value array', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        // select entities which have the component /channel_member and
        //  have the client attribute
        let result = Query.exec(
            Q => Q.all('/component/channel_member').where(Q.attr('channel').equals([2, 4])),
            entitySet
        );
        // let result = Query.execute( entitySet,
        //     [ Query.ALL_FILTER,
        //         [Query.VALUE, '/component/channel_member'],
        //         [ Query.EQUALS,
        //             [ Query.ATTR, 'channel' ],
        //             [ Query.VALUE, [2, 4] ] ] ] );

        t.equals(result.size(), 4);
        t.end();
    });
});

test('where filter by string', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        // const def = registry.getComponentDef(11);
        // Log.debug('def 11 is', def.getUri());
        const result = entitySet.query(Q => Q.all().where(Q.attr('username').equals('aveenendaal')));
        // const result = entitySet.query( Q => Q.all('/component/channel_member').where( Q.attr('username').equals('aveenendaal')) );

        // Log.debug('result was', entityToString(result));
        t.equals(result.size(), 3);

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('multiple component filters', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        // select entities which have /channel_member but not /mode/invisible
        let result = entitySet.query(Q => [Q.all('/component/channel_member'), Q.none('/component/mode/invisible')]);
        // let result = Query.execute( entitySet,
        //     [
        //         [Query.ALL, [Query.VALUE, '/component/channel_member'] ],
        //         [Query.NONE, [Query.VALUE, '/component/mode/invisible'] ]
        //     ]
        //     ,{debug:false});

        // printE( result );
        t.equals(result.size(), 5);
        t.end();
    });
});

test('PLUCK op', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        const result = entitySet.query(Q => Q.pluck('/component/topic', 'topic'));
        // let result = Query.execute( entitySet,
        //     [ Query.PLUCK,
        //         [ Query.VALUE, '/component/topic' ],
        //         [ Query.VALUE, 'topic' ]
        //     ]
        // ,{debug:false});

        t.deepEqual(result, ['Entity Component Systems', 'Javascript', 'Welcome to Politics']);

        t.end();
    });
});

test('plucking entity ids from the given entityset', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        const result = entitySet.query(Q => Q.pluck(null, '@e', { unique: true }));

        t.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);

        t.end();
    });
});

test('resetting the context entitySet', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        let result = entitySet.query(
            Q => [
                Q.any(['/component/username', '/component/channel']),
                Q.root(),
                Q.pluck(null, '@e', { unique: true })
            ],
            { debug: false }
        );

        t.equal(result.length, 18);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

// test.skip('stuff', t => {
//     initialiseEntitySet().then( ([registry,entitySet]) => {

//         let result = Query.exec( [
//             // [ Query.ANY, [ Query.VALUE, ['/component/username','/component/channel'] ]],
//             // [ Query.VALUE, Query.ROOT ],
//             // [ Query.PLUCK, null, 'eid', {unique:true} ]
//             [Query.VALUE, [ 1,2,5 ] ],
//             [Query.ALIAS, [Query.VALUE, 'entityIds'] ],

//             [Query.VALUE, Query.ROOT],
//             [ Query.SELECT_BY_ID, [Query.ALIAS_GET, [Query.VALUE,'entityIds']] ]

//             ], entitySet, {debug:false});

//         t.equal( result.length, 18 );
//         t.end();
//     });
// });

test('sub-queries', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        // this query selects the other entities which are members of the same channel
        // as entity id 5
        const clientId = 5;

        const result = entitySet.query(Q => [
            // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            Q.all('/component/channel_member').where(Q.attr('client').equals(clientId)),
            Q.pluck('/component/channel_member', 'channel'), // get all the values for 'channel'
            Q.aliasAs('channelIds'), // save the pluck result (array) in the context for later

            // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            Q.root(), // this resets the context back to the original entitySet
            Q.all('/component/channel_member').where(Q.attr('channel').equals(Q.alias('channelIds'))),

            // pluck returns an array of the specified attribute from the components
            Q.pluck('/component/channel_member', 'client', { unique: true }),
            Q.without(clientId), // remove the clientId from the result of the pluck

            // 3. using the channel_member client ids, select an entityset of client entities by entity ids
            // creates a new ES from selected ids - note that the function uses the result of the last
            // query option
            Q.selectById()
        ]);

        // the result should have 3 entities - channel_member, channel and client
        t.equal(result.size(), 4);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('removing entities from an entityset', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        const initialSize = entitySet.size();

        entitySet.removeByQuery(Q => Q.all('/component/channel_member'));

        // let removed = Query.exec( Q => Q.all('/component/channel_member'), entitySet, {registry} );

        // Log.debug( removed.map( e => e.id) );

        // entitySet.removeEntity( removed.map( e => e.id) );

        // Log.debug( entityToString(entitySet) );

        t.ok(entitySet.query(Q => Q.all('/component/channel_member')).size() === 0, 'no channel members remaining');

        t.ok(initialSize !== entitySet.size(), 'entities should have been removed');
        
        t.end();

    } catch (err) {
        Log.error(err.stack);
    }
});

async function initialiseEntitySet(entityDataName = 'query.entities') {
    const registry = await initialiseRegistry(false);
    const entitySet = loadEntities(registry, entityDataName);
    return [registry, entitySet];
}
