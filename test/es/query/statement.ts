import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    createEntitySet,
    ilog,
    parse,
    prep,
    prepES,
    QueryStack,
    StackValue,
    SType,
} from '../helpers';

let test = suite('es/mem/query - Statement');


test('passing values to a prepared statement', async () => {
    let es = createEntitySet();

    const stmt = await es.prepare(`$arg0 $arg1 +`);

    let result = await stmt.pop({ arg0: 10, arg1: 100});
    assert.equal( result, 110 );
    
    result = await stmt.pop({ arg0: 6, arg1: 32});
    assert.equal( result, 38 );

    ilog(stmt);

});


test.run();