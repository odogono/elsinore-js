import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    parse,
    prep,
    QueryStack,
    StackError,
    StackValue,
    SType,
    sv,
} from '../helpers';



let test = suite('es/mem/query - Maps and Lists');



test('builds lists', async () => {
    let [stack] = await prep(`[ hello, world ]`);
    let result = stack.popValue();
    assert.equal(result, ['hello', 'world']);
});

test('adds to an list', async () => {
    let [stack] = await prep(`[] hello +`);
    let result = stack.popValue();
    assert.equal(result, ['hello']);
})

test('push', async () => {
    let [stack] = await prep(`[] hello push`);
    let result = stack.popValue();
    assert.equal(result, ['hello']);
});

test('pop', async () => {
    let [stack] = await prep(`[ hello world ] pop`);
    let result = stack.popValue();
    assert.equal(result, 'world');
});

test('pop empty', async () => {
    try {
        await prep(`[] pop`);
    } catch (err) {
        assert.instance(err, StackError);
        assert.equal(err.message, 'stack underflow: ()');
    }
})

test('builds maps', async () => {
    let [stack] = await prep(`{ name: alex, age: 45, isActive }`);

    // stack = addWord(stack, ']', onArrayClose );
    // Log.debug('stack', stringify(stack.items,1) );
    let result = stack.pop();

    assert.equal(result,
        [SType.Map, {
            name: [SType.Value, 'alex'],
            age: [SType.Value, 45],
            isActive: [SType.Value, undefined],
        }]);
});

test('builds a map from an array', async () => {
    let [stack] = await prep(`[ name alex age 45 ] to_map`);

    let result = stack.popValue();
    assert.equal(result, { name: 'alex', age: 45 });
})

test('handles an invalid array', async () => {
    // let [stack] = ;
    try {
        await prep(`[ 1st 2nd 3rd { name: 4th ]`)
    } catch (err) {
        assert.instance(err, StackError);
        // Log.debug('umm', assert.instance(err, StackError));
    }

    // assert.rejects(stack);
    // assert.throws( , Error, `unexpected word ']': ("name" "4th")`);
    // ilog(stack.items);
})

test('references words outside of array', async () => {
    let [stack] = await prep(`
            1977 1974
            [ 1900 ^$0 ^$0 2018 ]
            `);
    // ilog(stack.items);
    let result = stack.popValue();
    assert.equal(result, [1900, 1974, 1977, 2018]);
})

test.run();