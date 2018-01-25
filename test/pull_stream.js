import _ from 'underscore';
import test from 'tape';

import Pull from 'pull-stream';
import Pushable from 'pull-pushable';
import PullMap from 'pull-stream/throughs/map';
import PullFilter from 'pull-stream/throughs/filter';

import Entity from '../src/entity';
import { Registry, entityToString, logEvents, createLog, stringify } from './common';
import AsyncEntitySet from '../src/entity_set/async';

import readProperty from '../src/util/read_property';
import { isPromise } from '../src/util/is';
import { JSONLoader } from '../src/util/loader';
import { JSONExporter } from '../src/util/exporter';

import QueryFilter from '../src/query/through';

// import Loader from 'elsinore-io/lib/loader';
const Log = createLog('TestPullStream');

test('source close after existing', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });

        Pull(
            entitySet.source({ closeAfterExisting: true }),
            PullMap(val => Array.isArray(val) ? val[0] : val), // because normally the source output will be a series of tuples [value,options]
            Pull.collect((err, components) => {
                // the stream will send an eoe command as well as components
                components = components.filter(c => c['@s']);
                t.equals(components.length, 7);
                t.end();
            })
        );
    } catch (err) {
        Log.error(err.stack);
    }
});

test('source continues to emit events', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });
        const es2 = registry.createEntitySet();

        t.plan(2);

        Pull(
            es2.source(),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            Pull.take(2),
            Pull.collect((err, data) => {
                t.equals( data.length, 2);
            })
        );

        Pull(
            entitySet.source(),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            Pull.take(9),
            Pull.collect((err, data) => {
                t.equals(data.length, 9);
                t.end();
            })
        );

        es2.addEntity([{ '@c': '/name', name: 'susan' }, { '@c': '/ttl', expires_at: 2019 }]);

        // add a new entity with two components
        entitySet.addEntity([{ '@c': '/name', name: 'mike' }, { '@c': '/ttl', expires_at: 2018 }]);
    } catch (err) {
        Log.error(err.stack);
    }
});

test('source doesnt send existing', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });

        Pull(
            entitySet.source({ sendExisting: false }),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            Pull.take(2), // neccesary to add this, since the source is un-ending
            Pull.collect((err, components) => {
                // Log.debug('[collect]', components, entityToString(components));
                t.equals(components.length, 2);
                t.end();
            })
        );

        entitySet.addEntity([{ '@c': '/name', name: 'alice' }, { '@c': '/ttl', expires_at: 2016 }]);
    } catch (err) {
        Log.error(err.stack);
    }
});

test('source emits remove events', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });

        Pull(
            entitySet.source(),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            // PullMap(val => {
            //     Log.debug('[PullMap][<]', stringify(val));
            //     return val;
            // }),
            Pull.take(10),
            Pull.collect((err, evts) => {
                evts = evts.filter(e => e['@cmd'] == 'rmc' || e['@cmd'] == 'rme');
                t.deepEqual(evts, [{ '@cmd': 'rmc', id: [3, 4] }, { '@cmd': 'rme', eid: [2] }]);
                t.end();
            })
        );

        entitySet.removeEntity(entitySet.at(0));
    } catch (err) {
        Log.error(err.stack);
    }
});

test('source emits components with resolved component uris', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });

        Pull(
            entitySet.source({ useDefUris: true, anonymous: true, closeAfterExisting: true }),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            // PullMap(val => {
            //     Log.debug('[PullMap][<]', stringify(val));
            //     return val;
            // }),
            // Pull.take(7),
            Pull.collect((err, evts) => {
                t.deepEqual(evts, [
                    { '@c': '/connection', addr: '192.3.0.1' },
                    { '@c': '/ttl', expires_at: -300 },
                    { '@c': '/connection', addr: '192.3.0.2' },
                    { '@c': '/connection', addr: '192.3.0.3' },
                    { '@c': '/connection', addr: '192.3.0.4' },
                    { '@c': '/ttl', comment: 'b', expires_at: 2000 },
                    { '@c': '/connection', addr: '192.3.0.5' },
                    { '@cmd': 'eoe', cc: 7, ec: 5 }
                ]);
                t.end();
            })
        );
    } catch (err) {
        Log.error(err.stack);
    }
});

