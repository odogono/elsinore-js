import test from 'tape';
import { toPascalCase } from '../src/util/to';
import { valueArray } from '../src/util/array/value';
import { Collection } from '../src/util/collection';
import { propertyResult } from '../src/util/result';
import { hash } from '../src/util/hash';
import { omit } from '../src/util/omit';
import { pick } from '../src/util/pick';

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

test('valueArray returns a single item from an array', t => {
    t.equals(valueArray(['entity']), 'entity', 'returns a single item');

    t.deepEquals(valueArray([]), null);

    t.deepEquals(valueArray(), null);

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

test('valueArray flattens arrays', t => {
    const array1 = [['entity', 'component']];
    const array2 = [['registry', 'entitySet']];

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

test('propertyResult', t => {
    let object = {
        cheese: 'crumpets',
        stuff: () => 'nonsense',
        cake: { sponge: 'moist', carrot: 'nutty' }
    };

    t.equals(propertyResult(object, 'cheese'), 'crumpets');
    t.equals(propertyResult(object, 'stuff'), 'nonsense');
    t.equals(propertyResult(object, 'meat', 'ham'), 'ham');

    t.equals(propertyResult(object, ['cake', 'sponge']), 'moist');
    t.equals(propertyResult(object, obj => obj.cake.carrot), 'nutty');

    t.end();
});

test('omit', t => {
    // from https://github.com/jashkenas/underscore/blob/master/test/objects.js
    let result = omit({ a: 1, b: 2, c: 3 }, 'b');
    t.deepEqual(result, { a: 1, c: 3 }, 'can omit a single named property');
    result = omit({ a: 1, b: 2, c: 3 }, 'a', 'c');
    t.deepEqual(result, { b: 2 }, 'can omit several named properties');
    result = omit({ a: 1, b: 2, c: 3 });
    t.deepEqual(result, { a: 1, b: 2, c: 3 }, 'without a blacklist returns a clone');
    // result =  omit({a: 1, b: 2, c: 3}, ['b', 'c']);
    // t.deepEqual(result, {a: 1}, 'can omit properties named in an array');
    // result =  omit(['a', 'b'], 0);
    // t.deepEqual(result, {1: 'b'}, 'can omit numeric properties');

    // t.deepEqual( omit(null, 'a', 'b'), {}, 'non objects return empty object');
    // t.deepEqual( omit(void 0, 'toString'), {}, 'null/undefined return empty object');
    t.deepEqual(omit(5, 'toString', 'b'), {}, 'returns empty object for primitives');

    t.end();
});

test('pick', t => {
    let result = pick({a: 1, b: 2, c: 3}, 'a', 'c');
    t.deepEqual(result, {a: 1, c: 3}, 'can restrict properties to those named');

    result = pick({a: 1, b: 2, c: 3} );
    t.deepEqual(result, {}, 'without a blacklist returns empty');

    t.end();
})

// test( 'hash', t => {
//     console.log( 'result', hash("forty-two", false), hash("forty-two", true) );
//     t.end();
// })
