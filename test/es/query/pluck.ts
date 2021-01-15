import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    prep,
    prepES,
    QueryStack,
    StackValue,
    sv,
} from '../helpers';

let test = suite('es/mem/query - Pluck');

test('plucks values', async () => {
    let [stack] = await prep(`
            {text: hello} /text pluck
            `);
    assert.equal(stack.popValue(), 'hello');
});

test('failed pluck', async () => {
    let [stack] = await prep(`
            {text: hello} /msg pluck
            `);
    assert.equal(stack.popValue(), undefined);
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
        [ 3, 'hello', undefined ],
        [ 4, 'world', 'active' ]
    ]);
});


test('plucks from an entity', async () => {

    let [stack] = await prepES(`[ 
            /component/priority#priority !ca 10 == 
            @e
        ] select
        [/component/title#text /id /component/meta#/meta/tags] pluck
        // prints
    `, 
    'todo');

    // console.log( stack.items[1] );
    // console.log( stack.popValue() );

    assert.equal( stack.popValue(), [
        'get out of bed', 100, [ 'first', 'action']
    ]);

});

test.run();