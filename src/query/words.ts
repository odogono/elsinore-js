import {
    create as createQuery,
    SType,
    addWords,
    pushValues,
    QueryStack,
    StackValue,
    InstResult, AsyncInstResult,
    push, pop, peek, pushRaw,
    findV,
    clone as cloneStack,
    StackError,
    assertStackValueType,
    isStackValue,
    DLog,
    popOfType,
    isDLogEnabled
} from './stack';
import { create as createComponentDef, isComponentDef, toShortObject as defToObject } from '../../src/component_def';
import { isString, isBoolean, isObject, isInteger } from '../../src/util/is';
import { register, createComponent, getByDefId } from '../../src/entity_set/registry';
import {
    Entity, create as createEntityInstance, isEntity,
    addComponentUnsafe
} from '../../src/entity';
import { isComponent, Component, isComponentList, getComponentDefId } from '../../src/component';
import {
    create as createEntitySet,
    add as addToES,
    isEntitySet,
    createEntity,
    EntitySet,
    size as entitySetSize,
    addComponentToEntity
} from '../../src/entity_set';

import { createLog } from "../util/log";
import { stackToString } from './util';

const Log = createLog('QueryWords');

type Result<QS extends QueryStack> = InstResult<QS>;
type AsyncResult<QS extends QueryStack> = Promise<InstResult<QS>>;


/**
 * Duplicates the top stack value, or if the op is 'over', duplicates the previous
 * 
 * @param stack 
 * @param op 
 */
export async function onDup<QS extends QueryStack>(stack: QS, op): AsyncResult<QS> {
    let val = peek(stack);
    if (op === 'over') {
        val = peek(stack, 1);
    }

    let out;
    if (val[0] === SType.EntitySet) {
        let es: EntitySet = unpackStackValue(val, SType.EntitySet);
        let dup = await es.esClone(es);
        out = [SType.EntitySet, dup];
    } else {
        // let o = unpackStackValue(val);
        out = [...val];
    }

    return [stack, out];
}


export async function onSelect<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let left, right;

    [stack, right] = pop(stack);
    [stack, left] = pop(stack);
    // left = peek(stack);

    let es: EntitySet = unpackStackValue(left, SType.EntitySet);
    let query = unpackStackValue(right, SType.Array, false);
    // const {words} = stack;
    // Log.debug('[onSelect]', query );
    // Log.debug('[onSelect]', stack.words );

    // let words = Object.keys(stack.words).reduce( (out,word) => { 
    //     let spec = stack.words[word];
    //     for( let en of spec ){
    //         let [fn, clauses ] = en;
    //         out = [...out, [word, fn, ...clauses]];
    //     }
    //     return out;
    // },[]);

    let result = await es.esSelect(es, query, { stack });

    if (result) {
        // append output stack
        stack = { ...stack, items: [...stack.items, ...result] };
    }

    return [stack];
}

export function onArgError<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    Log.debug('[onArgError]', val);
    throw new StackError('invalid argument');
}


export function onEntity<QS extends QueryStack>(stack: QS): Result<QS> {
    let data: StackValue;
    [stack, data] = pop(stack);
    let [type, val] = data;

    if (type === SType.Array) {
        let e = val.reduce( (acc,val) => {
            // Log.debug('[onEntity]', val);
            let type = val[0];
            if( type === SType.Component ){
                if( !acc ){
                    acc = createEntityInstance();
                }
                const did = getComponentDefId(val[1]);
                const def = getByDefId(stack.es, did);
                return addComponentUnsafe( acc, did, val[1], def.name );
            } else if( isInteger(val[1]) ){
                return createEntityInstance(val[1]);
            }
        },null);
        if( isEntity(e) ){
            return [stack, [SType.Entity, e]];
        }
    } else {
        let e = createEntityInstance(val);
        return [stack, [SType.Entity, e]];
    }

    // let eid = unpackStackValue(data, SType.Value);

    return [stack];
}


