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
            wet ok true iif
        `);

    let result = stack.popValue();
    assert.equal(result, 5);
})

test('if', async () => {
    let [stack] = await prep(`
    "even" 2 1 % 0 == if
    "odd" 2 1 % 0 != if
    `);

    assert.equal( stack.popValue(), "odd" );
});


test('list values are pushed', async () => {
    let [stack] = await prep(`
        [ 19, 9 ] true if
    `);

    assert.equal( stack.popValue(), 9 );
    assert.equal( stack.popValue(), 19 );
});

test('can still produce a list', async () => {
    let [stack] = await prep(`
        [ [19, 9] ] true if
    `);

    assert.equal( stack.popValue(), [19,9] );
});


test.run();