test('source emits entities', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });

        Pull(
            entitySet.source({ emitEntities: true, closeAfterExisting: true }),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            PullFilter(val => {
                return Entity.isEntity(val);
            }),
            Pull.collect((err, entities) => {
                // Log.debug('[collect]', entityToString(entities));
                t.equals(entities.length, 5);
                t.end();
            })
        );
    } catch (err) {
        Log.error(err.stack);
    }
});

test('emits entities but also component updates', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });

        Pull(
            entitySet.source({ emitEntities: true, closeAfterExisting: false }),
            // PullMap(val => Array.isArray(val) ? val[0] : val),
            PullMap(val => Array.isArray(val) ? val[0] : val),
            // PullMap(val => {
            //     Log.debug('[PullMap][<]', stringify(val));
            //     return val;
            // }),
            PullFilter(val => {
                return Entity.isEntity(val);
            }),
            Pull.collect((err, entities) => {
                // Log.debug('[collect]', entityToString(entities));
                t.equals(entities.length, 5);
                t.end();
            })
        );

        // Log.debug( entityToString(entitySet) );

        // adding this entity should only trigger an entity:add evt, not a component:add evt
        entitySet.addComponent([
            {'@c':'/name', name:'circle3'}
        ]);

        let entity = entitySet.at(0, true);
        entity.removeComponent('/ttl');
        entity.addComponent({'@c':'/name', name:'box1'});

        // Log.debug('>--');

        entitySet.addEntity(entity);

        // Log.debug( entityToString(entity) );
        // Log.debug( entityToString(entitySet) );

        t.end()

    } catch (err) {
        Log.error(err.stack);
    }
});

test('sink', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });
        const receivingES = registry.createEntitySet();

        // receivingES.on('all', (name,...args) => Log.debug('[receivingES]', name))

        Pull(
            Pull.values([
                { '@e': 2, '@i': 5, '@s': 1, addr: '192.3.0.1' },
                { '@e': 2, '@i': 6, '@s': 2, expires_at: -300 },
                { '@e': 7, '@i': 10, '@s': 1, addr: '192.3.0.2' },
                { '@e': 11, '@i': 14, '@s': 1, addr: '192.3.0.3' },
                { '@e': 15, '@i': 18, '@s': 1, addr: '192.3.0.4' },
                { '@cmd': 'rme', eid: 11 }
            ]),
            PullMap( v => [v,{}]), // because normally the stream provides a tuple of [value,options]
            receivingES.sink({}, err => {
                // Log.debug('[sink]', entityToString(receivingES));
                t.equals(receivingES.size(), 3);
                t.end();
            })
        );
    } catch (err) {
        Log.error(err.stack);
    }
});

test('query through', async t => {
    try {
        const { registry, entitySet } = await initialise({ loadEntities: true });
        const receivingES = registry.createEntitySet();

        Pull(
            entitySet.source({ emitEntities: true, closeAfterExisting: true }),
            // the filter will only allow entities that have the /ttl component through
            QueryFilter(Q => Q.all('/ttl')),
            // PullMap(val => Array.isArray(val) ? val[0] : val),
            receivingES.sink({ debug: false }, err => {
                // Log.debug('[sink]', entityToString(receivingES));
                t.equals(receivingES.size(), 2);
                t.end();
            })
        );
    } catch (err) {
        Log.error(err.stack);
    }
});

