import test from 'tape';
import Path from 'path';
import Pull from 'pull-stream';
import PullUtf8 from 'pull-utf8-decoder';
import PullFile from 'pull-file';
import parseEJSON from 'odgn-json';
import PullMap from 'pull-stream/throughs/map';

import { Registry, entityToString, logEvents, stringify, createLog } from './common';

import { JSONLoader } from '../src/util/loader';
import { load as loadCommands, sink as loaderSink } from '../src/util/loader_ex';
import { JSONExporter } from '../src/util/exporter';
// import { PullStreamSink } from '../src/entity_set/sink';
import { setupMaster } from 'cluster';

const Log = createLog('TestJSONLoader');

test('basic', async t => {
    try {
        const entitySet = await executeCommands([
            {
                '@cmd': 'register',
                uri: '/component/territory',
                properties: { name: 'string', code: 'string' }
            },
            { '@c': '/component/territory', name: 'europe', code: 'eu' },
            { '@cmd': 'entity' },
            { '@c': '/component/territory', name: 'canada', code: 'ca' }
        ]);

        // Log.debug('result', entityToString(entitySet));
        t.equals(
            entitySet
                .query(Q => Q.all().where(Q.attr('name').equals('europe')))
                .size(),
            1
        );
        t.equals(
            entitySet
                .query(Q => Q.all().where(Q.attr('name').equals('canada')))
                .size(),
            1
        );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('definition of commands', async t => {
    try {
        const entitySet = await executeCommands([
            {
                '@cmd': 'register',
                uri: '/component/territory',
                properties: { name: 'string', code: 'string' }
            },

            {
                '@define': 'territory',
                '@c': '/component/territory',
                status: 'active'
            },
            // { "@cmd":"create-entity" },
            { '@use': 'territory', name: 'united states', code: 'us' }
        ]);

        // Log.debug('result', entityToString(entitySet));
        t.equals(
            entitySet
                .query(Q => Q.all())
                .at(0)
                .Territory.get('code'),
            'us'
        );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('marked entities', async t => {
    try {
        const entitySet = await executeCommands([
            ...registerCommands(),
            { '@c': '/component/poi', name: 'London' },
            { '@cmd': 'entity', '@mark': true },
            // the @ref resolves so that the poi-id attribute is set to the marked poi
            { '@c': '/component/forecast', description:'rain', 'poi-id': '@marked' }
        ]);

        // Log.debug('result', entityToString(entitySet));
        t.equals(
            entitySet
                .query(Q => Q.all())
                .at(1)
                .Forecast.get('poi-id'),
            entitySet.at(0).id
        );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});


test('marked entity component attribute reference', async t => {
    try {
        const entitySet = await executeCommands([
            ...registerCommands(),
            { "@c": "/component/poi", "woe-id":44418, "name":"London", "country":"United Kingdom"},
            { "@cmd":"entity", "@mark":true },
            { "@c":"/component/forecast", "description":"rain", "woe-id":"@marked:/component/poi#woe-id" },
        ]);

        // Log.debug('result', entityToString(entitySet));
        t.equals(
            entitySet
                .query(Q => Q.all())
                .at(1)
                .Forecast.get('woe-id'),
                44418
        );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('primary key on entity entails upsert behaviour again', async t => {
    try {
        const entitySet = await executeCommands([
            ...registerCommands(),
            { "@c": "/component/poi", "woe-id":44418, "name":"London", "country":"United Kingdom"},
            { "@cmd":"entity" },
            { "@c": "/component/poi", "woe-id":44418, "name":"Tokyo", "country":"Japan"},
            { "@cmd":"entity", "@pkey":"/component/poi#woe-id" },
        ]);

        const result = entitySet.query(Q => Q.all());
        
        // Log.debug('result', entityToString(result));

        t.equals( result.size(), 1, 'only one entity inserted');
        t.equals( result.at(0).Poi.get('name'), 'Tokyo' );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});



test('use of conditional blocks', async t => {
    // aka - this is turning into xslt...
    try {
        const entitySet = await executeCommands([
            ...registerCommands(),
            { "@c": "/component/poi", "woe-id":44418, "name":"London", "country":"United Kingdom"},
            { "@cmd":"entity" },
            // note that the mark only gets set if the operation is succesful, which in this case it won't be
            // beecause the pkey is identical to the previous inserted entity
            { "@c": "/component/poi", "woe-id":44418, "name":"London", "country":"United Kingdom"},
            { "@cmd":"entity", "@pkey":"/component/poi#woe-id", "@mark":"inserted" },
            
            { "@if":"marked://inserted" },
            { "@c":"/component/poi", "name":"Paris" },
            { "@cmd":"entity" },
            { "@endif":"inserted" },
        ]);

        const result = entitySet.query(Q => Q.all());
        
        // Log.debug('result', entityToString(result));

        t.equals( result.size(), 1, 'only one entity inserted');
        t.equals( result.at(0).Poi.get('name'), 'London' );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
})

test('creating an entityset', async t => {
    try {
        const uuid = 'C0A9562A-E6C1-40FB-9224-2A2A8A68B912';
        const entitySet = await executeCommands([
            {"@cmd":"create-entityset", uuid },
            // usually, creating another entityset with an identical uuid would throw an error
            {"@cmd":"create-entityset", uuid },
        ]);

        t.equals( entitySet.getRegistry().getEntitySet(uuid).getUUID(), uuid );

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
})


test('streaming through the loader', async t => {
    try {
        
        const registry = Registry.create();
        const entitySet = registry.createEntitySet();
        const filePath = Path.join(
            Path.dirname(__filename),
            './fixtures/chessboard.ldjson'
        );

        // stream items from the ldjson file
        Pull(
            PullFile(filePath),
            PullUtf8(),

            parseEJSON(),

            // PullMap(val => {
            //     Log.debug('[PullMap][<]', stringify(val));
            //     return val;
            // }),

            loaderSink( entitySet, { debug: false }, err => {
                if (err){
                    Log.debug('[loaderSink]', 'error', err);
                    // throw err;
                    return;
                }
                Log.debug('[sink]', entityToString(receivingES));
                t.equals(entitySet.size(), 32);

                t.end();
            })
        );

    } catch (err) {
        Log.error(err.stack);
    }
})


async function executeCommands(cmds, options) {
    const registry = new Registry();
    const entitySet = registry.createEntitySet();

    await loadCommands(cmds, entitySet, options);

    return entitySet;
}


function registerCommands(){
    return [
        {
            '@cmd': 'register',
            uri: '/component/territory',
            properties: { name: 'string', code: 'string' }
        },
        {
            '@cmd': 'register',
            uri: '/component/poi',
            properties: { name: 'string' }
        },
        {
            '@cmd': 'register',
            uri: '/component/forecast',
            properties: { description: 'string', 'poi-id': 'integer' }
        }
    ]
}