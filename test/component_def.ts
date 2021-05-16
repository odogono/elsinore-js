import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    ComponentDef,
    createProperty,
    propertyToObject,
    toObject as componentDefToObject,
    create as createComponentDef,
    hash as hashComponentDef,
    toObject as defToObject,
    getDefId
} from '../src/component_def';
import { createLog } from '../src/util/log';

const Log = createLog('TestComponentDef');


const test = suite('ComponentDef');




test('should create a property', () => {
    const data = { name: 'status', default: 'active', age: 13 };
    let prop = createProperty(data);

    assert.equal(data, propertyToObject(prop));
});

test('should create', () => {
    let def = createComponentDef(2, "/component/status", ["status", "updated_at"]);

    // Log.debug('def', def);
    // Log.debug('def', componentDefToObject(def));

    // /def @d, url, name
    // /property/status status
    assert.equal(componentDefToObject(def),
        {
            '@d': 2,
            name: 'Status',
            url: '/component/status',
            properties: [
                { name: 'status' }, { name: 'updated_at' }
            ]
        });
});

test('should create from an id/obj form', () => {
    const data = { url: '/component/piece/knight', properties: ['rank', 'file'] };
    let def = createComponentDef(19, data);

    // Log.debug('def', def);
    // Log.debug('def', componentDefToObject(def));

    assert.equal(componentDefToObject(def), {
        '@d': 19,
        name: 'Knight',
        url: '/component/piece/knight',
        properties: [{ name: 'rank' }, { name: 'file' }]
    });
});

test('should create from url/prop array', () => {
    const data = ['/component/completed', [{ name: 'isComplete', type: 'boolean', default: false }]];
    let def = createComponentDef(undefined, ...data);

    assert.equal(componentDefToObject(def), {
        '@d': undefined,
        name: 'Completed',
        url: '/component/completed',
        properties: [{ name: 'isComplete', type: 'boolean' }]
    });
})

test('should create from an instance', () => {
    const data = { url: '/component/piece/knight', properties: ['rank', 'file'] };
    let def = createComponentDef(data);

    def = createComponentDef(22, def);


    assert.equal(getDefId(def), 22);

});

test('hash should return identical values', () => {
    const data = { url: '/component/piece/knight', properties: ['rank', 'file'] };
    let def = createComponentDef(data);
    let hashA = hashComponentDef(def);

    def = createComponentDef(22, def);
    let hashB = hashComponentDef(def);

    assert.equal(hashA, hashB);

    assert.equal(
        hashComponentDef(createComponentDef(22, data)),
        hashComponentDef(createComponentDef(24, data))
    )
});

test('hashes even with additional properties', () => {
    const dataA = {
        url: '/component/completed', properties: [
            { name: 'isComplete', type: 'boolean', default: false }
        ]
    };
    const dataB = {
        url: '/component/completed', properties: [
            { name: 'isComplete', type: 'boolean', default: false, descr: 'indicates completeness' }
        ]
    };

    let defA = createComponentDef(dataA);
    let hashA = defA.hash;

    let defB = createComponentDef(dataB);
    let hashB = defB.hash;

    // console.log(defB, defToObject(defB));
    assert.equal(hashA, hashB);
})


test.run();