// test('source', async t => {
//     try {
//         const { registry, entitySet } = await initialise({ loadEntities: true });
//         // Loader.create(registry,entitySet);
//         // Log.debug('[source]', entityToString(entitySet));
//         // let nog = entitySet.source;
//         // nog( null, (...args) => {
//         //     Log.debug('hmm', args)
//         // })
//         // Log.debug('aa', nog)
//         Pull(
//             entitySet.source({ closeOnEnd: true }),
//             // Pull.take(1),
//             // PullMap(val => {
//             //     // console.log('[PullMap][<]', stringify(val));
//             //     return val;
//             // }),
//             Pull.collect((err, array) => {
//                 // console.log('err', err );
//                 // console.log('array', stringify(array) );
//                 console.log(entityToString(array));
//                 // array.forEach( e => Log.debug('[collect]', entityToString(e)) );
//             }),
//         );
//         t.end();
//     } catch (err) {
//         Log.error(err.stack);
//     }
// });
// test('entity sink', async t => {
//     try {
//         const { registry, entitySet } = await initialise({ loadEntities: false, instanceClass: AsyncEntitySet });
//         const values = Pull.values([
//             { '@c': '/position', x: 2, y: -2 },
//             [ { '@c': '/name', name: 'outlier' }, { '@c': '/position', x: 100, y: 0 } ],
//             [ { '@c': '/name', name: 'todd' }, { '@c': '/position', x: 5, y: 6 } ],
//             // {'msg':'i dont belong here'},
//             // {'@c':'/position', x:2, y:-2},
//             { '@c': '/name', name: 'peter' },
//         ]);
//         const sink = entitySet.createPullStreamSink({}, err => {
//             Log.debug(`[completeCb]`, err);
//             Log.debug(`[completeCb]`, entityToString(entitySet));
//         });
//         Pull(values, throughLoader(registry), sink);
//         // sink( throughLoader(registry)(values) );
//         t.end();
//     } catch (err) {
//         Log.error(err.stack);
//     }
// });
// function throughLoader(registry) {
//     // a sink function: accept a source
//     return function(read) {
//         // but return another source!
//         return function(abort, outSourceCb) {
//             // read from the in-stream
//             read(abort, function(err, data) {
//                 // if the stream has ended, pass that on.
//                 if (err) {
//                     return outSourceCb(err);
//                 }

//                 data = registry.createEntity(data);

//                 outSourceCb(null, data);
//             });
//         };
//     };
// }

// function exportEntitySetComponents(entitySet,options={}){
//     const useDefUris = readProperty(options,'useDefUris',false);
//     const anonymous = readProperty(options,'anonymous',false);
//     let currentEntityId = -1;
//     const cdefMap = useDefUris ? entitySet.getSchemaRegistry().getComponentDefUris() : null;
//     const stream = entitySet.createPullStreamSource();
// }
async function initialise(options = {}) {
    const { loadEntities } = options;
    const registry = Registry.create();
    let entitySet = registry.createEntitySet(options);
    const loader = JSONLoader.create();

    if (isPromise(entitySet)) {
        entitySet = await Promise.resolve(entitySet);
    }

    // Log.debug(`[initialise] created es`, entityToString(entitySet));
    await loader.load(commandsB, entitySet);

    if (loadEntities) {
        await loader.load(commandsA, entitySet);
    }

    return { registry, entitySet };
}

const commandsA = [
    { '@c': '/connection', addr: '192.3.0.1' },
    { '@c': '/ttl', expires_at: -300 },
    { '@cmd': 'entity' },
    { '@c': '/connection', addr: '192.3.0.2' },
    { '@cmd': 'entity' },
    { '@c': '/connection', addr: '192.3.0.3' },
    { '@cmd': 'entity' },
    { '@c': '/connection', addr: '192.3.0.4' },
    { '@c': '/ttl', expires_at: 2000, comment: 'b' },
    { '@cmd': 'entity' },
    { '@c': '/connection', addr: '192.3.0.5' },
    { '@cmd': 'entity' }
];

const commandsB = [
    { '@cmd': 'register', uri: '/connection', properties: { addr: { type: 'string' } } },
    { '@cmd': 'register', uri: '/ttl', properties: { expires_at: { type: 'number' } } },
    { '@cmd': 'register', uri: '/dead' },
    {
        '@cmd': 'register',
        uri: '/position',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
    },
    { '@cmd': 'register', uri: '/name', properties: { name: { type: 'string' } } }
];
