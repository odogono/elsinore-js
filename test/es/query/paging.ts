import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    Entity,
    getEntityId,
    createEntitySet,
    printEntity,
    prepES,
} from '../helpers';

let test = suite('es/mem/query - Paging');




test('limit', async () => {
    let [stack] = await prepES(`
        [
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



test('limit/orderby on entities', async () => {
    let [stack,es] = await prepES(`
        [
            /component/meta#/createdAt !ca desc order
            3 0 limit
            /component/title !bf
            @e
            
        ] select
        `, 'todo');

    const result = stack.popValue();
    // console.log( es.getUrl() );

    // console.log('result', result);

    // result.forEach( e => printEntity(es,e));

    assert.equal(result.map(e => e.Title.text), [
        'phone up friend',
        'drink some tea',
        'do some shopping'
    ]);
});


test.run();