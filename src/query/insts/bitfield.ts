import { createLog } from "../../util/log";
import { InstDefMeta, QueryStack, pop, StackValue, InstResult, StackValueCompiled, StackOp, findWithIndex } from "../stack";
import { BitField } from "odgn-bitfield";
import { VL } from "./value";
import { StackList } from "./stack";
import { isString, isInteger } from "../../util/is";
import { Type as ComponentRegistryT, resolveComponentDefIds } from "../../../src/component_registry";

const Log = createLog('Inst][BitField');

export const BFs = '!bf';
export const BF = '@bf';

export const meta:InstDefMeta = {
    op: [BF, BFs]
};

export function execute( stack:QueryStack, [op,arg]:StackValue ):InstResult {
    arg = parseArg(stack,arg);
    if( op === BF || arg !== undefined ){
        return [stack,[op, arg ]];
    }

    let value:StackValue;
    let bf = BitField.create();

    [stack,value] = pop(stack);
    bf = parseArg(stack,value);

    // if( op === VL ){
    //     bf = applyValue(bf,[op,arg])
    // }
    // else if( op === StackList ){
    //     bf = arg.reduce( (bf,val) => applyValue(bf,val), bf );
    if( bf === undefined) {
        throw new Error(`invalid bitfield value ${op}`);
    }

    return [stack, [BF, bf]];
}

function parseArg(stack:QueryStack, arg:any){

    if( isInteger(arg) ){
        return BitField.create(arg);
    }
    else if( BitField.isBitField(arg) ){
        return arg;
    }
    else if( Array.isArray(arg) ){
        let op:StackOp;
        let bf = BitField.create();
        [op,arg] = arg;
        if( op === VL ){
            bf = applyValue(bf,[op,arg])
        }
        else if( op === StackList ){
            bf = arg.reduce( (bf,val) => applyValue(bf,val), bf );
        } else {
            throw new Error(`invalid bitfield value ${op}`);
        }
        return bf;
    } else if( isString(arg) ){
        let [idx,[,reg]] = findWithIndex(stack, ComponentRegistryT ); 
        if( idx === -1 ){
            return BitField.create();
        }
        return resolveComponentDefIds( reg, arg );
    }
    return undefined;
}

export function executeAdd( stack:QueryStack, left:StackValue, right:StackValue ): InstResult {
    let [lop,bf] = left;

    // Log.debug('[executeAdd]', right )
    bf = applyValue( bf, right );

    return [stack, [lop,bf]];
}

export function executeSubtract( stack:QueryStack, left:StackValue, right:StackValue ): InstResult {
    let [lop,bf] = left;

    bf = applyValue( bf, right, (bf,val) => bf.set(val,false) );

    return [stack, [lop,bf]];
}

export function toStringValue( stack:QueryStack, [op,bf]:StackValue ): InstResult {
    return [stack, [VL, bf.toString()]];
}

export function toListValue( stack:QueryStack, [op,bf]:StackValue ): InstResult {
    return [stack, [StackList, bf.toValues()]];
}

function applyValue( bf:BitField, [op,arg]:StackValue, applyFn?:(bf:BitField, arg:any) => BitField ): BitField {

    applyFn = applyFn || ((bf,val) => bf.set(val));

    if( op === VL ){
        if( isString(arg) ){

        }
        else {
            return applyFn( bf, arg );
        }
    } else if( op === StackList ){
        return (arg as any[]).reduce( (bf,arg) => applyValue(bf,arg,applyFn), bf);
    }

    return bf;
}