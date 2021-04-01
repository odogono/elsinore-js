import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    ilog,
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
    assert.equal(stack.popValue(), ['hello', 'world']);
});

test('adds to an list', async () => {
    let [stack] = await prep(`[ world ] hello +`);
    assert.equal(stack.popValue(), ['world', 'hello']);
})

test('prepends to a list', async () => {
    let [stack] = await prep(`
    hello [ world ] +
    `);
    assert.equal( stack.popValue(), ['hello', 'world'] );
})

test('push', async () => {
    let [stack] = await prep(`[] hello push`);
    let result = stack.popValue();
    assert.equal(result, ['hello']);
});

test('pop', async () => {
    let [stack] = await prep(`[ hello world ] pop!`);
    let result = stack.popValue();
    assert.equal(result, 'world');
});

test('pop return', async () => {
    let [stack] = await prep(`[ hello world ] pop`);
    assert.equal( stack.popValue(), 'world');
    assert.equal( stack.popValue(), [ 'hello' ] );
});

test('pop empty', async () => {
    try {
        await prep(`[] pop!`);
    } catch (err) {
        assert.instance(err, StackError);
        assert.equal(err.message, 'stack underflow: (])');
    }
});

test('rot', async () => {
    let [stack] = await prep(`
    5 1 2 3 rot
    `);
    let result = stack.popValue();
    assert.equal(result, 1);
});


test('gather builds a list from similar items', async () => {
    let [stack] = await prep(`
    [hello] 10 12 14 gather
    `);

    // hello is not added to the result array
    assert.equal( stack.toString(), `[10, 12, 14] ["hello"]`);
});

test('concat joins arrays', async () => {
    let [stack] = await prep(`
    [hello] [10 12] [14] concat
    `);

    // hello is not added to the result array
    assert.equal( stack.toString(), `[10, 12, 14] ["hello"]`);
});

test('concat joins arrays and values', async () => {
    let [stack] = await prep(`
    hello [14] concat
    `);

    // ilog( stack.items );
    // hello is not added to the result array
    assert.equal( stack.toString(), `["hello", 14]`);
});


test('indexOf', async () => {
    let [stack] = await prep(`
    [ hello world today ]
    world index_of
    `);

    assert.equal( stack.popValue(), 1 );

    [stack] = await prep(`
    [ hello world today ]
    goodbye index_of
    `);

    assert.equal( stack.popValue(), -1 );
});



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