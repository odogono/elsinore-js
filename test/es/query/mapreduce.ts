import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    parse,
    prep,
    QueryStack,
    StackValue,
    sv,
} from '../helpers';

let test = suite('es/mem/query - Map/Reduce/Filter');

test('maps values', async () => {
    let [stack] = await prep(`[1 2 3 4] [10 *] map`);

    let result = stack.popValue();
    assert.equal(result, [10, 20, 30, 40]);
})

test('reduces values', async () => {
    let [stack] = await prep(`[1 2 3 4] 0 [+] reduce`);
    let result = stack.popValue();
    assert.equal(result, 10);
});

test('filters values', async () => {
    // applies an is-even filter
    let [stack] = await prep(`[1 2 3 4] [ 2 swap % 0 == ] filter`);
    // Log.debug('stack:', stackToString(stack) );
    let result = stack.popValue();
    assert.equal(result, [2, 4]);
});


test('reverse array', async () => {
    let [stack] = await prep(`
        [ 1 2 3 4 ] [] [ + ] reduce
    `);

    assert.equal( stack.popValue(), [4,3,2,1] );
});

test.run();