export function onComponent<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let data: StackValue;

    [stack, data] = pop(stack);
    let es = findV(stack, SType.EntitySet);

    if (es === undefined) {
        throw new Error('EntitySet not found on stack');
    }
    // cache a reference to the last entityset
    stack.es = es;

    let raw = unpackStackValue(data, SType.Array, true);
    let [uri, attrs] = raw;

    // Log.debug('[onComponent]', uri, attrs);
    // Log.debug('[onComponent]', es );

    let com = createComponent(es, uri, attrs);
    // let def = createComponentDef( undefined, ...raw );

    return [stack, [SType.Component, com]];
}

export function unpackStackValue(val: StackValue, assertType: SType = SType.Any, recursive: boolean = false): any {
    let [type, value] = val;
    if (assertType !== SType.Any && type !== assertType) {
        throw new Error(`expected type ${assertType}, got ${type}`);
    }
    // Log.debug('[unpackStackValue]', type, val);
    if (type === SType.Array) {
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

export function onAddComponentToEntity<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let ev: StackValue, cv: StackValue;

    [stack, cv] = pop(stack);
    [stack, ev] = pop(stack);

    let e: Entity = unpackStackValue(ev, SType.Entity);
    let c: Component = unpackStackValueR(cv, SType.Any);
    const es = stack.es;

    if (Array.isArray(c)) {
        for( const com of c ){
            // const did = getComponentDefId(com);
            // const def = getByDefId(es,did);
            // e = addComponentUnsafe(e, did, com, def.name );
            e = addComponentToEntity(es, e, com);
        }
        // e = c.reduce((e, c) => addComponentToEntity(e, c), e);
    } else {
        e = addComponentToEntity(es, e, c);
    }
    // Log.debug('[onAddComponentToEntity]', c );

    return [stack, [SType.Entity, e]];
}



export async function onAddToEntitySet<QS extends QueryStack>(stack: QS): AsyncInstResult<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);

    // DLog(stack, '[onAddToEntitySet]', left );
    let value = unpackStackValue(left);
    // DLog(stack, '[onAddToEntitySet]', isComponentDef(value), value );
    let es: EntitySet = unpackStackValueR(right, SType.EntitySet);

    // try {
        const { esAdd, esRegister, isAsync } = es;

        let values: StackValue[] = left[0] === SType.Array ? left[1] : [left];
        
        // Log.debug('[onAddToEntitySet]', values );
        // sort into defs and e/com
        let defs = [];
        let coms = [];
        for( const value of values ){
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

        for( const def of defs ){
            [es] = isAsync ? await esRegister(es, def) : esRegister(es, def);
        }

        if( coms.length > 0 ){
            const debug = isDLogEnabled(stack);
            // DLog(stack, '[onAddToEntitySet]', coms.length, 'coms', isDLogEnabled(stack) );
            es = isAsync ? await esAdd(es, coms, {debug}) : esAdd(es, coms, {debug});
        }

    // } 
    // catch (err) {
    //     Log.warn('[onAddToEntitySet]', 'error', value, err.stack);
    // }
    return [stack, [SType.EntitySet, es]];
}


export async function fetchComponentDef<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let val = peek(stack);
    let es = stack.es;

    if (val[0] === SType.EntitySet) {
        es = unpackStackValue(val, SType.EntitySet);
    }

    return [stack, [SType.Array, es.componentDefs.map(def => [SType.ComponentDef, defToObject(def)])]];
}


// export function onAddDefToES( stack:QueryStack, val:StackValue ):InstResult {
//     let def, es;
//     [stack,[,def]] = pop(stack);
//     [stack,[,es]] = pop(stack);

//     [es, def] = register( es, def )

//     return [stack, [SType.EntitySet, es] ];
// }

export function onEntitySet<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let data: StackValue;

    [stack, data] = pop(stack);

    let options = unpackStackValueR(data, SType.Map);
    let es = createEntitySet(options);

    return [stack, [SType.EntitySet, es]];
}

