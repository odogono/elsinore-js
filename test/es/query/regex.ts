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

let test = suite('es/mem/query - Regex');

test('matches', async () => {
    let [stack] = await prep(`
            "foo is bar" ~r/foo/ ==
            `);

    let result = stack.popValue();
    assert.equal(result, true);
});

test('matches length >', async () => {
    let [stack] = await prep(`
            "foo" ~r/^.{3,}$/ ==
            `);

    let result = stack.popValue();
    assert.equal(result, true);
});



test('executes a regex', async () => {
    let [stack] = await prep(`
        "file:///test/fixtures/rootA/static"
        ~r/(?!.*/).+/
        eval
    `);
    assert.equal( stack.popValue(), "static" );
});


test('split with regex', async () => {
    let [stack] = await prep(`
        "file:///test/fixtures/rootA/static/"
        ~r/(?!\/\/)\/(?=.*\/)/
        split
        pop
        drop
        / join / join
    `);
    assert.equal( stack.popValue(), "file:///test/fixtures/rootA/" );
});

test.run();