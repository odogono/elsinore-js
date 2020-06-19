import {
    isDLogEnabled,
    QueryStack
} from '../stack';
import {
    SType,
    StackValue,
    InstResult, AsyncInstResult,
    StackError,
} from '../types';
import {
    create as createComponentDef, isComponentDef, toShortObject as defToObject
} from '../../../src/component_def';
import {
    isBoolean, isObject, isInteger, isString
} from '../../../src/util/is';

import {
    Entity, isEntity,
} from '../../../src/entity';
import { isComponent, Component, isComponentList, getComponentDefId } from '../../../src/component';


import { createLog } from "../../util/log";
import { stackToString, valueToString, unpackStackValue, unpackStackValueR } from '../util';
import { EntitySet, EntitySetMem } from '../../entity_set';
import { compareDates } from './util';

const Log = createLog('QueryWords');




/**
 * Duplicates the top stack value, or if the op is 'over', duplicates the previous
 * 
 * @param stack 
 * @param op 
 */
export async function onDup<QS extends QueryStack>(stack: QS, op): AsyncInstResult {
    let val = stack.peek();
    if (op === 'over') {
        val = stack.peek(1);
    }

    let out;
    if (val[0] === SType.EntitySet) {
        let es: EntitySet = unpackStackValue(val, SType.EntitySet);
        let dup = await es.clone();
        out = [SType.EntitySet, dup];
    } else {
        // let o = unpackStackValue(val);
        out = [...val];
    }

    return out;
}


export async function onSelect<QS extends QueryStack>(stack: QS): AsyncInstResult {

    let right = stack.pop();
    let left = stack.pop();
    
    let es: EntitySet = unpackStackValue(left, SType.EntitySet);
    let query = unpackStackValue(right, SType.List, false);
    
    let result = await es.select(query, { stack:stack });

    if (result) {
        // append output stack
        // stack = { ...stack, items: [...stack.items, ...result] };
        stack.items = [...stack.items, ...result];
    }

    return undefined;
}

export function onArgError(stack: QueryStack, val: StackValue): InstResult {
    Log.debug('[onArgError]', val);
    throw new StackError('invalid argument');
}


export function onEntity(stack: QueryStack): InstResult {
    let data: StackValue = stack.pop();
    let [type, val] = data;
    const {es} = stack;

    if (type === SType.List) {
        let e = val.reduce((acc, val) => {
            // Log.debug('[onEntity]', Object.keys(stack) );
            let type = val[0];
            if (type === SType.Component) {
                if (!acc) {
                    acc = es !== undefined ? es.createEntity() : new Entity();
                }
                const did = getComponentDefId(val[1]);
                // const def = stack.es.getByDefId(did);
                return acc.addComponentUnsafe(did, val[1]);
            } else if (isInteger(val[1])) {
                return es !== undefined ? es.createEntity(val[1]) : new Entity(val[1]);
            }
        }, null);
        if (isEntity(e)) {
            return [SType.Entity, e];
        }
    } else {
        let e = es !== undefined ? es.createEntity(val) : new Entity(val);
        return [SType.Entity, e];
    }

    // let eid = unpackStackValue(data, SType.Value);

    return undefined;
}


export function onComponent<QS extends QueryStack>(stack: QS): InstResult {
    let data: StackValue = stack.pop();
    let es = stack.findV(SType.EntitySet);

    if (es === undefined) {
        throw new Error('EntitySet not found on stack');
    }
    // cache a reference to the last entityset
    stack.es = es;

    let raw = unpackStackValue(data, SType.List, true);
    let [uri, attrs] = raw;

    // Log.debug('[onComponent]', uri, attrs);
    // Log.debug('[onComponent]', es );

    let com = es.createComponent(uri, attrs);
    // let def = createComponentDef( undefined, ...raw );

    return [SType.Component, com];
}


export function onAddComponentToEntity<QS extends QueryStack>(stack: QS): InstResult {
    let cv: StackValue = stack.pop();
    let ev: StackValue = stack.pop();

    let e: Entity = unpackStackValue(ev, SType.Entity);
    let c: Component = unpackStackValueR(cv, SType.Any);
    const es = stack.es;

    if (Array.isArray(c)) {
        for (const com of c) {
            e = es.addComponentToEntity(e, com);
        }
    } else {
        e = es.addComponentToEntity(e, c);
    }
    // Log.debug('[onAddComponentToEntity]', c );

    return [SType.Entity, e];
}



