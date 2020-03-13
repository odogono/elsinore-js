import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    pop,
    push, StackValue, peek, InstResult, } from "../stack";
import { VL, valueOf } from "./value";

const Log = createLog('Inst][Attribute');

// export const Type = '==';

export const meta:InstDefMeta = {
    op: 'AT'
};

export function execute( stack:QueryStack, op, args  ):InstResult {
    // Log.debug(args);
    return [stack, [op,args]];
}