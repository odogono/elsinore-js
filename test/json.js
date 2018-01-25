import _ from 'underscore';
import test from 'tape';

import { Registry } from './common';

// import ComponentRegistry from '../src/schema/index';

const COMPONENT_DEFINITIONS = [
    { uri: '/component/position', properties: { x: 0, y: 0, z: 0, rotation: 0 }, name: 'Position', hash: 'bd12d7de' },
    { uri: '/component/radius', properties: { radius: 0 }, name: 'Radius' },
    { uri: '/component/status', properties: { status: 'active' }, name: 'Status' },
    { uri: '/component/name', properties: { name: '' }, name: 'Name', hash: 'c6c1bcdf' },
    { uri: '/component/geo_location', properties: { lat: 0, lng: 0 }, name: 'Geolocation' }
];

test('component', t => {
    createRegistry().then(registry => {
        let c = registry.createComponent({ '@c': '/component/position' });
        t.deepEqual(c.toJSON(), { '@s': 1, rotation: 0, x: 0, y: 0, z: 0 });
        t.end();
    });
});

test('entity with components', t => {
    createRegistry()
        .then(registry => {
            let components = registry.createComponent([
                { '@c': '/component/name', name: 'squirtle' },
                { '@c': '/component/status' },
                { '@c': '/component/radius', radius: 1.2 }
            ]);
            let e = registry.createEntity(components);
            t.deepEqual(e.toJSON(), [
                { radius: 1.2, '@s': 2, '@e': 1 },
                { status: 'active', '@s': 3, '@e': 1 },
                { name: 'squirtle', '@s': 4, '@e': 1 }
            ]);
        })
        .then(() => t.end());
});


test('entityset with entities', async t => {
    try {
        const registry = await createRegistry();

        let es = registry.createEntitySet();

        es.addComponent([
            registry.createComponent('/component/name', { name: 'charmander' }),
            registry.createComponent('/component/geo_location', { lat: 51.2, lng: -3.65 })
        ]);

        es.addComponent([
            registry.createComponent('/component/name', { name: 'kakuna' }),
            registry.createComponent('/component/status')
        ]);

        // console.log( es.toJSON() );

        t.deepEqual(_.omit(es.toJSON({ mapCdefUri: true }), 'uuid'), {
            '@e': [
                { '@c': '/component/name', '@e': 2, name: 'charmander' },
                { '@c': '/component/geo_location', '@e': 2, lat: 51.2, lng: -3.65 },
                { '@c': '/component/status', '@e': 5, status: 'active' },
                { '@c': '/component/name', '@e': 5, name: 'kakuna' }
            ]
        });

        // '@e': [
        // { '@c': '/component/name', '@i': 4, '@e': 2, name: 'charmander' },
        // { '@c': '/component/geo_location', '@i': 5, '@e': 2, lat: 51.2, lng: -3.65 },
        // { '@c': '/component/status', '@i': 6, '@e': 5, status: 'active' },
        // { '@c': '/component/name', '@i': 7, '@e': 5, name: 'kakuna' }
        // ] });

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});


test('create entityset from json', t => {
    createRegistry()
        .then(registry => {
            let options = {
                uuid: '32949155-5879-BDA7-B4F0-E206058DC168',
                '@e': [
                    { '@c': '/component/name', '@e': 2, name: 'charmander' },
                    { '@c': '/component/geo_location', '@e': 2, lat: 51.2, lng: -3.65 },
                    { '@c': '/component/status', '@e': 5, status: 'active' },
                    { '@c': '/component/name', '@e': 5, name: 'kakuna' }
                ]
            };

            const es = registry.createEntitySet(options);

            t.deepEqual(es.toJSON({ mapCdefUri: true }), options);
        })
        .catch(err => console.log('test error', err, err.stack))
        .then(() => t.end());
});

function createRegistry() {
    const registry = new Registry();
    return registry.registerComponent(COMPONENT_DEFINITIONS).then(() => registry);
}
