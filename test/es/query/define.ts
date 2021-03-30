import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    parse,
    prep,
    QueryStack,
    StackValue,
    SType,
} from '../helpers';

let test = suite('es/mem/query - Define');


test('define js', async () => {
    let [stack] = await prep(`
            "js://Math/min" jsmin define
            22 33 jsmin
        `);

    let result = stack.popValue();
    assert.equal(result, 22);
    
});

test('define nodejs', async () => {
    let [stack] = await prep(`
            "nodejs://path/normalize" normalize define
            "/foo/bar//baz/asdf/quux/.." normalize
        `);

    let result = stack.popValue();
    assert.equal(result, '/foo/bar/baz/asdf');
});



test.run();