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
    popOfType,
    StackError,
    assertStackValueType
} from './stack';
import { create as createComponentDef, isComponentDef } from '../../src/component_def';
import { isString } from '../../src/util/is';
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


export async function onSelect<QS extends QueryStack>(stack: QS, val: StackValue): AsyncResult<QS> {
    let left, right;

    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let es:EntitySet = unpackStackValue(left, SType.EntitySet);
    let query = unpackStackValue(right, SType.Array, false);

    const {isAsync,esSelect} = es;

    // Log.debug('left', left);
    // Log.debug('right', right);

    let result = await esSelect(es, query);

    if( result ){
        // append output stack
        stack = { ...stack, items: [...stack.items, ...result] };
    }

    return [stack ];
}

export function onArgError<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    Log.debug('[onArgError]', val);
    throw new StackError('invalid argument');
}


export function onEntity<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let data: StackValue;
    [stack, data] = pop(stack);

    let eid = unpackStackValue(data, SType.Value);
    // Log.debug('[onEntity]', eid);
    let e = createEntityInstance(eid);

    return [stack, [SType.Entity, e]];
}


export function onComponent<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let data: StackValue;

    [stack, data] = pop(stack);
    let es = findV(stack, SType.EntitySet);

    if (es === undefined) {
        throw new Error('EntitySet not found on stack');
    }

    let raw = unpackStackValue(data, SType.Array);
    let [uri, attrs] = raw;

    // Log.debug('[onComponent]', uri, attrs );

    let com = createComponent(es, uri, attrs);
    // let def = createComponentDef( undefined, ...raw );

    return [stack, [SType.Component, com]];
}

export function unpackStackValue(val: StackValue, assertType: SType = SType.Any, recursive: boolean = true): any {
    let [type, value] = val;
    if (assertType !== SType.Any && type !== assertType) {
        throw new Error(`expected type ${assertType}, got ${type}`);
    }
    if (recursive && type === SType.Array) {
        return value.map(av => unpackStackValue(av));
    }
    if( recursive && type === SType.ComponentValue ){
        return value[2];
    }
    if (recursive && type === SType.Map) {
        return Object.keys(value).reduce((res, key) => {
            return { ...res, [key]: unpackStackValue(value[key]) }
        }, {});
    } else {
        // Log.debug('[unpackStackValue]', 'wat', value);
        return value;
    }
}

export function onAddComponentToEntity<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let ev: StackValue, cv: StackValue;

    [stack, cv] = pop(stack);
    [stack, ev] = pop(stack);

    let e: Entity = unpackStackValue(ev, SType.Entity);
    let c: Component = unpackStackValue(cv, SType.Any);

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
    let value = unpackStackValue(left);
    let es: EntitySet = unpackStackValue(right, SType.EntitySet);

    try {
        const { esAdd, esRegister, isAsync } = es;

        let values:any[] = left[0] !== SType.Array ? [value] : value;

        // sort into defs and e/com
        let [defs,coms] = values.reduce( ([defs,coms],value) => {
            if( isComponentDef(value) ){
                defs.push(value);
            } else if (isEntity(value) || isComponent(value) ){
                coms.push(value);
            }
            return [ defs, coms ];
        }, [[],[]] );

        es = await defs.reduce( async (es,def) => {
            es = await es;
            // Log.debug('[onAddToEntitySet]', 'huh')
            [es] = isAsync ? await esRegister(es, def) : esRegister(es,def);
            return es;
        },Promise.resolve(es));

        es = isAsync ? await esAdd( es, coms ) : esAdd( es, coms );

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

    let options = unpackStackValue(data, SType.Map);
    let es = createEntitySet(options);

    return [stack, [SType.EntitySet, es]];
}

export function onComponentDef<QS extends QueryStack>(stack: QS): Result<QS> {
    let data: StackValue;
    try {

    

    [stack, data] = pop(stack);

    let raw = unpackStackValue(data);
    const [type] = data;
    if (type === SType.Array) {
        raw = unpackStackValue(data);
    } else if( type === SType.Map ){
        raw = [unpackStackValue(data)];
    } else if (type === SType.Value) {
        raw = [raw];
    }

    let def = createComponentDef(undefined, ...raw);

    // Log.debug('[onComponentDef]', def);

    
    return [stack, [SType.ComponentDef, def]];
    }catch( err ){
        Log.debug('[onComponentDef]', err.stack);
        return [stack];
    }
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
    // left = peek(stack,1);
    // right = peek(stack,0);
    let [type, arr] = right;
    arr = [...arr, left];

    // Log.debug('[+Array]', left, right);
    return [stack, [type, arr]];
}

export function onAdd<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    let lv, rv;

    [stack, lv] = pop(stack);
    [stack, rv] = pop(stack);

    let left = unpackStackValue(lv, SType.Value);
    let right = unpackStackValue(rv, SType.Value);

    let value = left + right;

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
    let value = unpackStackValue(val, SType.Array);

    // if( val[0] === SType.Array ){
    //     value = value.map( v => [Array.isArray(v) ? SType.Array : SType.Value, v] );
        stack = { ...stack, items: [...stack.items, ...value] };
    // }
    return [stack];
}

export function onValue<QS extends QueryStack>(stack: QS, val: StackValue): Result<QS> {
    [stack, val] = pop(stack);
    let value = unpackStackValue(val);
    if( val[0] === SType.Array ){
        value = value.map( v => [Array.isArray(v) ? SType.Array : SType.Value, v] );
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
