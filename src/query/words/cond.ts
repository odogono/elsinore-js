import { QueryStack } from "../stack";
import { StackValue, InstResult, AsyncInstResult } from "../types";





/**
 * <else> <then> <condition> iif
 *
 */
export async function onCondition(stack: QueryStack, [, op]: StackValue): AsyncInstResult {
    const condVal = stack.pop();
    const ifVal = stack.pop();
    const elseVal = stack.pop();

    // console.log('[onCondition]', condVal, ifVal, elseVal );
    // let is = condVal[1];

    // if( condVal[1] ){
    //     console.log('[onCondition]', 'result', ifVal );
    // } else {
    //     console.log('[onCondition]', 'result', elseVal );
    // }

    await stack.push( condVal[1] ? ifVal : elseVal );
    
    // return condVal[1] ? ifVal : elseVal;
    return undefined;
}
