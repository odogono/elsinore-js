import { QueryStack, StackValue, SType } from "./stack";
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
            return type;
        case SType.ComponentDef:
            return `(${type} ${value.uri})`;
        case SType.Component:
            return `(${type} ${getComponentId(value)})`;
        case SType.Entity:
            return `(${type} ${getEntityId(value)})`;
        case SType.Array:
            return `[` + value.map(v => valueToString(v) ).join(' ') + ']';
        case SType.Map:
            return '{' + Object.keys(value).reduce( (res,key) => {
                return [...res, `${key}: ${valueToString(value[key])}`];
            },[]).join(',') + '}';
        default:
            return stringify(value);
    }
}
