import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    isComponentDef,
    parse,
    prep,
    QueryStack,
    StackValue,
    sv,
} from '../helpers';


let test = suite('es/mem/query - Conditions');

test('iif evaluates a boolean condition', async () => {
    // WHAT to do - should list conditions be evaled?
    let [stack] = await prep(`
            [ 2 3 + ] ok define
            wet ok false iif
            // wet hot 2 3 == iif
        `);

    let result = stack.popValue();
    assert.equal(result, 'wet');
})

test('if', async () => {
    let [stack] = await prep(`
    "even" 2 1 % 0 == if
    "odd" 2 1 % 0 != if
    `);

    assert.equal( stack.popValue(), "odd" );
});


test.run();
