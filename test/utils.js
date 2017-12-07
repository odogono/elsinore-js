import _ from 'underscore';
import test from 'tape';
import { toPascalCase } from '../src/util/to';
import valueArray from '../src/util/array/value';
import Collection from '../src/util/collection';
import propertyResult from '../src/util/result';

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
