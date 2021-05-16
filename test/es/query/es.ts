import { suite } from 'uvu';
import assert from 'uvu/assert';
import { printAll } from '../../../src/util/print';

import {
    
    ChangeSetOp,
    createEntitySet,
    isComponent,
    isEntitySet,
    getChanges,
    
    prepES,
    
    loadFixtureIntoES,
} from '../helpers';


let test = suite('es/mem/query - EntitySet');

// test('creates an EntitySet', async () => {
//     let [stack] = await prep(`{} !es`);

//     let result = stack.popValue();
//     assert.ok(isEntitySet(result));
// })

test('adds a def to an EntitySet', async () => {
    let es = createEntitySet();

    let stack = await es.query(`/component/text !d +`);
    // let [stack] = await prep(`{} !es /component/text !d +`);

    let result = stack.popValue();
    assert.ok(isEntitySet(result));
});


test('creates a component', async () => {
    let es = createEntitySet();
    await es.register({ url: "/component/title", properties: ["text"] });
    let stack = await es.query(`[ /component/title { text:introduction } ] !c`);

    let result = stack.popValue();
    assert.ok(isComponent(result));
});

test('adds a component', async () => {
    let es = createEntitySet();
    let stack = await es.query(`
        [/component/completed [{name: isComplete, type:boolean default:false}]] !d
        + 
        [ /component/completed {isComplete: true} ] !c +
        `);

    assert.equal(await es.size(), 1);

    const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

    let com = await es.getComponent(cid);

    assert.equal(com.isComplete, true);
});

test('adds components', async () => {
    let es = createEntitySet();
    await es.prepare(`
        // register defs
        
        [ "/component/title", ["text"] ] !d
        
        {   "name":"Completed",
            "url":"/component/completed",
            "properties":[ { "name":"isComplete","type":"boolean" } ] 
        } !d

        gather
        + // add array of defs to es
        
        // query
        [ /component/title {text: "add defs"} ] !c
        [ /component/completed {isComplete: true} ] !c
        gather
        +
        [ /component/title {text: "add components"} ] !c
        +
        `).run();

    assert.equal(await es.size(), 2);
});

test('removes entities', async () => {
    let es = await loadFixtureIntoES(undefined, 'deps');

    const stmtGetEids = await es.prepare(`
    [
        /component/dir#url !ca ~r/purgatory/ == 
        /component/file#url !ca ~r/purgatory/ ==
        or
        @eid
    ] select
    `);

    assert.equal( await stmtGetEids.getResult(), [1004,1006] );
    
    const stmt = es.prepare(`
        [
            /component/dir#url !ca ~r/purgatory/ == 
            /component/file#url !ca ~r/purgatory/ ==
            or
            @eid
        ] select
        -
    `);

    await stmt.run();

    assert.equal( await stmtGetEids.getResult(), [] );

});


test('duplicates an entityset', async () => {
    let es = createEntitySet();
    let stack = await es.query(`
            [ "/component/title", ["text"] ] !d +
            [ /component/title {text:first} ] !c +
            dup`);

    let es1 = stack.popValue();
    assert.ok(isEntitySet(es1));
    assert.equal(await es1.size(), 1);

    let es2 = stack.popValue();
    assert.ok(isEntitySet(es2));
    assert.equal(await es2.size(), 1);
});

test('retrieves component defs', async () => {
    let [stack] = await prepES(`
            @d // get defs - doesnt pop the es
            swap drop // lose the es
            `, 'todo');

    // ilog(stack.words);
    let defs = stack.popValue().map(d => d[0]);
    assert.equal(defs, [
        '/component/title',
        '/component/completed',
        '/component/priority',
        '/component/meta'
    ])
});

// test('retrieves components by did', async () => {
//     let [stack] = await prepES(`
//             [ /component/title !bf @c ] select
//             `, 'todo');

//     // ilog(stack.items);
//     // let defs = stack.popValue().map( d => d[0] );
//     // assert.equal(defs, [
//     //     '/component/title',
//     //     '/component/completed',
//     //     '/component/priority',
//     //     '/component/meta'
//     // ])
// });

// it.only('select performs a subquery', async () => {
//     const query = `[ 2 2 + ] select`;
//     let [,es] = await prepES(undefined, 'todo');
//     let result = await es.query( query );
//     ilog( result.items );
// });

test('returns query results as components', async () => {
    let es = await loadFixtureIntoES(undefined, 'todo');

    const stmt = es.prepare(`
            [
                /component/completed#/isComplete !ca true ==
                /component/title !bf
                @c
            ] select
            `);

    const result = await stmt.getEntities();

    assert.equal(result[0].Title.text, 'get out of bed');
    assert.equal(result[1].id, 101);
})

test.run();