import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    pushV as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta
} from "../stack";
import {
    Code as ComponentRegistryCode,
    Type as ComponentRegistryT, getComponentDefs 
} from "../../component_registry";
import { Token as ComponentDefT } from '../../component_def';

import { VL, valueOf } from "./value";

const Log = createLog('Inst][Select');

export const EQ = Symbol.for('AL');

export const meta:InstDefMeta = {
    op: 'AL'
};

export function compile() {
}


/**
 * Forms:
 * AL <defId> <args>
 * AL <defId>
 * AL <@d>
 */
export function execute( stack:QueryStack, op:string, ...args ) {
    // Log.debug('[execute]', args );

    if( args[0] === ComponentRegistryCode ){
        return executeSelectDefs( stack );       
    }

    // const leftV = valueOf(left);
    // const rightV = valueOf(right);

    // stack = pushQueryStack( stack, leftV === rightV, VL );

    return stack;
}


function executeSelectDefs( stack:QueryStack ):QueryStack {

    // find the component registry
    let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    const defs = getComponentDefs(registry);

    return defs.reverse().reduce( (st, def) => {
        return pushQueryStack( st, def, ComponentDefT );
    }, stack );
}