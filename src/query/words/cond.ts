import { QueryStack } from "../stack";
import { StackValue, InstResult, AsyncInstResult } from "../types";





/**
 * <else> <then> <condition> iif
 *
 */
export async function onCondition(stack: QueryStack, [, op]: StackValue): AsyncInstResult {
    const isIfElse = op !== 'if';
    const condVal = stack.pop();
    const ifVal = stack.pop();
    const elseVal = isIfElse ? stack.pop() : undefined;
    const condition = condVal[1];

    // console.log('[onCondition]', condVal, ifVal, elseVal );
    
    // if( condition ){
    //     console.log('[onCondition]', 'result', ifVal );
    // } else {
    //     console.log('[onCondition]', 'result', elseVal );
    // }

    if( isIfElse ){
        await stack.push( condition ? ifVal : elseVal );
    } else if( condition ) {
        await stack.push( ifVal );
    }
    
    // return condVal[1] ? ifVal : elseVal;
    return undefined;
}