export function onComponentDef<QS extends QueryStack>(stack: QS): Result<QS> {
    let data: StackValue;
    // try {

    [stack, data] = pop(stack);

    let raw;// = unpackStackValue(data);
    const [type] = data;
    if (type === SType.Array) {
        raw = unpackStackValueR(data, SType.Array);
    } else if (type === SType.Map) {
        raw = [unpackStackValueR(data, SType.Map)];
    } else if (type === SType.Value) {
        raw = unpackStackValueR(data, SType.Any);
        raw = [raw];
    }

    return [stack, [SType.ComponentDef, parseComponentDef(raw)]];
    // } catch (err) {
    //     Log.debug('[onComponentDef]', err.message);
    //     return [stack];
    // }
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




export function onDefine<QS extends QueryStack>(stack: QS, [, op]: StackValue): Result<QS> {
    let wordVal: StackValue, wordFn, value: StackValue;
    [stack, wordVal] = pop(stack);
    [stack, value] = pop(stack);
    let [, word] = wordVal;


    if (value[0] === SType.Array && op !== 'let') {
        // Log.debug('[onDefine]', op, word, 'values', value );
        wordFn = async <QS extends QueryStack>(stack: QS): AsyncInstResult<QS> => {
            [stack] = await pushValues(stack, value[1]);
            return [stack];
        }
    } else {
        // Log.debug('[onDefine][let]', op, word, 'value', value );
        wordFn = value;
    }

    stack = addWords<QS>(stack, [[word, wordFn]]);

    return [stack];
};


export function onPrint<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let msg;
    const [, op] = val;
    if (op === '..') {
        console.info('[onPrint][stack]', '(', stackToString(stack), ')');
    } else {
        [stack, msg] = pop(stack);
        console.info('[onPrint]', unpackStackValueR(msg));
    }
    return [stack];
}

export function onAddArray<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);
    let [type, arr] = right;
    arr = [...arr, left];
    return [stack, [type, arr]];
}

export function onFetchArray<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);
    let arr = unpackStackValue(right, SType.Array);
    let idx = unpackStackValue(left, SType.Value);
    return [stack, arr[idx]];
}

export function onAdd<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let lv, rv;
    let op = val[1];

    [stack, lv] = pop(stack);
    [stack, rv] = pop(stack);

    let left = unpackStackValue(lv, SType.Value);
    let right = unpackStackValue(rv, SType.Value);

    let value = left;
    switch (op) {
        case '+': value = left + right; break;
        case '*': value = left * right; break;
        case '-': value = left - right; break;
        case '%': value = left % right; break;
        case '==': value = left === right; break;
        case '!=': value = left !== right; break;
    }

    // Log.debug('[onAdd]', op, left, right, value);

    return [stack, [SType.Value, value]];
}

export function onMapOpen<QS extends QueryStack>(stack: QS): Result<QS> {
    let sub = createQuery<QS>();
    // Log.debug('[onMapOpen]', stack.items);//Object.keys(stack.words));
    // DLog(stack, '[onMapOpen]', stack.items );

    sub._parent = stack;
    sub._root = stack._root ? stack._root : stack;
    // Log.debug('[onMapOpen]', {id:sub.id, parent:sub._parent?.id,root:sub._root?.id}, stackToString(stack) );

    // add something which will interpret each push
    sub = addWords<QS>(sub, [
        ['{', onMapOpen],
        ['[', onArrayOpen],
        ['}', onMapClose],
        [']', onUnexpectedError],
    ], true);
    // throw 'stop';
    // (sub as any)._stack = stack;
    return [sub];
}

export function onUnexpectedError<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    throw new StackError(`unexpected word '${val}'`);
}

export function onMapClose<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
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
    stack = stack._parent;
    return [stack, val];
}

