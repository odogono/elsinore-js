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





test.run();
