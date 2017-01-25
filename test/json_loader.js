import _ from 'underscore';
import test from 'tape';

import {
    Registry,
    entityToString,
    logEvents,
    createLog,
} from './common';

import {JSONLoader} from '../src/util/loader';
import {JSONExporter} from '../src/util/exporter';

const Log = createLog('TestJSONLoader');

test('basic', async t => {
    const registry = new Registry();

    await registry.registerComponent([
        {'uri':'/connection', properties:{addr:{type:'string'}} },
        {'uri':'/ttl', properties:{expires_at:{type:'number'}} },
        {'uri':'/dead'}
    ]);

    try{
        const entitySet = registry.createEntitySet();

        const loader = JSONLoader.create();
        await loader.load( commandsA, entitySet );

        Log.debug('result', entityToString(entitySet));

        t.end();
    }catch(err){
        Log.error(err.stack);
    }
});


test('register components', async t => {
    const registry = Registry.create();

    try {
        const entitySet = registry.createEntitySet();
        logEvents(entitySet);

        const loader = JSONLoader.create();
        await loader.load( [...commandsB,...commandsA], entitySet );

        Log.debug('result', entityToString(entitySet));

        t.end();

    } catch(err) {
        Log.error(err.stack);
    }
});


test('json export', async t => {
    const registry = Registry.create();

    try {
        const entitySet = registry.createEntitySet();
        // logEvents(entitySet);
        const loader = JSONLoader.create();
        await loader.load( [...commandsB,...commandsA], entitySet );

        // Log.debug('result', entityToString(entitySet));
        const exporter = JSONExporter.create({});
        logEvents(exporter,'[JSONExporter]');
        
        // exporter.on('all', (...args) => Log.debug('[JE]', args));
        exporter.attachEntitySet(entitySet,{anonymous:false});

        entitySet.addEntity([
            {'@c':'/connection', addr:'192.168.255.255'},
            {'@c':'/name', name:'bob'},
        ])

        t.end();

    } catch(err) {
        Log.error(err.stack);
    }
});


const commandsA = [
    { '@c':'/connection', 'addr': '192.3.0.1'},
    { '@c':'/ttl', expires_at:-300 },
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.2'},
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.3'},
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.4'},
    { '@c':'/ttl', expires_at:2000, 'comment':'b' },
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.5'},
    { '@cmd':"entity" },
];

const commandsB = [
    { '@cmd':'register', 'uri':'/connection', properties:{addr:{type:'string'}} },
    { '@cmd':'register', 'uri':'/ttl', properties:{expires_at:{type:'number'}} },
    { '@cmd':'register', 'uri':'/dead'},
    { '@cmd':'register', 'uri':'/name', properties:{name:{type:'string'}}},
];
