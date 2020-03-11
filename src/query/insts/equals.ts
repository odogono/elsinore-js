import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, pushV as pushQueryStack, } from "../stack";
import { VL, valueOf } from "./value";

const Log = createLog('Inst][Equals');

export const EQ = Symbol.for('==');

export const meta:InstDefMeta = {
    op: '=='
};

export function compile() {
}

export function execute( stack:QueryStack, op:string, left:[], right:[] ) {
    // Log.debug('[execute]', left, right );
    const leftV = valueOf(left);
    const rightV = valueOf(right);

    stack = pushQueryStack( stack, leftV === rightV, VL );

    return stack;
}