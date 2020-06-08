import { QueryStack, StackValue, SType } from "./types";
import { getComponentId } from "../component";
import { getEntityId } from "../entity";
import { stringify } from "../util/json";

export function stackToString( stack:QueryStack ):string {
    let parts = stack.items.map( val => valueToString(val) );
    return parts.join(' ');
}

export function valueToString( val:StackValue ):string {
    const [type,value] = val;
    // Log.debug('[valueToString]', type, value);
    switch( type ){
        case SType.EntitySet:
            return `${type}.${value.type}`;//(${value.esSize(value)})`;
        case SType.ComponentAttr:
            return `(${type}, ${stringify(value)})`;
        case SType.ComponentDef:
            return `(${type} ${value.uri})`;
        case SType.Component:
            if( Array.isArray(value) ){
                return `[${type},` + value.map( v => stringify(v) ).join(', ') + ']';
            }
            return `(${type} ${getComponentId(value)})`;
        case SType.Entity:
            if( Array.isArray(value) ){
                return `(${type} ${stringify(value)})`;
            }
            return `(${type} ${getEntityId(value)})`;
        case SType.List:
            return `[` + value.map(v => valueToString(v) ).join(', ') + ']';
        case SType.Map:
            return '{' + Object.keys(value).reduce( (res,key) => {
                return [...res, `${key}: ${valueToString(value[key])}`];
            },[]).join(',') + '}';
        case SType.Value:
            return `${(value)}`;
        case SType.Filter:
            let [op,left,right] = value;
            return `${op} ${valueToString(left)} ${valueToString(right)}`;
        // case SType.Undefined:
        //     return `undefined`;
        default:
            return val.length === 2 ? `(${type}, ${stringify(value)})` : stringify(val);
    }
}




export function unpackStackValue(val: StackValue, assertType: (SType | SType[]) = SType.Any, recursive: boolean = false): any {
    let [type, value] = val;
    if (!Array.isArray(assertType)) {
        assertType = [assertType];
    }

    if (assertType.indexOf(SType.Any) === -1 && assertType.indexOf(type) === -1) {
        throw new Error(`expected type ${assertType}, got ${type}`);
    }

    // Log.debug('[unpackStackValue]', type, val);
    if (type === SType.List) {
        return recursive ? value.map(av => unpackStackValue(av, SType.Any, true)) : value;
    }
    if (type === SType.Map) {
        return recursive ? Object.keys(value).reduce((res, key) => {
            return { ...res, [key]: unpackStackValue(value[key], SType.Any, true) }
        }, {}) : value;
    } else {
        // Log.debug('[unpackStackValue]', 'wat', value);
        return value;
    }
}

export function unpackStackValueR(val: StackValue, assertType: SType = SType.Any) {
    return unpackStackValue(val, assertType, true);
}