import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    prep,
    prepES,
} from '../helpers';

let test = suite('es/mem/query - Set functions');


test('difference', async () => {
    let [stack] = await prep(`
            [ 1, 2, 3, 4, 5 ]
            [ 0, 3, 6, 9 ]
            diff!
            `);
    assert.equal(stack.popValue(), [0,6,9] );
});

test('intersect', async () => {
    let [stack] = await prep(`
            [ 1, 2, 3, 4, 5 ]
            [ 2, 4, 6, 8 ]
            intersect!
            `);
    assert.equal(stack.popValue(), [2,4] );
});




test.run();