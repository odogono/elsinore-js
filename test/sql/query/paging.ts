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

let test = suite('es/sql/query - Paging');


test('limit/orderby on components', async () => {
    let [stack,es] = await prepES(`
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
    // console.log( es.getUrl() );

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

test('limit/orderby on entities again', async () => {

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

    assert.equal( result.map( e => e.id), [1003,1002] );
});


test('count of entities', async () => {
    let [stack,es] = await prepES(`
        [
            @e
        ] select_count

        `, 'todo');

    assert.equal(stack.popValue(), 6);
});

test('count of entities with paging', async () => {
    let [stack,es] = await prepES(`
        [
            /component/meta#/createdAt !ca desc order
            3 0 limit
            @e
        ] select_count
        `, 'todo');

    assert.equal(stack.popValue(), 6);
});


test('count of components', async () => {
    let [stack,es] = await prepES(`
        [
            @c
        ] select_count
        `, 'todo');

    assert.equal(stack.popValue(), 17);
});

test('count of optional components', async () => {
    let [stack,es] = await prepES(`
        [
            [/component/title /component/completed] !bf
            @c
        ] select_count
        `, 'todo');

    assert.equal(stack.popValue(), 3);
});

test.run();