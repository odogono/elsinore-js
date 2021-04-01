import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    beforeEach,
    loadFixtureIntoES,
    parse,
    prep,
    prepES,
    QueryStack,
    StackValue,
    SType,
} from '../helpers';

let test = suite('es/sqlite/query - Loops');

test.before.each( beforeEach );


test('loops until done', async () => {
    let [stack] = await prep(`
        // the count is defined outside the loop as usual
        5 count let
        [
            // increment count by one
            // the '!' word is replacing the existing value
            $count 1 + count !
            
            // the loop continues while we return true (not just truthy)
            // the condition returns true if count < 10, otherwise
            // it returns the final count
            $count
            true 
            10 $count > 
            iif
        ] loop
    `);

    // ilog( stack.toString() );
    let result = stack.popValue();
    assert.equal( result, 10 );

});



test('loops until done 2', async () => {

    const query = `
        [
            dstId let
            [
                /component/dep !bf
                /component/dep#dst !ca $dstId ==
                /component/dep#type !ca dir ==
                and
                @c
            ] select
        ] selectDeps define

        [
            [] result let // result array
            [
                selectDeps
                /src pluck!
                dup 
                $result swap concat result !
                dup size!
                // continue if the last results
                // came back non-empty
                true [$result] rot 0 == iif
                
            ] loop
            // lose the last result
            swap drop
        ] selectDepsRecursive define

        1005 selectDepsRecursive
        `;

    let es = await loadFixtureIntoES(undefined, 'deps');
    const stmt = es.prepare(query);
    
    const result = await stmt.pop();
    assert.equal( result, [1007,1008,1009,1010,1011,1012,1013]);
});


test.run();