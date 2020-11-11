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
    let [stack] = await prep(`1 2 3 break 4`);

    let result = stack.popValue();
    assert.equal(result, 3);
});


test('stops list execution', async () => {
    let [stack] = await prep(`[1 2 3 break 4] spread`);
    assert.equal(stack.toString(), '3 2 1');
});

test('stops loop execution', async () => {
    let [stack] = await prep(`
    0 count let
    [
        $count 1 + count !

        // the double escape prevents the break
        // being eval'd until it is chosen by iif
        true **break $count 2 == iif
        
    ] loop
    `);

    assert.equal( stack.getUDValue('count'), 2 );
});


test('break with value', async () => {
    let [stack] = await prep(`
    red *break 1 0 < if
    blue
    `);

    assert.equal( stack.popValue(), 'red'); 
});


test('break function', async () => {
    let [stack] = await prep(`
    // only returns false if the value is not even
    [
        **break swap 2 swap % 0 == if
        false
    ] isNotEven define

    6 isNotEven
    5 isNotEven
    3 isNotEven
    2 isNotEven
    `);

    assert.equal( stack.toString(), 'false false' );
})


test('defined break', async () => {
    let [stack] = await prep(`
    [
        [ true *return ] swap 2 swap % 0 == if
        false
    ] isEven define

    6 isEven
    5 isEven
    4 isEven
    `);

    assert.equal( stack.toString(), 'true false true' );
})


test.run();
