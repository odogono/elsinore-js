import {
    ActiveMode,
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
    isInteger, isString, isFunction
} from '@odgn/utils';

import {
    Entity, EntityId, isEntity,
} from '../../../src/entity';
import { isComponent, Component, getComponentDefId } from '../../../src/component';


import { createLog } from "../../util/log";
import { stackToString, valueToString, unpackStackValue, unpackStackValueR } from '../util';
import { EntitySet, isEntitySet } from '../../entity_set';
import { compareDates } from './util';
import { BitField, TYPE_OR, toValues as bfToValues, TYPE_NOT } from '@odgn/utils/bitfield';
import { stringify } from '@odgn/utils';
import { evalList } from './list';

const Log = createLog('QueryWords');




/**
 * Duplicates the top stack value, or if the op is 'over', duplicates the previous
 * 
 * ( n1 n2 — n1 n2 n1 )
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
        // let dup = await es.clone();
        out = [SType.EntitySet, es];
    } else {
        // let o = unpackStackValue(val);
        out = [...val];
    }

    return out;
}

/**
 * Rotates third item to top
 * 
 * ( n1 n2 n3 — n2 n3 n1 )
 */
export async function onRot<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let items = stack.items;

    if (items.length < 3) {
        throw new StackError('stack underflow');
    }

    const rem = items.splice(-3, 1);
    items.push(rem[0]);
    stack.setItems(items);

    return undefined;
}

/**
 * Performs a query on an EntitySet
 * 
 * ( es args - es result ) 
 * 
 * @param stack 
 */
export async function onSelect<QS extends QueryStack>(stack: QS): AsyncInstResult {

    let right = stack.pop();
    let left = stack.peek(); // NOTE - we do not consume the ES

    let query = unpackStackValue(right, SType.List, false);
    let es: EntitySet = unpackStackValue(left, SType.EntitySet);

    // Log.debug('[onSelect]', query );
    let result = await es.select(stack, query);

    if (result) {
        // append output stack
        stack.setItems(stack.items.concat(result));
    }

    return undefined;
}


export function onEntity(stack: QueryStack): InstResult {
    let data: StackValue = stack.pop();
    let [type, val] = data;
    const { es } = stack;

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

    return [SType.Entity, es.createEntity()];
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

    // console.log('[onAddToEntitySet]', left );
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


/**
 * 
 * @param stack 
 */
export async function onRemoveFromEntitySet<QS extends QueryStack>(stack: QS): AsyncInstResult {
    let left = stack.pop();
    let right = stack.pop();

    let eids: EntityId[];
    if (left[0] === SType.List) {
        eids = unpackStackValueR(left);
    }
    else if (left[0] === SType.Value) {
        eids = [unpackStackValueR(left)];
    }

    // DLog(stack, '[onAddToEntitySet]', left );
    // let value = unpackStackValue(left);
    // DLog(stack, '[onAddToEntitySet]', isComponentDef(value), value );
    let es: EntitySet = unpackStackValueR(right, SType.EntitySet);

    // Log.debug('[onRemoveFromEntitySet]', eids);

    if (eids !== undefined) {
        es = await es.removeEntity(eids);
    }

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
        // let msg =  await onToString(stack, [,'to_str!']);
        let msg = stack.pop();
        console.info('[onPrint]', unpackStackValueR(msg));
    }
    return undefined;
}


export function onFetchList<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    let left = stack.pop();
    let right = stack.pop();
    let arr = unpackStackValue(right, SType.List);
    let idx = unpackStackValue(left, SType.Value);
    return arr[idx];
}


export function onRegexBuild(stack: QueryStack): InstResult {
    let val = stack.popValue();
    // console.log('[onRegexBuild]', new RegExp(val) );
    return [SType.Regex, new RegExp(val)];
}

export function onRegex(stack: QueryStack, [, op]: StackValue): InstResult {
    let regex: RegExp = stack.popValue();
    let val = stack.popValue();

    // console.log('[onRegex]', regex, val );

    if (!isString(val)) {
        return [SType.Value, false];
    }

    let value: any = false;

    if (op === 'split') {
        value = val.split(regex);
    }
    else if (op === 'replace') {
        let repl = stack.popValue();
        // console.log('[onRegex]', 'replace', regex, val, repl );
        value = val.replace(regex, repl);
    }
    else if (op === 'eval') {
        let result = regex.exec(val);
        // console.log('[onRegex]', 'result', regex, val, result );
        if (result) {
            value = Array.from(result);
        }
    }
    else if (op === '==') {
        value = regex.test(val);
    } else if (op === '!=') {
        value = !regex.test(val);
    }

    if (Array.isArray(value)) {
        return [SType.List, value.map(v => [SType.Value, v])];
    }

    return [SType.Value, value];
}

