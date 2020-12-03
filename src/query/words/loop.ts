import { StackValue, InstResult, AsyncInstResult, SType, StackError } from "../types";
import { QueryStack } from "../stack";
import { unpackStackValue, unpackStackValueR } from "../util";


/**
 * 
 * @param stack 
 * @param param1 
 */
export async function onLoop(stack: QueryStack, [, op]: StackValue): AsyncInstResult {
    let val = stack.pop();
    let value = unpackStackValue(val, SType.List);
    const wasActive = stack.isActive;

    // log( value );

    let count = 0;
    let limit = 10000; // yep, this will definitely cause an issue later
    let isLooping = true;
    let result:StackValue = undefined;

    while( count < limit && isLooping ){
        
        await stack.pushValues(value);
        
        result = stack.size > 0 ? stack.pop() : undefined;

        // log('result:', result );//, 'out', out );

        if( stack.isActive === false ){
            // bit of a hack - mostly because we are
            // looping on the main stack and not creating a substack

            // log('stack inactive', wasActive);
            isLooping = false;
            if( wasActive ){
                stack.isActive = true;
            }
            break;
        }
        // log('stack:', stack.toString());
        // if there is nothing on the stack, safest
        // to exit
        if( result === undefined ){
            isLooping = false;
        } else {
            isLooping = result[1] === true;
        }
        // if( isLooping === false ){
            // log('stack', stack.items);
        // }
        count++;
    }

    if( count >= limit ){
        throw new StackError(`loop out of control ${count} > ${limit}`);
    }

    // log('finished at', count, '/', limit )

    // await stack.pushValues(value);
    
    // log('finished with', result);

    return result;
};


const log = (...args) => console.log('[onLoop]', ...args);