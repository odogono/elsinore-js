import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    buildEntitySet,
    buildStackEntitySet,
    createEntitySet,
    ilog,
    isEntity,
    loadFixture,
    parse,
    prep,
    QueryStack,
    StackValue,
    SType,
    sv,
} from '../helpers';


let test = suite('es/mem/query');


test('executes an async word', async () => {
    let stack = new QueryStack();
    let data = parse('100 doubleit');
    // Log.debug('ok', stack.pop);
    const onDoubleIt = async (stack: QueryStack, v: StackValue): AsyncInstResult => {
        v = stack.pop();
        let result = sv(v[1] * 2);
        return Promise.resolve(result);
    }

    stack = stack.addWords([['doubleit', onDoubleIt]]);

    // let values;
    await stack.pushValues(data);

    assert.equal(stack.items[0], sv(200));
})

test('swaps the top two elements of the stack', async () => {
    let [stack] = await prep(`1 2 3 4 swap`);

    assert.equal(stack.popValue(), 3);
    assert.equal(stack.popValue(), 4);
    assert.equal(stack.popValue(), 2);
    assert.equal(stack.popValue(), 1);
});


test('to_str copes with words', async () => {
    let [stack] = await prep(`
    13 result let
    // ["result is " $result] .
    ["result is " $result] to_str!
    `);
    assert.equal( stack.popValue(), "result is 13");
});

test('creates an entity', async () => {
    let [stack] = await prep(`100 !e`);
    let result = stack.popValue();
    assert.ok(isEntity((result)));
});

test('adds a component to an entity', async () => {
    let query = `
            []
            [ "/component/title", { "text":"get out of bed"} ] !c +
            [ "/component/completed", {"isComplete":true}] !c +
            [ "/component/priority", {"priority":10}] !c +
            0 !e swap +
        `;
    let [stack] = await prep();
    [stack] = await buildStackEntitySet(stack);
    await stack.pushValues(parse(query));
    // Log.debug( stack );

    let e = stack.popValue();

    assert.ok(isEntity(e));
    assert.equal(e.components.size, 3);
});

test('loads from file', async () => {
    // let insts = await loadFixture('todo');
    let insts = await loadFixture('chess');
    // Log.debug(insts);
    let [stack] = await prep();


    let es = createEntitySet();

    await stack.push([SType.EntitySet, es]);

    await stack.pushValues(insts);

    es = stack.popValue();

    assert.equal(await es.size(), 32);
});

test.run();