export async function onAddToEntitySet<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let left = stack.pop();
    let right = stack.pop();

    // DLog(stack, '[onAddToEntitySet]', left );
    let value = unpackStackValue(left);
    // DLog(stack, '[onAddToEntitySet]', isComponentDef(value), value );
    let es: EntitySet = unpackStackValueR(right, SType.EntitySet);


    let values: StackValue[] = left[0] === SType.List ? left[1] : [left];

    // Log.debug('[onAddToEntitySet]', values );
    // sort into defs and e/com
    let defs = [];
    let coms = [];
    for (const value of values) {
        let [type, inner] = value;

        if (type === SType.ComponentDef) {
            if (!isComponentDef(inner)) {
                inner = parseComponentDef(inner);
            }
            defs.push(inner);
        } else if (isEntity(inner) || isComponent(inner)) {
            // Log.debug('[onAddToEntitySet]', inner);
            coms.push(inner);
        }
    }

    for (const def of defs) {
        await es.register(def);
    }

    if (coms.length > 0) {
        const debug = isDLogEnabled(stack);
        // DLog(stack, '[onAddToEntitySet]', coms.length, 'coms', isDLogEnabled(stack) );
        await es.add(coms, { debug });
        // es = isAsync ? await esAdd(es, coms, { debug }) : esAdd(es, coms, { debug });
    }

    // } 
    // catch (err) {
    //     Log.warn('[onAddToEntitySet]', 'error', value, err.stack);
    // }
    return [SType.EntitySet, es];
}


export async function fetchComponentDef<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let val = stack.peek();
    let es = stack.es;

    if (val[0] === SType.EntitySet) {
        es = unpackStackValue(val, SType.EntitySet);
    }

    return [SType.List, es.componentDefs.map(def => [SType.ComponentDef, defToObject(def)])];
}


// export function onAddDefToES( stack:QueryStack, val:StackValue ):InstResult {
//     let def, es;
//     [stack,[,def]] = pop(stack);
//     [stack,[,es]] = pop(stack);

//     [es, def] = register( es, def )

//     return [ SType.EntitySet, es];
// }


export function onComponentDef<QS extends QueryStack>(stack: QS): InstResult {
    let data: StackValue = stack.pop();

    let raw;// = unpackStackValue(data);
    const [type] = data;
    if (type === SType.List) {
        raw = unpackStackValueR(data, SType.List);
    } else if (type === SType.Map) {
        raw = [unpackStackValueR(data, SType.Map)];
    } else if (type === SType.Value) {
        raw = unpackStackValueR(data, SType.Any);
        raw = [raw];
    }

    return [SType.ComponentDef, parseComponentDef(raw)];
}

function parseComponentDef(data: any[]) {
    // ensure props are wrapped in an array
    let [uri, props] = data;
    if (props !== undefined && !Array.isArray(props)) {
        Log.debug('[onComponentDef]', data);
        throw new StackError(`onComponentDef : properties should be wrapped in array: ${uri}`);
    }

    return createComponentDef(undefined, ...data);
}




export async function onPrint<QS extends QueryStack>(stack: QS, val: StackValue): AsyncInstResult {
    let msg;
    const [, op] = val;
    if (op === '..') {
        console.info('[onPrint][stack]', '(', stackToString(stack), ')');
    } else {
        let msg = stack.pop();
        // if( msg[0] === SType.List ){
        //     await stack.pushValues( msg[1] );
        // }
        // console.log( '[onPrint]', msg );
        console.info('[onPrint]', stack.id, unpackStackValueR(msg));
    }
    return undefined;
}

export function onAddArray<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {

    let left = stack.pop();
    let right = stack.pop();
    let [type, arr] = right;
    arr = [...arr, left];
    return [type, arr];
}

export function onFetchArray<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    let left = stack.pop();
    let right = stack.pop();
    let arr = unpackStackValue(right, SType.List);
    let idx = unpackStackValue(left, SType.Value);
    return arr[idx];
}


export function onRegex(stack:QueryStack, [,op]:StackValue): InstResult {
    let regex:RegExp = stack.popValue();
    let val = stack.popValue();

    // console.log('[onRegex]', regex, val );

    let value = false;
    if( op === 'split' ){
        value = isString(val) ? val.split(regex) : val;
    }
    else if( op === '==' ){
        value = regex.test(val);
    } else if( op === '!=' ){
        value = !regex.test(val);
    }

    return [SType.Value, value];
}

export function onDateTime(stack:QueryStack, [,op]:StackValue): InstResult {
    let dateA = stack.popValue();
    let dateB = stack.popValue();
    
    let value = compareDates(op, dateA, dateB);
    
    return [SType.Value, value];
}



