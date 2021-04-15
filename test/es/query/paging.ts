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
    
    assert.equal(result.map(e => e.Title.text), [
        'phone up friend',
        'drink some tea',
        'do some shopping'
    ]);
});

test('limit/orderby on entities without did', async () => {
    let [stack,es] = await prepES(`
        [
            /component/meta#/createdAt !ca desc order
            3 0 limit
            @e
        ] select
        `, 'todo');

    // 101, 103, 104
    const result = stack.popValue();
    assert.equal(result.map(e => e.Title.text), [
        'phone up friend',
        'drink some tea',
        'do some shopping'
    ]);
});

test('limit/orderby on entities', async () => {

    let q = `
    [ "/component/a" [url] ] !d
    [ "/component/b" [url] ] !d
    [ "/component/c" [url] ] !d
    [ "/component/time" [ { name: time, type: datetime } ] ] !d
    gather +

    [ /component/a { url : "alpha 1" } ] !c
    [ /component/b { url: "beta 1"}] !c
    [ /component/c { url: "charlie 1"} ] !c
    [ /component/time { time: "2021-02-23T14:00:00.000Z" } ] !c
    gather +
    
    [ /component/b { url: "beta 2" }] !c
    [ /component/c { url: "charlie 2" }] !c
    [ /component/time { time: "2021-02-23T09:00:00.000Z" } ] !c
    gather +
    
    [ /component/b { url: "beta 3" }] !c
    [ /component/c { url: "charlie 3" }] !c
    [ /component/time { time: "2021-02-23T16:00:00.000Z" } ] !c
    gather +

    [
        /component/time#time !ca desc order
        [ 1002 1003 ]
        [ /component/b /component/c ] !bf
        @e
    ] select
    `;

    let id = 1000;
    let idgen = () => ++id;
    const es = createEntitySet({ idgen });
    const result = await es.prepare(q).getResult();

    // console.log('result', result);

    // result.forEach( e => printEntity(es,e));

    assert.equal( result.map( e => e.id), [1003,1002] );
    // assert.equal(result.map(e => e.Title.text), [
    //     'phone up friend',
    //     'drink some tea',
    //     'do some shopping'
    // ]);
});

test.run();