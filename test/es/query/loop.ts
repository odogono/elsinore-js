import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    ilog,
    parse,
    prep,
    prepES,
    QueryStack,
    StackValue,
    SType,
} from '../helpers';

let test = suite('es/mem/query - Loops');


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
            10 $count < 
            iif
        ] loop
    `);

    // ilog( stack.toString() );
    let result = stack.popValue();
    assert.equal( result, 10 );

});





test('loops until done', async () => {

    let query = `
        // define a variable holding the es so we don't have to
        // keep swapping things aroung
        es let
        [
            dstId let
            $es
            [
                /component/dep !bf
                /component/dep#dst !ca $dstId ==
                /component/dep#type !ca dir ==
                and
                @c
            ] select
            // /src pluck
        ] selectDeps define

        [
            [] result let // result array
            [
                selectDeps
                /src pluck
                dup 
                $result concat result !
                dup size
                true $result rot 0 == iif
            ] loop
            // lose the last result
            swap drop    
        ] selectDepsRecursive define

        1005 selectDepsRecursive
        `;

    console.log('');
    let [stack,es] = await prepES(undefined, 'deps');
    stack = await es.query(query);
    // ilog( stack.words );

    let result = stack.popValue();
    assert.equal( result, [1007,1008,1009,1010,1011,1012,1013]);
});


test.run();