export function onAdd(stack: QueryStack, [,op]: StackValue): InstResult {
    
    let left = stack.popValue();
    let right = stack.popValue();

    let value = left;
    switch (op) {
        case '+': value = left + right; break;
        case '*': value = left * right; break;
        case '-': value = left - right; break;
        case '%': value = left % right; break;
        case '==': value = left === right; break;
        case '!=': value = left !== right; break;
    }

    return [SType.Value, value];
}

export function onMapOpen(stack: QueryStack): InstResult {
    let sub = new QueryStack();
    // Log.debug('[onMapOpen]', stack.items);//Object.keys(stack.words));
    // DLog(stack, '[onMapOpen]', stack.items );

    stack.setChild(sub);

    // sub._parent = stack;
    // sub._root = stack._root ? stack._root : stack;
    // Log.debug('[onMapOpen]', {id:sub.id, parent:sub._parent?.id,root:sub._root?.id}, stackToString(stack) );

    // add something which will interpret each push
    sub.addWords([
        ['{', onMapOpen],
        ['[', onListOpen],
        ['}', onMapClose],
        [']', onUnexpectedError],
    ], true);
    // throw 'stop';
    // (sub as any)._stack = stack;
    // Log.debug('[onMapOpen]', {id:sub.id, parent:stack.id});
    return undefined;
}

export function onUnexpectedError<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    throw new StackError(`unexpected word '${val}'`);
}

export function onMapClose<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    // if( stack.id === 158 ){
    //     Log.debug('[onMapClose]', {id:stack.id, parent:stack._parent?.id}, stackToString(stack) );
    //     Log.debug('[onMapClose]', stack);
    // }

    let map = stack.items.reduce((result, val, idx, array) => {
        if (idx % 2 === 0) {
            let key = unpackStackValue(val);
            let mval = array[idx + 1];
            // console.log('key!', key, array);
            result[key] = mval === undefined ? [SType.Value, undefined] : mval;
        }
        return result;
    }, {});
    val = [SType.Map, map];
    // Log.debug('[onMapClose]', {id:stack.id, parent:stack._parent.id});
    // stack = stack._parent;
    stack.restoreParent();
    return val;
}

export function onListOpen(stack: QueryStack): InstResult {
    let sub = new QueryStack();
    // sub._parent = stack;
    // sub._root = stack._root ? stack._root : stack;
    stack.setChild(sub);
    // Log.debug('[onListOpen]', {id:sub.id, parent:sub._parent?.id,root:sub._root?.id}, stackToString(stack) );
    // Log.debug('[onListOpen]', {id:sub.id});
    // sub.words = {...stack.words};
    sub.addWords([
        ['{', onMapOpen],
        ['[', onListOpen],
        [']', onListClose],
        ['}', onUnexpectedError],
        // ['arse', onUnexpectedError],
    ], true);
    return undefined;
}

export function onListClose<QS extends QueryStack>(stack: QS): InstResult {
    // Log.debug('[onListClose]', {id:stack.id, parent:stack._parent?.id}, stackToString(stack) );
    let val: StackValue = [SType.List, stack.items];
    // stack = stack._parent;
    // let id = stack.id;
    // if( id === 3 ){
    //     Log.debug('[onListClose]', 'was', id, 'is', stack._root );
    // }
    stack.restoreParent();
    return val;
}

export async function onListSpread<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let val = stack.pop();
    let value = unpackStackValueR(val, SType.List).map(v => [SType.Value, v]);

    // if( val[0] === SType.List ){
    //     value = value.map( v => [Array.isArray(v) ? SType.List : SType.Value, v] );
    // stack = { ...stack, items: [...stack.items, ...value] };
    // Log.debug('[onArraySpread]', value);
    await stack.pushValues(value);
    // }
    return undefined;
}

export function onValue<QS extends QueryStack>(stack: QS): InstResult {
    let val = stack.pop();
    let value = unpackStackValueR(val);
    if (val[0] === SType.List) {
        value = value.map(v => [Array.isArray(v) ? SType.List : SType.Value, v]);
        // stack = { ...stack, items: [...stack.items, ...value] };
        stack.items = [...stack.items, ...value];
    }
    return undefined;
}


/**
 * Creates an array from the values on the stack, providing they are of the 
 * same type
 * 
 * @param stack 
 * @param val 
 */
export function onConcat<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    let values: StackValue[];
    let first = stack.pop();
    let type: SType = first[0]; //unpackStackValue(first, SType.Value);

    values = stack.popOfType(type);

    values = [first, ...values];

    return [SType.List, values];
}

