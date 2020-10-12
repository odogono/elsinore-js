import { QueryStack } from "../stack";
import { StackValue, InstResult } from "../types";





/**
 * <else> <then> <condition> iif
 *
 */
export function onCondition(stack: QueryStack, [, op]: StackValue): InstResult {
    const condVal = stack.pop();
    const ifVal = stack.pop();
    const elseVal = stack.pop();

    // console.log('[onCondition]', condVal, ifVal, elseVal );
    let is = condVal[1];

    return is ? ifVal : elseVal;
}
