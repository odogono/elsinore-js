import _ from 'underscore';
import test from 'tape';

// import {EQUALS, VALUE} from '../src/query';
import * as Q from '../src/query';
import '../src/query/alias';

import {
    Entity,
    EntitySet,
    Query,
    initialiseRegistry,
    loadEntities,
    logEvents,
    createLog,
    entityToString
} from './common';

import {
    EQUALS, VALUE
} from '../src/query/constants';

const Log = createLog('TestQuery');

test('EQUALS op', t => {
    // console.log('uhhh EQUALS', EQUALS);
    const q = new Query([EQUALS, 8, 8]);
    t.equal(q.execute(), true);

    const q2 = new Query([EQUALS, 8, [VALUE, [1, 3, 5, 8]]]);
    t.equal(q.execute(), true);

    // t.deepEqual(
    //     new Query()
    // )

    // t.deepEqual(
    //     Query.execute( null, [ Query.EQUALS, 8, 8 ] ), true );
    // t.deepEqual(
    //     Query.execute( null, [ Query.EQUALS, 8, [ Query.VALUE, [1,3,5,8] ] ] ), true );
    t.end();
});

test('Logic op', t => {
    let commands = [
        // [ Query.AND, [ Query.VALUE, true ], [ Query.VALUE, true ] ],
        Q => Q.value(true).and(Q.value(true)),
        // [ Query.OR, [ Query.VALUE, false ], [ Query.VALUE, true ] ],
        Q => Q.value(false).or(Q.value(true))
    ];

    _.each(commands, command => {
        const query = new Query(command);
        t.deepEqual(query.execute(), true);
    });

    t.end();
});

