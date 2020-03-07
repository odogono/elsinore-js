import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta } from "../stack";

const Log = createLog('Inst][Value');

export const VL = Symbol.for('VL');

export const meta:InstDefMeta = {
    op: 'VL'
};

export function compile() {
}

export function execute( stack:QueryStack, uri, properties ) {

}

export function valueOf( value:(['VL', any]|any) ): any {
    if( Array.isArray(value) && value[0] === 'VL' ){
        return value[1];
    }
    return value;
}