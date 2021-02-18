import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    Entity,
    getEntityId,
    createEntitySet,
    prepES,
} from '../helpers';

let test = suite('es/mem/query - Paging');




test('limit', async () => {
    let [stack] = await prepES(`
        [
            // how to get this param to the parts that need it?
            // perhaps compiling it into a map for the words to read as args
            // or maybe setting state on the stack itself
            /component/meta#/createdAt !ca desc order
            3 0 limit
            /component/title !bf
            @c
            
        ] select
        `, 'todo');

    const result = stack.popValue();
    

    // console.log('result', result);

    assert.equal(result.map(c => c.text), [
        'phone up friend',
        'drink some tea',
        'do some shopping'
    ]);
});


test.run();