test('Accepting an entity', async t => {
    try {
        const registry = await initialiseRegistry();

        const entity = registry.createEntity([
            { '@c': '/component/channel', name: 'test' },
            { '@c': '/component/topic', topic: 'Javascript' }
        ]);

        // Log.debug('entity', entity);

        const query = new Query(Q => Q.all('/component/channel'));
        const result = query.execute(entity, { debug: false });

        // console.log('array', query.toJSON());
        // console.log('/component/name iid', registry.getIId(['/component/channel','/component/topic']) );
        // result = Query.all( '/component/channel' ).execute( entity, {debug:false} );

        t.ok(Entity.isEntity(result), 'query should return the entity');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('Rejecting an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entity = registry.createEntity([
            { '@c': '/component/channel', name: 'test' },
            { '@c': '/component/topic', topic: 'Javascript' }
        ]);
        const result = Query.exec(Q => Q.all('/component/name'), entity, {
            debug: false
        });

        t.equal(result, null, 'entity doesnt pass the filter');
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('compiling a basic two stage entity filter', async t => {
    try {
        const registry = await initialiseRegistry();
        // let query;// = Query.all('/component/channel').all('/component/topic');
        // let compiled;

        const query = new Query([Q => Q.all('/component/channel'), Q => Q.none('/component/topic')]);

        // query = Query.create( registry,[
        //     Query.all('/component/channel'),
        //     Query.none('/component/topic')
        // ]);

        // printIns( query, 6 );

        t.equals(query.commands.length, 2);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('compiling an entity filter', async t => {
    try {
        const registry = await initialiseRegistry();
        const entity = registry.createEntity([
            { '@c': '/component/channel', name: 'test' },
            { '@c': '/component/topic', topic: 'Javascript' }
        ]);

        let result = Query.exec(Q => Q.all('/component/topic', '/component/channel'), entity);

        // let query = Query.all('/component/topic','/component/channel');
        // let compiled = filter.compile( registry );

        // printIns( query );

        // t.ok( Query.isQuery(query) );
        // t.ok( !query.isCompiled );

        // printIns( compiled, 6 );
        // log.debug('filter hash ' + filter.hash() );
        // log.debug('hashed ' + compiled.hash() );

        // let result = query.execute( entity );

        // printIns( query );

        t.ok(Entity.isEntity(result));
        // t.ok( Entity.isEntity( filter.execute(entity) ));

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('a single filter query on an entity', async t => {
    try {
        const registry = await initialiseRegistry();
        const entity = registry.createEntity([
            { '@c': '/component/channel', name: 'test' },
            { '@c': '/component/topic', topic: 'Javascript' }
        ]);

        const query = new Query(Q => Q.all('/component/channel'));
        const result = query.execute(entity);

        // let query = Query.all('/component/channel');
        // t.ok( !query.isCompiled );

        // query = Query.create( registry, query );
        // t.ok( query.isCompiled );

        // let result = query.execute( entity );
        t.ok(Entity.isEntity(result));

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

/*
[ 
    [ 16, '/component/mode/limit' ], 
    [ 30, EntityFilter { filters: [Object] }, [ '>', [Object] ] ] 
]

*/
test('accepting an entity based on its attributes', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        const query = new Query(Q => Q.all('/component/mode/limit', Q.attr('limit').greaterThan(9)));

        // Log.debug('/component/mode/limit is', registry.getIId('/component/mode/limit') )

        // const result = query.execute(
        //     registry.createEntity([{ '@c':'/component/mode/limit', limit:10}] ),
        //     {debug:false} );

        // Log.debug('result was', entityToString(result) );

        t.ok(
            Entity.isEntity(
                query.execute(registry.createEntity([{ '@c': '/component/mode/limit', limit: 10 }]), { debug: false })
            ),
            'the query returns the entity with a limit > 10'
        );

        t.notOk(
            query.execute(registry.createEntity([{ '@c': '/component/mode/limit', limit: 9 }])),
            'query rejects entity with a limit > 10'
        );

        t.notOk(
            query.execute(registry.createEntity([{ '@c': '/component/mode/limit' }])),
            'query rejects entity with no limit'
        );

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('query eveything', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        // Query.all with no arguments returns everything
        // - same as calling Query.root()
        const result = entitySet.query(Q => Q.all());
        t.equals(entitySet.size(), 18);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('a single filter query on an entityset', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        const query = new Query(Q => Q.all('/component/channel'));
        
        const result = query.execute(entitySet);

        // Log.debug( entityToString(result) );

        t.ok(EntitySet.isEntitySet(result), 'the returned value is an entityset');
        
        t.equals(result.size(), 4, 'the entityset contains 4 entities each with a /component/channel');
        
        t.end();

    } catch (err) {
        Log.error(err.stack);
    }
});

test('filter query on an entityset', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        const query = new Query(Q => [
            Q.all('/component/channel_member'),
            Q.none('/component/mode/invisible'),
            Q.all('/component/channel_member', Q.attr('channel').equals(2))
        ]);

        const result = query.execute(entitySet);

        t.ok(EntitySet.isEntitySet(result));
        t.equals(result.size(), 2);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('ALIAS op', t => {
    const query = new Query(Q => [
        Q.value([9, 10, 11]),
        Q.aliasAs('channelIds'),
        Q.value([9, 10, 11]).equals(Q.alias('channelIds'))
    ]);

    t.deepEqual(query.execute(), true);

    t.end();
});

test('passing an alias into a query', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        // select all entities which have the /channel_member.channel set to 2
        const query = new Query(Q =>
            Q.all('/component/channel_member', Q.attr('channel').equals(Q.alias('channelIds')))
        );

        // execute the query by passing a value for the channelIds alias
        const result = query.execute(entitySet, {
            alias: { channelIds: 2 }
        });

        // Log.debug( entityToString(result) );

        t.deepEqual(
            // pluck the entity id from each of the /channel_member components
            result.pluck('/component/channel_member', '@e'),
            [15, 16, 17]
        );
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('multiple commands with a single result', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        const clientId = 5;

        const query = new Query(Q => [
            // 1. select channel ids which client `clientId` belongs to and store as alias `channelIds`
            Q.all('/component/channel_member').where(Q.attr('client').equals(clientId)),
            Q.pluck('/component/channel_member', 'channel'), // get all the values for 'channel'
            Q.aliasAs('channelIds'), // save the pluck result (array of channelIds) in the context for later
            // 2. select channel members which belong to the channel ids stored in the alias `channelIds`
            Q.root(), // this resets the context back to the original entitySet
            // select all channel members which have a channel value equal to one of the channelIds
            Q.all('/component/channel_member').where(Q.attr('channel').equals(Q.alias('channelIds'))),
            Q.pluck('/component/channel_member', 'client', {
                unique: true
            }),
            Q.without(clientId), // remove the clientId from the result of the pluck
            Q.aliasAs('clientIds'),
            // 3. using the channel_member client ids, select an entityset of client entities by entity ids
            Q.root(),
            Q.selectById(Q.alias('clientIds')) // creates a new ES from selected ids
        ]);

        const result = query.execute(entitySet);

        t.ok(EntitySet.isEntitySet(result));
        // printE( result );
        t.equals(result.size(), 4);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('hashing queries', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        const queryA = new Query(Q => Q.all('/component/username'));
        const queryB = new Query(Q => Q.all('/component/username'));
        const queryC = new Query(Q => Q.any('/component/username'));

        // console.log( queryA.toJSON() );

        t.equals(queryA.hash(), queryB.hash());
        t.notEqual(queryA.hash(), queryC.hash());
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('query serialisation', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        const query = new Query(Q => [
            Q.all('/component/channel_member'),
            Q.none('/component/mode/invisible'),
            Q.all('/component/channel_member', Q.attr('channel').equals(2))
        ]);

        let json = query.toJSON();

        t.deepEqual(json, [
            ['FA', ['VL', '/component/channel_member']],
            ['FN', ['VL', '/component/mode/invisible']],
            ['FA', ['VL', '/component/channel_member'], ['==', ['AT', 'channel'], ['VL', 2]]]
        ]);

        const reQuery = new Query(json);

        const resultA = query.execute(entitySet, { debug: false });
        const resultB = reQuery.execute(entitySet);

        t.equals(resultA.size(), resultB.size());
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

function initialiseEntitySet(entityDataName = 'query.entities') {
    return initialiseRegistry(false).then(registry => {
        let entitySet = loadEntities(registry, entityDataName);
        return [registry, entitySet];
    });
}
