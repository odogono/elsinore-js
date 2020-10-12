import { StackValue, InstResult, AsyncInstResult, SType, StackError } from "../types";
import { QueryStack } from "../stack";
import { unpackStackValueR } from "../util";


/**
 * 
 * @param stack 
 * @param param1 
 */
export async function onLoop(stack: QueryStack, [, op]: StackValue): AsyncInstResult {
    let val = stack.pop();
    let value = unpackStackValueR(val, SType.List);

    // log( value );

    let count = 0;
    let limit = 10000; // this will definitely cause an issue later
    let isLooping = true;
    let result:StackValue = undefined;

    while( count < limit && isLooping ){
        // log('>--');
        // stack.debug = true;
        await stack.pushValues(value);
        result = stack.pop();

        // log('result:', result);
        // log('stack:', stack.toString());
        // if there is nothing on the stack, safest
        // to exit
        if( result === undefined ){
            isLooping = false;
        } else {
            isLooping = result[1] === true;
        }
        count++;
    }

    if( count >= limit ){
        throw new StackError('loop out of control');
    }

    // log('finished at', count, '/', limit )

    // await stack.pushValues(value);
    
    // log('finished with', result);

    return result;
};


const log = (...args) => console.log('[onLoop]', ...args);