export function onArrayOpen<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let sub = createQuery<QS>();
    sub._parent = stack;
    sub._root = stack._root ? stack._root : stack;
    // Log.debug('[onArrayOpen]', {id:sub.id, parent:sub._parent?.id,root:sub._root?.id}, stackToString(stack) );
    // sub.words = {...stack.words};
    sub = addWords<QS>(sub, [
        ['{', onMapOpen],
        ['[', onArrayOpen],
        [']', onArrayClose],
        ['}', onUnexpectedError],
        // ['arse', onUnexpectedError],
    ], true);
    return [sub];
}

export function onArrayClose<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    // Log.debug('[onArrayClose]', {id:stack.id, parent:stack._parent?.id}, stackToString(stack) );
    val = [SType.Array, stack.items];
    stack = stack._parent;
    return [stack, val];
}

export async function onArraySpread<QS extends QueryStack>(stack: QS, val: StackValue): AsyncResult<QS> {
    [stack, val] = pop(stack);
    let value = unpackStackValueR(val, SType.Array).map(v => [SType.Value, v]);

    // if( val[0] === SType.Array ){
    //     value = value.map( v => [Array.isArray(v) ? SType.Array : SType.Value, v] );
    // stack = { ...stack, items: [...stack.items, ...value] };
    // Log.debug('[onArraySpread]', value);
    [stack,] = await pushValues(stack, value);
    // }
    return [stack];
}

export function onValue<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    [stack, val] = pop(stack);
    let value = unpackStackValueR(val);
    if (val[0] === SType.Array) {
        value = value.map(v => [Array.isArray(v) ? SType.Array : SType.Value, v]);
        stack = { ...stack, items: [...stack.items, ...value] };
    }
    return [stack];
}


/**
 * Creates an array from the values on the stack, providing they are of the 
 * same type
 * 
 * @param stack 
 * @param val 
 */
export function onConcat<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let first;
    let values: StackValue[];
    [stack, first] = pop(stack);
    let type: SType = first[0]; //unpackStackValue(first, SType.Value);

    [stack, values] = popOfType(stack, type);

    values = [first, ...values];

    return [stack, [SType.Array, values]];
}

export function onBuildMap<QS extends QueryStack>(stack: QS): Result<QS> {
    let left, right;
    let values: StackValue[];
    [stack, left] = pop(stack);
    let array = unpackStackValue(left, SType.Array, false);



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

    return [stack, [SType.Map, map]];
}

export async function onFilter<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let array, fn;
    [stack, fn] = pop(stack);
    [stack, array] = pop(stack);

    array = unpackStackValue(array, SType.Array);
    fn = unpackStackValue(fn, SType.Array);

    let mapStack = cloneStack(stack, { words: true, items: false });
    let accum = [];

    [mapStack, accum] = await array.reduce(async (result, val) => {
        [mapStack, accum] = await result;
        [mapStack] = await push(mapStack, val);
        [mapStack] = await pushValues(mapStack, fn);
        let out;
        // Log.debug('[onFilter]', 'end', mapStack.items );
        [mapStack, out] = pop(mapStack);
        if (isTruthy(out)) {
            accum = [...accum, val];
        }

        return [mapStack, accum];
    }, Promise.resolve([mapStack, accum]));

    return [stack, [SType.Array, accum]];
}

export async function onMap<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let left, right;
    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let array = unpackStackValue(left, SType.Array);
    let fn = unpackStackValue(right, SType.Array);

    let mapStack = cloneStack(stack, { words: true, items: false });

    mapStack = await array.reduce(async (mapStack, val) => {
        mapStack = await mapStack;
        // Log.debug('[onMap]','ok', val);
        [mapStack] = await push(mapStack, val);
        [mapStack] = await pushValues(mapStack, fn);

        return mapStack;
    }, Promise.resolve(mapStack));

    // Log.debug('[onMap]', 'end', mapStack.items );

    return [stack, [SType.Array, mapStack.items]];
}