export function onCompare(stack: QueryStack, [, op]: StackValue): InstResult {
    let left = JSON.stringify(stack.pop());
    let right = JSON.stringify(stack.pop());

    let value = op == '!=' ? left != right : left == right;

    return [SType.Value, value];
}

export function onDateTime(stack: QueryStack, [, op]: StackValue): InstResult {
    let dateA = stack.popValue();
    let dateB = stack.popValue();

    let value = compareDates(op, dateA, dateB);

    return [SType.Value, value];
}

/**
 * Places an undefined value on the stack
 */
export function onUndefined(stack: QueryStack): InstResult {
    return [SType.Value, undefined];
}


export function onBitFieldOr(stack: QueryStack): InstResult {
    let bf = stack.popValue();
    bf.type = TYPE_OR;
    return [SType.BitField, bf];
}

export function onBitFieldNot(stack: QueryStack): InstResult {
    let bf = stack.popValue();
    bf.type = TYPE_NOT;
    return [SType.BitField, bf];
}

export function onAdd(stack: QueryStack, [, op]: StackValue): InstResult {

    let left = stack.popValue();
    let right = stack.popValue();

    let value = left;
    switch (op) {
        case '+': value = left + right; break;
        case '*': value = left * right; break;
        case '-': value = left - right; break;
        case '%':
            // Log.debug('[%]', left, right, left % right );
            value = left % right;
            break;
        case '==':
            // Log.debug(`[==]`, left, right, compare(left, right) );
            // value = compare(left,right);
            value = left === right;
            break;
        case '!=':
            // value = !compare(left,right);// left !== right; 
            value = left !== right;
            break;
        case '>': value = left > right; break;
        case '>=': value = left >= right; break;
        case '<': value = left < right; break;
        case '<=': value = left <= right; break;
    }

    return [SType.Value, value];
}

// function compare( left:any, right:any ){
//     if( left === 'undefined' ){
//         left = undefined;
//     }
//     if( right === 'undefined' ){
//         right = undefined;
//     }
//     return left === right;
// }


export function onUnexpectedError<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    throw new StackError(`unexpected word '${val}'`);
}


export function onValue<QS extends QueryStack>(stack: QS): InstResult {
    let val = stack.pop();
    let value = unpackStackValueR(val);
    if (val[0] === SType.List) {
        value = value.map(v => [Array.isArray(v) ? SType.List : SType.Value, v]);
        // stack = { ...stack, items: [...stack.items, ...value] };
        // stack.items = [...stack.items, ...value];
        stack.items.push(value);
    }
    return undefined;
}


/**
 * ( [] -- vl )
 * ( %{} -- vl )
 * @param stack 
 */
