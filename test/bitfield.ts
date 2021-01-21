import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    BitField,
    create,
    count,
    set, get,
    and, or,
    toString,
    toValues,
    toArray
} from '../src/util/bitfield';


let test = suite('bitfield');



test('creates from values', () => {
    let bf = create([1, 2, 3]);
    assert.equal(toValues(bf), [1, 2, 3]);
    bf = create(bf);
    assert.equal(toValues(bf), [1, 2, 3]);
});

test('gets a value', () => {
    let bf = create();

    bf = set(bf, 2, true);

    bf = set(bf, 128, true);

    assert.equal(get(bf, 0), false);

    assert.equal(get(bf, 2), true);

    assert.equal(get(bf, 128), true);

    assert.equal(get(bf, 9456), false);
});

test('sets a value', () => {
    let bf = create();

    bf = set(bf, 1);
    bf = set(bf, 2);
    bf = set(bf, 3);

    assert.equal(toValues(bf), [1, 2, 3]);
})

test('exports to various formats', () => {
    let bf = create();

    bf = set(bf, 0, true);
    bf = set(bf, 5, true);

    assert.equal(toString(bf), '100001');

    assert.equal(toString(create()), '0');

    assert.equal(toValues(bf), [0, 5]);
    assert.equal(toValues(create()), []);

    assert.equal(toArray(bf),
        [true, false, false, false, false, true]);
    assert.equal(toArray(create()), []);

});

test('counts the number of true values', () => {
    let bf = create();

    assert.equal(count(bf), 0);

    bf = set(bf, 2, true);
    bf = set(bf, 12, true);
    bf = set(bf, 125, true);

    assert.equal(count(bf), 3);
});

test('should AND', () => {
    const expectAnd = (a: string, b: string, expected: boolean) =>
        assert.equal(and(create(a), create(b)), expected);

    expectAnd('1000', '1000', true);

    expectAnd('10000100000010000', '10000100000010010', true);

    expectAnd('1001000', '1101011', true);

    expectAnd('1101011', '1001000', false);

    expectAnd('01010', '01100', false);

    expectAnd('11010', '1000000010', false);

    expectAnd('1000', '1000', true);
    expectAnd('1000', '1010', true);
    expectAnd('1000', '1100', true);
    expectAnd('0110', '1001', false);
    expectAnd('0000', '0000', true);

    // expectAnd( [ 6, 8 ], [1,6,7,8] ).toBe(false);
});

test('AND with empty', () => {
    let a = create();
    let b = create('101010');

    assert.equal( and(a,b), true ); // this is correct, even though we don't want it to be
});

test('should OR', () => {
    const expectOr = (a: string, b: string, expected: boolean) =>
        assert.equal(or(create(a), create(b)), expected);

    expectOr('1000', '1000', true);
    expectOr('1000', '1010', true);
    expectOr('1000', '1100', true);
    expectOr('0110', '1001', false);
    expectOr('0000', '0000', false);

    expectOr('1001000', '1101011', true);
    expectOr('10000100000010000', '10000100000010010', true);

    expectOr(
        '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000',
        '1000000000000000000000000000000010000',
        true);
});


test.run();