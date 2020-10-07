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
            // the 'let' word is replacing the existing value
            // note we have to de-reference count to keep it treated
            // as a string
            count 1 + **count let

            // the loop continues while we return false
            // the condition returns false if count < 10, otherwise
            // it returns the final count
            count 
            false 
            10 count < 
            iif
        ] loop
    `);

    // ilog( stack.toString() );
    let result = stack.popValue();
    assert.equal( result, 10 );

});

test.only('loops until done', async () => {

    let query = `
        // define a variable holding the es so we don't have to
        // keep swapping things aroung
        es let
        [
            dsts let
            ^es [
                /component/dep !bf
                /component/dep#dst !ca ^dsts ==
                /component/dep#type !ca dir ==
                and
                @c
            ] select
            /src pluck
        ] selectDeps define

        1012 selectDeps
        prints
        `;

    console.log('');
    let [stack,es] = await prepES(undefined, 'deps');
    stack = await es.query(query);
    // ilog( stack.words );

    let result = stack.popValue();
    // ilog( result );
    
});


test.run();