export async function onReduce<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let left, right, accum;
    [stack, right] = pop(stack);
    [stack, accum] = pop(stack);
    [stack, left] = pop(stack);

    let array = unpackStackValue(left, SType.Array);
    accum = unpackStackValue(accum, SType.Any);
    let fn = unpackStackValue(right, SType.Array);

    let mapStack = cloneStack(stack, { words: true, items: false });

    [mapStack, accum] = await array.reduce(async (result, val) => {
        [mapStack, accum] = await result;
        // Log.debug('[onMap]','ok', val);
        [mapStack] = await push(mapStack, val);
        [mapStack] = await push(mapStack, accum);
        [mapStack] = await pushValues(mapStack, fn);

        [mapStack, accum] = pop(mapStack);

        return [mapStack, accum];
    }, Promise.resolve([mapStack, accum]));


    return [stack, accum];
}

export function onUnique<QS extends QueryStack>(stack: QS): Result<QS> {
    let val;
    [stack, val] = pop(stack);
    let array = unpackStackValueR(val, SType.Array);
    return [stack, [SType.Array, [...new Set([...array].sort())].map(v => [SType.Value, v])]];
}

export async function onPluck<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let left, right;
    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let key = unpackStackValueR(right, SType.Any);
    let array = unpackStackValue(left, SType.Array);

    // Log.debug('[onPluck]', key);

    // if( whitelist.length === 1 && Array.isArray(whitelist[0]) ){
    //     whitelist = whitelist[0];
    // }
    // return Object.keys(obj).filter(k => whitelist.indexOf(k) !== -1)
    //     .reduce( (accum, key) => Object.assign(accum, { [key]: obj[key] }), {} );
    let out;
    if (Array.isArray(key)) {
        out = array.map(it => {
            let obj = unpackStackValue(it);
            if (!isObject(obj)) {
                throw new StackError(`expected map, got ${it[0]}`);
            }

            return [SType.Map, Object.keys(obj).filter(k => key.indexOf(k) !== -1)
                .reduce((acc, key) => Object.assign(acc, { [key]: obj[key] }), {})];
        })
    }
    else {
        // Log.debug('[onPluck]', array);
        out = array.map(it => {
            let obj = unpackStackValue(it);
            if (!isObject(obj)) {
                throw new StackError(`expected map, got ${it[0]}`);
            }
            let val = obj[key];
            return isStackValue(val) ? val : [SType.Value, val];
        });
    }


    return [stack, [SType.Array, out]];
}


export function onSwap<QS extends QueryStack>(stack: QS): Result<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);

    stack = pushRaw(stack, left);
    stack = pushRaw(stack, right);

    return [stack];
}

export function onDrop<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    [stack] = pop(stack);
    return [stack];
}


export function onClear<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    stack = { ...stack, items: [] };
    // [stack,val] = push( stack, [SType.Value, '1.0.0'] );
    return [stack];
};

export async function onVersion<QS extends QueryStack>(stack: QS, val: StackValue): AsyncInstResult<QS> {
    [stack, val] = await push(stack, [SType.Value, '1.0.0']);
    return [stack, val, false];
};

export function onEquals<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);

    let equal = compareValues(left, right);
    // Log.debug('[==]', left, right );

    return [stack, [SType.Value, equal]];
}

export function onAssertType<QS extends QueryStack>(stack: QS): Result<QS> {
    let value: StackValue;
    // Log.debug('well shit', stack.items );
    [stack, value] = pop(stack);
    let type = unpackStackValue(value, SType.Value);
    value = peek(stack);
    if (value === undefined) {
        throw new Error(`[onAssertType] stack underflow`);
    }
    if (value[0] !== type) {
        throw new Error(`[onAssertType] expected type ${type}, got ${value}`);
    }
    return [stack];
}

// export function onAssert( stack:QueryStack, val:StackValue ):InstResult {
//     // Log.debug('[assert]', val);
//     [stack,val] = pop(stack);
//     assert( val[1], `failed to assert value ${val}` );
//     return [stack];
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


