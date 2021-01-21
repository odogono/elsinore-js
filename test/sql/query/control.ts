import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    beforeEach,
    isComponentDef,
    parse,
    prep,
    QueryStack,
    StackValue,
    sv,
} from '../helpers';


let test = suite('es/sqlite/query - Execution control');

test.before.each( beforeEach );

test('stops stack execution', async () => {
    let [stack] = await prep(`1 2 3 @! 4`);

    let result = stack.popValue();
    assert.equal(result, 3);
});

test('stops and restarts stack execution', async () => {
    let [stack] = await prep(`1 2 3 @! 4 5 @> 6 7`);

    // let result = stack.popValue();
    assert.equal( stack.toString(), '7 6 3 2 1');
});

test('stops and restarts stack execution 2', async () => {
    let [stack] = await prep(`
        1 2 3 
        [ @! ] 1 1 == if
        4 5 
        @> [ @! ] 1 2 == if
        6 7
    `);

    // let result = stack.popValue();
    assert.equal( stack.toString(), '7 6 3 2 1');
});


test('stops list execution', async () => {
    let [stack] = await prep(`[1 2 3 @! 4 @>] spread 5`);
    assert.equal(stack.toString(), '5 3 2 1');
});

test('stops defined list execution', async () => {
    let [stack] = await prep(`
    [1 2 3 @! 4 ] theList define 
    [
        [ theList @! ] true if

        // the break within theList stops the break in the if
        // statement, therefore execution continue and 'no' is
        // added to the stack
        no
        @>
    ] answer define
    answer
    done
    `);
    
    assert.equal(stack.toString(), '"done" 3 2 1');
});


test('stops loop execution', async () => {
    let [stack] = await prep(`

    // increment up to 15
    10
    [
        1 +
        dup [ @! ] swap 15 <= if
        true
    ] loop
    
    // the loop will automatically continue after any break
    100 +
    `);
    assert.equal( stack.popValue(), 115 );
});


`


`

// test('break with value', async () => {
//     // console.log('');
//     let [stack] = await prep(`

//     // in this case, the break escapes the word scope only
//     // and doesnt affect the caller
//     // [ a @! b @> ] nopeBreak define

//     // because the break is escaped, it doesn't affect
//     // the word scope, but is passed to whatever is being called
//     // [ a @! b ] nadaBreak define

//     // nopeBreak valid

//     // nadaBreak invalid @> valid
//     // hello

//     // [ nope @!] 1 0 < if invalid
    


//     // [
//     //     // in this case, the break is only in the word scope
//     //     [ true @! ] swap 2 swap % 0 == if
//     //     false
//     //     @>
//     // ] isEven define

    
//     // 6 isEven valid
//     // "hello?>>" .
//     // 5 isEven valid
    
//     // [ nope break] 1 0 < if invalid
//     // break invalid
    
//     // [
//     //     [ red @! ] true if
//     //     cyan
//     //     @>
//     // ] theValue define

//     // [ theValue @! ] 1 0 < if
//     // blue
//     // prints
//     // // blue break 1 0 > if
//     // // red
//     `);

//     // console.log( stack.items );

//     // assert.equal( stack.popValue(), 'red'); 
// });


test('break function', async () => {
    let [stack] = await prep(`
    // only returns false if the value is not even
    [
        [ true @! ] swap 2 swap % 0 == if
        false
        @>
    ] isNotEven define

    6 isNotEven
    5 isNotEven
    3 isNotEven
    2 isNotEven
    `);

    assert.equal( stack.toString(), 'true false false true' );
})


test('defined break', async () => {
    let [stack] = await prep(`
    [
        [ true @! ] swap 2 swap % 0 == if
        false
        @>
    ] isEven define

    6 isEven
    5 isEven
    4 isEven
    `);

    assert.equal( stack.toString(), 'true false true' );
});

test('inner function break', async () => {
    let [stack] = await prep(`
    // [ nothing ] theVoid define

    // TODO - defines must return the break
    // TODO - continue?
    [
        size! 0 == [ drop nothing @! ] swap if
    ] returnUndefinedIfEmpty define

    [
        // returns as inactive - we want this to continue until the word is done
        returnUndefinedIfEmpty
        pop!
        
        // this word causes the stack to be active again
        @>
    ] checkIt define

    [] checkIt
    [ "hello" ] checkIt
    `);

    // console.log( stack.items );
    assert.equal( stack.toString(), '"hello" "nothing"' );
})


test.run();
