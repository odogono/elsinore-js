import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    isComponentDef,
    parse,
    prep,
    QueryStack,
    StackValue,
    sv,
} from '../helpers';


let test = suite('es/mem/query - Leave');

test('stops stack execution', async () => {
    let [stack] = await prep(`1 2 3 leave 4`);

    let result = stack.popValue();
    assert.equal(result, 3);
});


test('stops list execution', async () => {
    let [stack] = await prep(`[1 2 3 leave 4] spread`);
    assert.equal(stack.toString(), '3 2 1');
});

test('stops loop execution', async () => {
    let [stack] = await prep(`
    0 count let
    [
        $count 1 + count !

        // the double escape prevents the leave
        // being eval'd until it is chosen by iif
        true **leave $count 2 == iif
        
    ] loop
    `);

    assert.equal( stack.getUDValue('count'), 2 );
});


test('leave with value', async () => {
    let [stack] = await prep(`
    red *leave 1 0 < if
    blue
    `);

    assert.equal( stack.popValue(), 'red'); 
});


test('leave function', async () => {
    let [stack] = await prep(`
    // only returns false if the value is not even
    [
        **leave swap 2 swap % 0 == if
        false
    ] isNotEven define

    6 isNotEven
    5 isNotEven
    3 isNotEven
    2 isNotEven
    `);

    assert.equal( stack.toString(), 'false false' );
})




test.run();
