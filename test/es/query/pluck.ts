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

let test = suite('es/mem/query - Pluck');

test('plucks values', async () => {
    let [stack] = await prep(`
            {text: hello} /text pluck
            `);

    // ilog(stack.items);
    let result = stack.popValue();
    assert.equal(result, 'hello');
});

test('plucks value from multiple maps', async () => {
    let [stack] = await prep(`[
                {text: hello} {text: world}
            ] /text pluck`);

    // ilog(stack.items);
    let result = stack.popValue();
    assert.equal(result, ['hello', 'world']);
});

test('plucks multiple values', async () => {
    let [stack] = await prep(`[
                {@e: 3, text: hello, priority: 2}
                {@e: 4, text: world, priority: -1, status: active}
            ] [/@e, /text, /status] pluck`);

    // ilog(stack.items);
    let result = stack.popValue();
    assert.equal(result, [
        { '@e': 3, text: 'hello' },
        { '@e': 4, text: 'world', status: 'active' }
    ]);
});
test.run();