export function onBuildMap<QS extends QueryStack>(stack: QS): InstResult {
    let values: StackValue[];
    let left = stack.pop();
    let array = unpackStackValue(left, SType.List, false);



    let map = array.reduce((result, val, idx, array) => {
        if (idx % 2 === 0) {
            let key = unpackStackValue(val, SType.Value);
            let mval = array[idx + 1];
            // Log.debug('[onBuildMap]', key, mval );
            result[key] = mval === undefined ? [SType.Value, undefined] : mval;
        }
        return result;
    }, {});

    // Log.debug('[onBuildMap]', map );

    return [SType.Map, map];
}

export function onToString(stack: QueryStack): InstResult {
    let val = stack.pop();
    let str = valueToString(val);

    return [SType.Value, str];
}

export async function onFilter<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let fn: StackValue = stack.pop();
    let list = stack.pop();

    list = unpackStackValue(list, SType.List);
    fn = unpackStackValue(fn, SType.List);

    let mapStack = new QueryStack(stack);
    let accum = [];

    for (const val of list) {
        await mapStack.push(val);
        await mapStack.pushValues(fn as any);

        // Log.debug('[onFilter]', 'end', mapStack.items );
        let out = mapStack.pop();
        if (isTruthy(out)) {
            accum = [...accum, val];
        }
    }

    return [SType.List, accum];
}

export async function onMap<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let right = stack.pop();
    let left = stack.pop();

    let list = unpackStackValue(left, SType.List);
    let fn = unpackStackValue(right, SType.List);

    let mapStack = new QueryStack(stack);

    for( const val of list ){
        await mapStack.push(val);
        await mapStack.pushValues(fn);
    }

    return [SType.List, mapStack.items];
}

export async function onReduce<QS extends QueryStack>(stack: QS): AsyncInstResult {

    let right = stack.pop();
    let accum = stack.pop();
    let left = stack.pop();

    let list = unpackStackValue(left, SType.List);
    accum = unpackStackValue(accum, SType.Any);
    let fn = unpackStackValue(right, SType.List);

    let mapStack = new QueryStack(stack);

    for( const val of list ){
        await mapStack.push(val);
        await mapStack.push(accum);
        await mapStack.pushValues(fn);

        accum = mapStack.pop();
    }

    return accum;
}

export function onUnique<QS extends QueryStack>(stack: QS): InstResult {
    let val = stack.pop();
    let array = unpackStackValueR(val, SType.List);
    return [SType.List, [...new Set([...array].sort())].map(v => [SType.Value, v])];
}

export function onPush<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    let rv = stack.pop();
    let lv = stack.pop();

    let list = unpackStackValue(lv, SType.List);

    // Log.debug('[onPush]', list, rv );

    list = [...list, rv];

    return [SType.List, list];
}

export function onPop<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    let lv = stack.pop();

    let list = unpackStackValue(lv, SType.List);
    const len = list.length;
    if (len === 0) {
        throw new StackError('stack underflow');
    }
    let value = list[len - 1];
    return value;
}





export function onSwap<QS extends QueryStack>(stack: QS): InstResult {
    let left = stack.pop();
    let right = stack.pop();

    stack.pushRaw(left);
    stack.pushRaw(right);

    return undefined;
}

export function onDrop<QS extends QueryStack>(stack: QS): InstResult {
    stack.pop();
    return undefined;
}


export function onClear<QS extends QueryStack>(stack: QS): InstResult {
    stack.items = [];
    return undefined;
};

export function onVersion<QS extends QueryStack>(stack: QS): InstResult {
    return [SType.Value, '1.0.0'];
};


export function onAssertType<QS extends QueryStack>(stack: QS): InstResult {
    let value: StackValue = stack.pop();
    let type = unpackStackValue(value, SType.Value);
    value = stack.peek();
    if (value === undefined) {
        throw new Error(`[onAssertType] stack underflow`);
    }
    if (value[0] !== type) {
        throw new Error(`[onAssertType] expected type ${type}, got ${value}`);
    }
    return undefined;
}

// export function onAssert( stack:QueryStack, val:StackValue ):InstResult {
//     // Log.debug('[assert]', val);
//     [stack,val] = pop(stack);
//     assert( val[1], `failed to assert value ${val}` );
//     return undefined;
// }


function isTruthy(value: StackValue): boolean {
    const [type, val] = value;
    if (isBoolean(val)) {
        return val;
    }
    return false;
}

function compareValues(left: StackValue, right: StackValue): boolean {
    if (!Array.isArray(left) || !Array.isArray(right)) {
        return false;
    }
    if (left[0] !== right[0]) {
        return false;
    }
    if (left[1] !== right[1]) {
        return false;
    }
    return true;
}


