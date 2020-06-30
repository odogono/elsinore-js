import { QueryStack } from "../stack";
import { StackValue, InstResult } from "../types";





export function onCondition(stack: QueryStack, [, op]: StackValue): InstResult {
    const condVal = stack.pop();
    const ifVal = stack.pop();
    const elseVal = stack.pop();

    let is = condVal[1];

    return is ? ifVal : elseVal;
}