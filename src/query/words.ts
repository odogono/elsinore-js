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
    popOfType,
    StackError,
    assertStackValueType,
    isStackValue
} from './stack';
import { create as createComponentDef, isComponentDef } from '../../src/component_def';
import { isString, isBoolean, isObject, isInteger } from '../../src/util/is';
import { register, createComponent } from '../../src/entity_set/registry';
import {
    Entity, create as createEntityInstance, isEntity,
    addComponent as addComponentToEntity
} from '../../src/entity';
import { isComponent, Component, isComponentList } from '../../src/component';
import {
    create as createEntitySet,
    add as addToES,
    isEntitySet,
    createEntity,
    EntitySet,
    size as entitySetSize
} from '../../src/entity_set';

import { createLog } from "../util/log";

const Log = createLog('QueryWords');

type Result<QS extends QueryStack> = InstResult<QS>;
type AsyncResult<QS extends QueryStack> = Promise<InstResult<QS>>;


export async function onSelect<QS extends QueryStack>(stack: QS): AsyncResult<QS> {
    let left, right;

    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let es: EntitySet = unpackStackValue(left, SType.EntitySet);
    let query = unpackStackValue(right, SType.Array, false);

    const { isAsync, esSelect } = es;

    // Log.debug('[onSelect]', 'left', left);
    // Log.debug('[onSelect]', 'right', right);
    // Log.debug('[onSelect]', 'esSelect', es);

    let result = await esSelect(es, query);

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
    let [type,val] = data;

    if( type === SType.Array ){
        // val.reduce( (acc,val) => {
        //     Log.debug('[onEntity]', val);
        //     let type = val[0];
        //     if( type === SType.Component ){

        //     } else if( isInteger(val[1]) ){
        //         return [SType.Entity,createEntityInstance(val[1]) ];
        //     }
        // },[]);
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

    if (Array.isArray(c)) {
        e = c.reduce((e, c) => addComponentToEntity(e, c), e);
    } else {
        e = addComponentToEntity(e, c);
    }
    // Log.debug('[onAddComponentToEntity]', c );

    return [stack, [SType.Entity, e]];
}



export async function onAddToEntitySet<QS extends QueryStack>(stack: QS): AsyncInstResult<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);

    // Log.debug('[onAddToEntitySet]', left );
    // Log.debug('[onAddToEntitySet]', isComponentDef(value), value );
    let value = unpackStackValueR(left);
    let es: EntitySet = unpackStackValueR(right, SType.EntitySet);

    try {
        const { esAdd, esRegister, isAsync } = es;

        let values: any[] = left[0] !== SType.Array ? [value] : value;

        // sort into defs and e/com
        let [defs, coms] = values.reduce(([defs, coms], value) => {
            if (isComponentDef(value)) {
                defs.push(value);
            } else if (isEntity(value) || isComponent(value)) {
                coms.push(value);
            }
            return [defs, coms];
        }, [[], []]);

        es = await defs.reduce(async (es, def) => {
            es = await es;
            // Log.debug('[onAddToEntitySet]', 'huh')
            [es] = isAsync ? await esRegister(es, def) : esRegister(es, def);
            return es;
        }, Promise.resolve(es));

        es = isAsync ? await esAdd(es, coms) : esAdd(es, coms);

    } catch (err) {
        Log.warn('[onAddToEntitySet]', 'error', value, err.stack);
    }
    return [stack, [SType.EntitySet, es]];
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

        // ensure props are wrapped in an array
        let [uri, props] = raw;
        if( props !== undefined && !Array.isArray(props) ){
            // Log.debug('[onComponentDef]', raw);
            throw new StackError(`onComponentDef : properties should be wrapped in array: ${uri}`);
        }

        let def = createComponentDef(undefined, ...raw);



        return [stack, [SType.ComponentDef, def]];
    // } catch (err) {
    //     Log.debug('[onComponentDef]', err.message);
    //     return [stack];
    // }
}


export function onDefine<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let word: StackValue, value: StackValue;
    [stack, word] = pop(stack);
    [stack, value] = pop(stack);

    // Log.debug('[onDefine]', word, value);

    let wordFn = async <QS extends QueryStack>(stack: QS, val: StackValue): AsyncInstResult<QS> => {
        let wordVal = value[0] === SType.Array ? value[1] : [value];
        // Log.debug('[onDefine]', 'push', wordVal);
        [stack] = await pushValues(stack, wordVal);
        return [stack];
    }

    stack = addWords<QS>(stack, [
        [word[1], wordFn]
    ])

    return [stack];
};


export function onAddArray<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let left, right;
    [stack, left] = pop(stack);
    [stack, right] = pop(stack);
    let [type, arr] = right;
    arr = [...arr, left];
    return [stack, [type, arr]];
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
    }

    // Log.debug('[onAdd]', op, left, right, value);

    return [stack, [SType.Value, value]];
}

export function onMapOpen<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let sub = createQuery<QS>();
    // add something which will interpret each push
    sub = addWords<QS>(sub, [
        ['{', onMapOpen],
        ['[', onArrayOpen],
        ['}', onMapClose],
    ]);
    (sub as any).stack = stack;
    return [sub];
}

export function onMapClose<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
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
    stack = (stack as any).stack;
    return [stack, val];
}

export function onArrayOpen<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let sub = createQuery<QS>();
    // sub.words = {...stack.words};
    sub = addWords<QS>(sub, [
        ['{', onMapOpen],
        ['[', onArrayOpen],
        [']', onArrayClose],
    ]);
    (sub as any).stack = stack;
    return [sub];
}

export function onArrayClose<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    // Log.debug('[onArrayClose]', stack);
    val = [SType.Array, stack.items];
    stack = (stack as any).stack;
    return [stack, val];
}

export function onArraySpread<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    [stack, val] = pop(stack);
    let value = unpackStackValueR(val, SType.Array).map(v => [SType.Value, v]);

    // if( val[0] === SType.Array ){
    //     value = value.map( v => [Array.isArray(v) ? SType.Array : SType.Value, v] );
    stack = { ...stack, items: [...stack.items, ...value] };
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

    // let array = [SType.Array, values];
    // [stack,right] = pop(stack);

    // stack = pushRaw(stack, left);
    // stack = pushRaw(stack, right);

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
    if( Array.isArray(key) ){
        out = array.map( it => {
            let obj = unpackStackValue(it);
            if( !isObject(obj) ){
                throw new StackError(`expected map, got ${it[0]}`);
            }
            
            return [SType.Map, Object.keys(obj).filter(k => key.indexOf(k) !== -1)
                .reduce( (acc,key) => Object.assign(acc, { [key]: obj[key] }), {} )];
        })
    }
    else {
        // Log.debug('[onPluck]', array);
        out = array.map( it => {
            let obj = unpackStackValue(it);
            if( !isObject(obj) ){
                throw new StackError(`expected map, got ${it[0]}`);
            }
            let val = obj[key];
            return isStackValue(val) ? val : [SType.Value,val];
        });
    }


    return [stack, [SType.Array,out]];
}


export function onSwap<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
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
    [stack, value] = pop(stack);
    let type = unpackStackValue(value, SType.Value);
    value = peek(stack);
    if (value === undefined) {
        throw new Error(`[onAssertType] stack underflow`);
    }
    // Log.debug('well shit', value );
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
