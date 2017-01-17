import _ from 'underscore';
import test from 'tape';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    entityToString,
    logEvents,
    createLog,
} from './common';

import {JSONLoader} from '../src/util/loader';

const Log = createLog('TestJSONLoader');

test('basic', async t => {
    const registry = await setup();

    try{

        const entitySet = registry.createEntitySet();
        logEvents(entitySet);

        const loader = JSONLoader.create();
        
        await loader.load( commandsA, entitySet );

        Log.debug('result', entityToString(entitySet));

        t.end();
    }catch(err){
        Log.error(err.stack);
    }
});


test.only('register components', async t => {
    const registry = Registry.create();

    try {
        const entitySet = registry.createEntitySet();
        logEvents(entitySet);

        const loader = JSONLoader.create();
        await loader.load( commandsB, entitySet );
        await loader.load( commandsA, entitySet );

        Log.debug('result', entityToString(entitySet));

        t.end();

    } catch(err) {
        Log.error(err.stack);
    }
});





const commandsA = [
    { '@c':'/connection', 'addr': '192.3.0.1'},
    { '@c':'/ttl', expires_at:Date.now()-300 },
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.2'},
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.3'},
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.4'},
    { '@c':'/ttl', expires_at:Date.now()+2000, 'comment':'b' },
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.5'},
    { '@cmd':"entity" },
];

const commandsB = [
    { '@cmd':'register', 'uri':'/connection', properties:{addr:{type:'string'}} },
    { '@cmd':'register', 'uri':'/ttl', properties:{expires_at:{type:'number'}} },
    { '@cmd':'register', 'uri':'/dead'}
];


async function setup(){
    const registry = new Registry();

    await registry.registerComponent([
        {'uri':'/connection', properties:{addr:{type:'string'}} },
        {'uri':'/ttl', properties:{expires_at:{type:'number'}} },
        {'uri':'/dead'}
    ]);

    return registry;
    
}