export async function onSize<QS extends QueryStack>(stack: QS, [, op]: StackValue): AsyncInstResult {
    let size = 0;
    // by default, the word consumes what it is measuring
    const isDes = op === 'size!';
    let [type, val] = isDes ? stack.pop() : stack.peek();

    if (type === SType.List) {
        size = (val as any[]).length;
    }
    else if (type === SType.Map) {
        size = Object.keys(val).length;
    } else if (isString(val)) {
        size = (val as string).length;
    }
    else if (isEntitySet(val)) {
        size = await (val as EntitySet).size();
    }
    else if (isEntity(val)) {
        size = (val as Entity).size;
    }

    return [SType.Value, size];
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

export async function onToString(stack: QueryStack, [, op]: StackValue): AsyncInstResult {
    const isJoin = op === 'to_str!';
    let val = stack.pop();
    let str = '';
    // with to string
    // Log.debug('[onToString]', op, isJoin, val );
    if (isJoin && val[0] === SType.List) {
        let list = unpackStackValue(val, SType.List);
        val = await evalList(stack, list);
        str = valueToString(val, true);
    }
    else {
        str = valueToString(val);
    }

    return [SType.Value, str];
}


/**
 * 
 * ( [] vl -- vl )
 * ( vl vl -- vl )
 * 
 * [ hello world ] ' ' join -- 'hello world'
 */
export async function onJoin(stack: QueryStack): AsyncInstResult {
    let joinStr = stack.pop();
    let list = stack.pop();
    let result;

    if (list[0] === SType.List) {
        list = await evalList(stack, list[1]);
        list = unpackStackValueR(list, SType.List);
        result = list.join(joinStr[1]).trim();
    } else {
        result = list[1] + joinStr[1];
    }

    // Log.debug('[onJoin]', joinStr[1], list, `"${result}"` );
    return [SType.Value, result];
}

/**
 * 
 * ( [] vl -- [] )
 */
export function onPush<QS extends QueryStack>(stack: QS, val: StackValue): InstResult {
    let rv = stack.pop();
    let lv = stack.pop();

    let list = unpackStackValue(lv, SType.List);

    // Log.debug('[onPush]', list, rv );

    list = [...list, rv];

    return [SType.List, list];
}


/**
 * 
 * pop! ( [] -- vl ) - destructive
 * pop ( [] -- [] vl ) - retains list
 * 
 * @param stack 
 */
export function onPop<QS extends QueryStack>(stack: QS, [, op]: StackValue): InstResult {
    const isPopRet = op == 'pop';
    const isPopSafe = op == 'pop?';

    let lv = stack.pop();

    let list = unpackStackValue(lv, SType.List);
    const len = list.length;
    if (len === 0) {
        if (isPopSafe) {
            stack.pushRaw([SType.List, list]);
            return [SType.Value, undefined];
        }
        throw new StackError('stack underflow');
    }

    let value = list.pop();

    if (isPopRet || isPopSafe) {
        stack.pushRaw([SType.List, list]);
    }

    stack.pushRaw(value);

    return undefined;
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
    stack.clear();
    return undefined;
};

export function onVersion<QS extends QueryStack>(stack: QS): InstResult {
    return [SType.Value, '1.0.0'];
};

// export function onLeave<QS extends QueryStack>(stack: QS, [,op]:StackValue): InstResult {
//     const mode = op === 'leave' ? ActiveMode.Leave : ActiveMode.Break;
//     stack.setActive( false, mode, 'onLeave' );
//     return undefined;
// }

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

export function onPrintStack<QS extends QueryStack>(stack: QS): InstResult {
    const vals = [...stack.items];
    print(0, `> stack ${stack._idx}`);

    const words = stack._udWords;
    for (const word in words) {
        print(0, `${word}:`);
        printType(1, words[word]);
        // print(1, typeof words[word], {}.toString.call(words[word]), isFunction(words[word]) );
    }

    print(0, '---');
    for (const val of vals.reverse()) {
        printType(0, val);
        // console.log( `${indent} (${type}) ${val}`);
    }

    // Log.debug( '??', stack.toString() );
    return undefined;
}

function printType(indent: number = 0, val: StackValue) {
    if (!Array.isArray(val)) {
        print(indent, isFunction(val) ? 'Fn' : val);
        return;
    }
    const type = val[0];
    switch (type) {
        case SType.List:
            printList(indent, val);
            break;
        case SType.EntitySet:
            const es: EntitySet = val[1];
            print(indent, `(${type}) [${es.type}, ${es.uuid}]`);
            break;
        case SType.Component:
            const com: Component = val[1];
            print(indent, `(${type})`, JSON.stringify(com));
            break;
        case SType.Entity:
            const e: Entity = val[1];
            if (isInteger(e)) {
                print(indent, `(@eid) ${e}`);
            }
            else {
                const dids = bfToValues(e.bitField);
                print(indent, `(${type}) ${e.id} [${dids}]`);
            }
            break;
        case SType.BitField:
            const bf: BitField = val[1];
            print(indent, `(${type}) [${bfToValues(bf)}]`)
            break;

        default:
            print(indent, `(${type}) ${stringify(val[1])}`);
            break;
    }
}

function printList(indent: number = 0, list: StackValue) {
    print(indent, `${list[0]}`);
    for (const val of list[1]) {
        printType(indent + 1, val);
    }
}

function print(indent, ...val) { console.log(`${' '.repeat(indent)}`, ...val); }

// export function onAssert( stack:QueryStack, val:StackValue ):InstResult {
//     // Log.debug('[assert]', val);
//     [stack,val] = pop(stack);
//     assert( val[1], `failed to assert value ${val}` );
//     return undefined;
// }

