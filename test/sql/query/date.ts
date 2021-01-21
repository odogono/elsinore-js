import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    beforeEach,
    parse,
    prep,
    QueryStack,
    StackValue,
    SType,
} from '../helpers';

let test = suite('es/sqlite/query - Dates');

test.before.each( beforeEach );

test('creates a date', async () => {
    let [stack] = await prep(`
            ~d|2020-06-04T06:38:12.261Z|
            `);

    // ilog( stackToString(stack) );
    let val = stack.pop();
    assert.equal(val[0], SType.DateTime);
});
test('compares dates', async () => {
    let [stack] = await prep(`
            ~d|2020-06-13T18:26:59.216Z| ~d|2020-06-13T18:26:59.216Z| ==
            ~d|2020-06-13T18:26:59.216Z| ~d|2010-06-13T18:26:59.216Z| !=
            ~d|2020-06-13T18:26:59.216Z| ~d|2010-06-13T18:26:59.216Z| <
            // empty date for the current datetime
            ~d|2020-06-13T18:26:59.216Z| ~d|| >
            `);
    while (stack.size > 0) {
        assert.ok(stack.popValue());
    };
    // assert.equal( stackToString(stack), 'true true true true' );
    // let val = stack.pop();
    // assert.equal( val[0], SType.DateTime );
});

test.run();