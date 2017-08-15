import _ from 'underscore';
import test from 'tape';
import { toPascalCase } from '../src/util/to';
import valueArray from '../src/util/array/value';
import Collection from '../src/util/collection';

test('toPascalCase', t => {
    const cases = {
        'good work': 'GoodWork',
        'good-job': 'GoodJob',
        'good    skills': 'GoodSkills',
        good: 'Good',
        GoodJobEveryone: 'GoodJobEveryone',
        goodJobEveryone: 'GoodJobEveryone',
        spud42u: 'Spud42U',
        '1999partyOver': '1999PartyOver'
    };

    Object.keys(cases).forEach(input => t.equals(toPascalCase(input), cases[input]));
    t.end();
});

test('add to a collection', t => {
    const collection = new Collection();

    collection.add({ id: 5 });
    collection.add({ id: 5 });

    t.equals(collection.size(), 1);

    t.end();
});

test('remove from a collection', t => {
    const collection = new Collection();

    collection.add({ id: 5 });
    collection.add({ id: 7 });

    collection.remove({ id: 5 });

    t.equals(collection.size(), 1);

    collection.remove({ id: 7 });

    t.equals(collection.size(), 0);

    collection.add({ id: 7 });

    t.equals(collection.size(), 1);

    t.end();
});

test('get by id', t => {
    const collection = new Collection([{ id: 3 }, { id: 56 }]);

    t.notEqual(collection.get(56), undefined);

    t.end();
});

test('use a different id attribute', t => {
    const collection = new Collection(null,{idAttribute:'cid'});

    collection.add( [{id:0,cid:'o1'}, {id:0, cid:'o2'}] );

    t.equals( collection.size(), 2 );

    t.end();
});

test('valueArray returns a single item from an array', t => {
    t.equals(valueArray(['entity']), 'entity', 'returns a single item');

    t.deepEquals(valueArray([]), [], 'returns the array');

    t.deepEquals(valueArray(), []);

    t.end();
});

test('valueArray returns multiple items from an array', t => {
    const array = ['entity', 'component'];

    t.deepEquals(valueArray(array), ['entity', 'component']);

    t.end();
});

test('valueArray concatenates multiple arrays', t => {
    const array1 = ['entity', 'component'];

    const array2 = ['registry', 'entitySet'];

    t.deepEquals(valueArray(array1, array2), ['entity', 'component', 'registry', 'entitySet']);

    t.end();
});

test('valueArray converts collections to arrays', t => {
    t.deepEquals(valueArray(new Collection([{ id: 2 }, { id: 3 }])), [{ id: 2 }, { id: 3 }]);

    t.deepEquals(valueArray(new Collection([{ id: 2 }, { id: 3 }]), 'component', 'entity'), [
        { id: 2 },
        { id: 3 },
        'component',
        'entity'
    ]);

    t.deepEquals(valueArray(new Collection([{ id: 2 }, { id: 3 }]), new Collection({ id: 4 })), [
        { id: 2 },
        { id: 3 },
        { id: 4 }
    ]);

    t.end();
});
