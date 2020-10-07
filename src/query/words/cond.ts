import { QueryStack } from "../stack";
import { StackValue, InstResult } from "../types";





/**
 * <val> cond
 * @param stack 
 * @param param1 
 */
export function onCondition(stack: QueryStack, [, op]: StackValue): InstResult {
    const condVal = stack.pop();
    const ifVal = stack.pop();
    const elseVal = stack.pop();

    let is = condVal[1];

    return is ? ifVal : elseVal;
}