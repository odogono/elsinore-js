import { StackValue, SType } from "./types";
import { getComponentId } from "../component";
import { getEntityId } from "../entity";
import { stringify } from "../util/json";
import { QueryStack } from "./stack";


export interface ToStringOptions {
    flat?: boolean;
}

export function stackToString(stack: QueryStack, reverse:boolean = true): string {
    let parts = stack.items.map(val => valueToString(val));
    if( reverse ){
        parts.reverse();
    }
    return parts.join(' ');
}

export function valueToString(val: StackValue, listToString:boolean = false): string {
    const [type, value] = val;
    const strCheck = /^[a-z0-9\/_$]+$/i;

    // Log.debug('[valueToString]', type, value);
    switch (type) {
        case SType.EntitySet:
            return `${type}.${value.type}`;//(${value.esSize(value)})`;
        case SType.ComponentAttr:
            return `(${type}, ${stringify(value)})`;
        case SType.ComponentDef:
            return `(${type} ${value.uri})`;
        case SType.Component:
            if (Array.isArray(value)) {
                return `[${type},` + value.map(v => stringify(v)).join(', ') + ']';
            }
            return `(${type} ${getComponentId(value)})`;
        case SType.Entity:
            if (Array.isArray(value)) {
                return `(${type} ${stringify(value)})`;
            }
            return String(getEntityId(value));
        case SType.List:
            if( listToString ){
                return value.map(v => valueToString(v,listToString)).join(' ');
            }
            return `[` + value.map(v => valueToString(v)).join(', ') + ']';
        case SType.Map:
            return '{' + Object.keys(value).reduce((res, key) => {
                return [...res, `"${key}": ${valueToString(value[key])}`];
            }, []).join(',') + '}';
        case SType.Value:
            return strCheck.test(value) ? JSON.stringify(value) : value;
            // return JSON.stringify(value);
        case SType.Filter:
            let [op, left, right] = value;
            return `${op} ${valueToString(left)} ${valueToString(right)}`;
        // case SType.Undefined:
        //     return `undefined`;
        case SType.Regex:
            return '~r/' + value.toString() + '/';
        case SType.DateTime:
            return '~d|' + value.toISOString() + '|';
        default:
            return val.length === 2 ? `(${type}, ${stringify(value)})` : stringify(val);
    }
}



/**
 * 
 * @param val 
 * @param assertType 
 * @param recursive 
 */
export function unpackStackValue(val: StackValue, assertType: (SType | SType[]) = SType.Any, recursive: boolean = false): any {
    let [type, value] = val;
    if (!Array.isArray(assertType)) {
        assertType = [assertType];
    }

    if (assertType.indexOf(SType.Any) === -1 && assertType.indexOf(type) === -1) {
        throw new Error(`expected type ${assertType}, got ${type}`);
    }

    switch (type) {
        case SType.List:
            // console.log('[unpackStackValue]', type, value);
            // console.log('[unpackStackValue]', type, value);
            return recursive ? value.map(av => unpackStackValue(av, SType.Any, true)) : value;
        case SType.Map:
            return recursive ? Object.keys(value).reduce((res, key) => {
                return { ...res, [key]: unpackStackValue(value[key], SType.Any, true) }
            }, {}) : value;
        case SType.Value:
        case SType.Any:
        case SType.Entity:
        case SType.EntitySet:
        case SType.BitField:
        case SType.Component:
        case SType.Function:
        case SType.Filter:
        case SType.ComponentAttr:
        case SType.ComponentDef:
        case SType.Regex:
        case SType.DateTime:
            return value;
        default:
            return val;
    }
}

/**
 * 
 * @param val 
 * @param assertType 
 */
export function unpackStackValueR(val: StackValue, assertType: SType = SType.Any) {
    return unpackStackValue(val, assertType, true);
}