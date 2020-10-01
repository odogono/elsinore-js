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

let test = suite('es/query/mem - Regex');

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

test.run();