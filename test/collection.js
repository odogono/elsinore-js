import _ from 'underscore';
import test from 'tape';
import { createLog } from './common';
import { toPascalCase } from '../src/util/to';
import { valueArray } from '../src/util/array/value';
import { Collection } from '../src/util/collection';

const Log = createLog('TestPullStream');

test('add to a collection', t => {
    const collection = new Collection();

    collection.add({ id: 5 });
    collection.add({ id: 5 });

    t.equals(collection.size(), 1);

    t.end();
});

test('add an array of objects to a collection', t => {
    const collection = new Collection();

    collection.add([{ id: 3 }, { id: 4 }, { id: 5 }]);

    t.equals(collection.size(), 3);

    t.end();
});

test('remove from a collection', t => {
    const collection = new Collection();

    collection.add({ id: 5 });
    collection.add({ id: 7 });
    collection.add({ id: 7 });

    collection.remove({ id: 5 });

    t.equals(collection.size(), 1);

    collection.remove({ id: 7 });

    t.equals(collection.size(), 0);

    collection.add({ id: 7 });

    t.equals(collection.size(), 1);

    t.end();
});


test('remove by id', t => {
    const collection = new Collection();

    collection.add({ id: 5, colour: 'magenta' });
    collection.add({ id: 7, colour: 'indigo' });

    let removed = collection.remove(7);

    t.deepEqual( removed, {id:7, colour: 'indigo'} );

    t.equals(collection.size(), 1);

    t.equals( collection.remove(7), undefined );

    t.end();
});


test('get by id', t => {
    const collection = new Collection([{ id: 3 }, { id: 56 }]);

    t.notEqual(collection.get(56), undefined);

    t.end();
});

test('use a different id attribute', t => {
    const collection = new Collection(null, { idAttribute: 'cid' });

    collection.add([{ id: 0, cid: 'o1' }, { id: 0, cid: 'o2' }]);

    t.equals(collection.size(), 2);

    t.end();
});

test('use a function for an idAttribute', t => {
    let collection = new Collection(null, { idAttribute: obj => `${obj.name}.${obj.id}` });

    collection.add([{ id: 100, name: 'alice' }, { id: 101, name: 'carla' }]);

    t.equals(collection.get('carla.101').id, 101);

    t.end();
});

test('find a value in the collection', t => {
    const collection = new Collection();

    collection.add([
        { id: 0, cid: 'o1', name: 'alice' },
        { id: 1, cid: 'o2', name: 'bob' },
        { id: 2, cid: 'o3', name: 'carla' }
    ]);

    t.equals(collection.findWhere({ name: 'bob' }).cid, 'o2');

    t.equals(collection.findWhere({ id: 2, cid: 'o3' }).name, 'carla');

    t.end();
});

test('sort a collection by attribute', t => {
    const collection = new Collection();

    collection.comparator = (a, b) => a.priority > b.priority;

    collection.add([
        { id: 0, priority: 100, name: 'alice' },
        { id: 1, priority: -10, name: 'bob' },
        { id: 2, priority: 0, name: 'carla' }
    ]);

    collection.add({ id: 3, priority: -20, name: 'dina' }, { debug: true });

    t.deepEquals(collection.map(i => i.id), [3, 1, 2, 0]);

    t.end();
});
