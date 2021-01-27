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


let test = suite('es/mem/query - Reference Words');



test('pops an earlier word', async () => {
    let [stack] = await prep(`planet world hello $1`);
    assert.equal(stack.toString(), '"world" "hello" "planet"');
});

test('works within a list', async () => {
    let [stack] = await prep(`planet world [ hello $0 ]`);
    assert.equal(stack.toString(), '["hello"] "world" "planet"');
});

test('pops above a list', async () => {
    let [stack] = await prep(`planet [ world [ hello ^^$0 ]]`);
    assert.equal(stack.toString(), '["world", ["hello", "planet"]]');
});



test('not evaluated the first time', async () => {
    // spread evaluates the reference    
    let [stack] = await prep(`planet world [ hello ^$1 ] spread`);
    assert.equal(stack.toString(), '"planet" "hello" "world"');
});

test('accesses defined words', async () => {
    let [stack] = await prep(`
            active status let
            [ status is $status ] eval
            `);
    assert.equal(stack.toString(), '["status", "is", "active"]');
});


test('a defined word evaluates', async () => {
    let [stack] = await prep(`[ 2 3 + ] fn define fn`);
    // the fn word is evaled as it is pushed onto the stack
    assert.equal(stack.popValue(), 5);
});

test('a let word pushes', async () => {
    let [stack] = await prep(`[ 2 3 + ] fn let $fn`);
    assert.equal(stack.popValue(), [2, 3, '+']);
});


test('peeks an earlier word', async () => {
    let [stack] = await prep(`planet world hello %1`);
    assert.equal(stack.toString(), '"world" "hello" "world" "planet"');
})

test('out of range on peeking an earlier word', async () => {
    try {
        await prep(`planet world hello %5`);
    } catch( err ){
        assert.equal( err.message, 'stack underflow: ("hello" "world" "planet")');
    }
    // assert.equal(stack.toString(), '"hello" "world" "planet"');
})


test('evals map', async () => {
    let [stack] = await prep(`
            active status let
            { status: $status }
            `);
    assert.equal(stack.toString(), '{"status": "active"}');
});


test.run();