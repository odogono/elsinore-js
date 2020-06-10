
import { isObject, isString, isPromise, isFunction, isInteger } from "../util/is";
import { createLog } from "../util/log";
import { deepExtend } from "../util/deep_extend";
import { stackToString } from "./util";
import { toInteger } from "../util/to";
import { EntityId, getEntityId } from "../entity";
import { ComponentDefId, ComponentDef, getDefId } from "../component_def";
import { toValues as bfToValues } from '../util/bitfield';
import {
    StackValue, WordFn, SType,
    StackError, InstResult, AsyncInstResult, WordSpec, WordEntry, Words
} from "./types";
import { EntitySet } from "../entity_set";
const Log = createLog('QueryStack');




export interface CloneOptions {
    items?: boolean;
    words?: boolean;
}


let stackId = 0;


export class QueryStack {
    id: number;
    es?: EntitySet;
    items: StackValue[] = [];
    words: Words<this> = {};
    _root: this;
    _parent: this;
    _child: this;

    constructor(stack?: QueryStack) {
        this.id = ++stackId;
        if (stack !== undefined) {
            this.words = deepExtend(stack.words);
        }
    }


    peek(offset: number = 0): StackValue {
        return this.items[this.items.length - 1 - offset];
    }

    async push(input: any | StackValue): Promise<StackValue> {
        let [stack, value] = await push(this, input);
        Object.assign(this, stack);
        return value;
    }

    async pushValues(values: StackValue[], options: PushOptions = {}): Promise<StackValue[]> {
        let ovalues: StackValue[] = [];

        let stack = this;
        try {
            for (const value of values) {

                // let perf;
                // if( process.env.JS_ENV !== 'browser' ){
                //     const pf = require('perf_hooks');
                //     perf = pf.performance;
                // } else {
                //     perf = performance;
                // }
                // DLog(stack, '[pushValues]', value);
                // if( options.debug ){
                // Log.debug('[pushValues!]', value);
                // }
                // let pre = stack;
                // let st = perf.now();
                let ovalue;
                [stack, ovalue] = await push(stack, value);
                // Log.debug('[pushValues]', 'post', this.id, this._parent?.id, stack.id, stack._parent?.id);
                // Object.assign(this, stack);
                // let end = perf.now() - st;
                // if( end > 10 ){
                //     Log.debug('[pushValues]', value, stackToString(pre), end );
                // }
                ovalues.push(ovalue);
            }

            Object.assign(this, stack);
            // Log.debug('[pushValues]', 'still?', this.pop);

        } catch (err) {
            // Log.debug('st un?', (stack as any)._parent.items );
            let e = new StackError(`${err.message}: (${stackToString(this)})`);
            e.original = err
            e.stack = e.stack.split('\n').slice(0, 2).join('\n') + '\n'
                + err.stack;// [...new Set(err.stack.split('\n'))].join('\n');
            throw e;
        }

        return ovalues;
    }

    /**
     * 
     * @param offset 
     */
    pop(offset: number = 0): StackValue {
        const length = this.items.length;
        const idx = length - 1 - offset;
        if (idx < 0 || length === 0) {
            throw new StackError('stack underflow');
        }
        const value = this.items[idx];
        let items;


        if (offset > 0) {
            // Log.debug('[pop]', idx, value );
            items = this.items.filter((val, ii) => idx !== ii)
            // return [{...stack, items }, value];
        } else {
            items = this.items.slice(0, -1);
        }
        this.items = items;
        return value;
    }


    // clone<QS extends QueryStack>(stack: QS, options:CloneOptions = {}): QS {
    clone(options: CloneOptions = {}): QueryStack {
        let result = new QueryStack();

        if (options.items ?? true) {
            result.items = deepExtend(this.items);
        }
        if (options.words ?? true) {
            result.words = deepExtend(this.words);
        }

        return result;
    }
}



export function isStackValue(value: any): boolean {
    return Array.isArray(value) && value.length == 2;
}


/**
 * Pushes a stack value onto the stack
 */
export async function push<QS extends QueryStack>(stack: QS, input: any | StackValue): Promise<[QS, StackValue]> {
    let value: StackValue;
    let handler: WordFn<QS>;
    value = isStackValue(input) ? input : [SType.Value, input];

    let doPush = true;
    let [type, word] = value;

    if (type === SType.Value && isString(word)) {
        const len = word.length;

        // escape char for values which might otherwise get processed as words
        if (len > 1 && word.charAt(0) === '*') {
            value = [SType.Value, word.substring(1)] as any;
        }
        else {
            let wordStack = stack;

            if (len > 1) {
                while (word.charAt(0) === '^') {
                    wordStack = wordStack._parent !== undefined ? wordStack._parent : wordStack;
                    // Log.debug('[push]', '^', 'start at', wordStack.id, wordStack._parent?.id, wordStack.words );

                    word = word.substring(1);
                    value = [type, word];
                    // Log.debug('[push]', '^', word, wordStack.id);
                }
                // Log.debug('[getWord]', 'from parent', word, parent.words );
                // handler = getWord(parent, [SType.Value, word.substring(1)]);
            }

            // words beginning with $ refer to offsets on the root stack
            if (len > 1 && word.charAt(0) === '$') {
                const idx = toInteger(word.substring(1));
                value = wordStack.pop(idx);
                // Log.debug('[push]', '$', idx, 'pop', value, stack.id, wordStack.id);
            }

            else {
                handler = getWord(wordStack, value);
                // Log.debug('[push]', 'word', stack.id, wordStack.id, value, handler );
            }
        }
    }
    
    if (handler !== undefined) {
        try {
            if (isStackValue(handler)) {
                value = (handler as any);
            }
            else {
                let result = handler(stack, value);
                [stack, value, doPush] = isPromise(result) ? await result : result as InstResult<QS>;
                // Log.debug('[push]', 'post', stack.id, input, stack.pop);
            }
            // if( value ) Log.debug('[push]', value); 
        } catch (err) {
            // Log.warn('[push]', err.stack);
            let e = new StackError(`${err.message}`); // : ${unpackStackValue(value)}
            e.original = err
            e.stack = e.stack.split('\n').slice(0, 2).join('\n') + '\n'
                + [...new Set(err.stack.split('\n'))].join('\n');
            throw e;
        }
    }

    if (value !== undefined && doPush !== false) {
        stack.items = [...stack.items, value];
    }

    return [stack, value];
}

export function pushRaw<QS extends QueryStack>(stack: QS, value: StackValue): QS {
    stack.items = [...stack.items, value];
    return stack;
    // return { ...stack, items: [...stack.items, value] };
}

export interface PushOptions {
    debug?: boolean;
}


/**
 * Pops values from the stack while the type matches
 * 
 * @param stack 
 * @param type 
 */
export function popOfType<QS extends QueryStack>(stack: QS, ...types: SType[]): [QS, StackValue[]] {
    const length = stack.items.length;
    if (length === 0) {
        return [stack, []];
    }

    let results = [];
    let ii = length - 1;

    for (ii; ii >= 0; ii--) {
        const value = stack.items[ii];
        if (types.indexOf(value[0] as SType) === -1) {
            break;
        }
        results.push(value);
    }

    // cut the stack down to size
    stack.items = stack.items.slice(0, ii + 1);

    return [stack, results];
}


/**
 * 
 */
export function findWithIndex<QS extends QueryStack>(stack: QS, type: SType): [number, StackValue] {
    for (let ii = stack.items.length - 1; ii >= 0; ii--) {
        const item = stack.items[ii];
        if (type === item[0]) {
            // Log.debug('[findWithIndex]', 'found', item, ii );
            return [ii, item];
        }
    }
    return [-1, undefined];
}

export function findWithIndexV(stack: QueryStack, type: SType): [number, any] {
    let [index, [_, value]] = findWithIndex(stack, type);
    if (index === -1) {
        throw new Error(`type ${type} missing on stack`);
    }
    return [index, value];
}

/**
 * Returns the first value of type from the stack
 * 
 * @param stack 
 * @param type 
 */
export function findV(stack: QueryStack, type: SType): any {
    const [_, value] = findWithIndex(stack, type);
    return value ? value[1] : undefined;
}
export function find<QS extends QueryStack>(stack: QS, type: SType): StackValue {
    const [_, value] = findWithIndex(stack, type);
    return value;
}


export function popBitField<ST extends QueryStack, CD extends ComponentDef>(stack: ST, asObj: boolean = true): [ST, CD[] | ComponentDefId[]] {
    const { es } = stack;
    let val;
    let dids: ComponentDefId[];
    let defs: CD[];
    val = stack.peek();

    let [type, bf] = val;
    // Log.debug('[popBitField]', 'yes', stack.items);
    if (type === SType.Bitfield) {
        dids = bfToValues(bf);
        defs = asObj ? dids.map(d => es.getByDefId(d) as CD) : [];
    } else if (type === SType.Value && bf === 'all') {
        // get all def ids
        if (asObj) {
            defs = es.componentDefs as CD[];
        } else {
            dids = es.componentDefs.map(d => getDefId(d));
        }
    }
    if (dids !== undefined || defs !== undefined) {
        stack.pop();
    }
    return [stack, asObj ? defs : dids];
}

export interface ExecuteOptions {
    pushResult?: boolean;
}


// interface WordMap {
//     [word: string]: [WordFn, SType[]]
// };



export function addWords<QS extends QueryStack>(stack: QS, words: WordSpec<QS>[], replace: boolean = false): QS {
    // Log.debug('[addWords]', words );//[fn,args]);

    for (const spec of words) {
        const [word, fn, ...args] = spec;
        let patterns = replace ? [] : stack.words[word] || [];
        patterns = [...patterns, [fn, (args as (SType[]))]] as WordEntry<QS>[];
        stack.words = { ...stack.words, [word]: patterns };
        // return { ...stack, words: { ...stack.words, [word]: patterns } };
    }

    return stack;
    // return words.reduce((stack, spec) => {
    // }, stack);
}


function getWord<QS extends QueryStack>(stack: QS, value: StackValue): WordFn<QS> | undefined {
    // const [type,word] = value;
    if (value[0] !== SType.Value || !isString(value[1])) {
        return undefined;
    }
    const wval = value[1];

    const patterns = stack.words[wval];
    if (patterns === undefined) {
        return undefined;
    }
    let pattern = patterns.find(pat => {
        const [, args] = pat;
        return matchStack(stack.items, args) ? pat : undefined;

        // Log.debug('[getWord]', 'match', `'${wval}'`, args, stack.items );
    });
    // Log.debug('[getWord]', value, wval, pattern);
    if (pattern !== undefined) {
        return pattern[0];
    }

    Log.debug('[getWord]', 'match', `'${wval}'`, patterns.map(p => p.slice(1)));
    Log.debug('[getWord]', 'match', `'${wval}'`, stackToString(stack));
    throw new StackError(`invalid params for ${wval}`);
}


export function entityIdFromValue(value: StackValue): EntityId {
    const [type, val] = value;
    switch (type) {
        case SType.Entity:
        case SType.Component:
            return getEntityId(val);
        case SType.Value:
            return isInteger(val) ? val : undefined;
        default:
            return undefined;
    }
}

function matchStack(stackItems: StackValue[], pattern: SType[]) {
    const pLength = pattern.length;
    if (pLength === 0) {
        return true;
    }
    const sLength = stackItems.length;
    if (pLength > sLength) {
        return false;
    }
    for (let ii = 0; ii < pLength; ii++) {
        const sym = pattern[pLength - 1 - ii];
        const [vt, v] = stackItems[sLength - 1 - ii];
        if (sym !== SType.Any && sym !== vt && sym !== v) {
            // Log.debug('[matchStack]', sym, vt, v );
            return false;
        }
    }
    // Log.debug('[matchStack]', pattern, stackItems );
    return true;
}


export function assertStackSize(stack: QueryStack, expected: number, msg?: string) {
    const len = stack.items.length;
    if (len < expected) {
        if (msg === undefined) {
            msg = `expected stack size ${expected}, actual: ${len}`;
        }
        throw new Error(msg);
    }
}

export function assertStackValueType(stack: QueryStack, index: number, opType: string, argType?: any) {
    // Log.debug('[assertStackValueType]', 'argType', argType );
    const len = stack.items.length;
    const idx = len - 1 - index;
    if (idx < 0) {
        throw new Error(`value out of bounds: -${index + 1} : ${len}`);
    }
    const value: StackValue = stack.items[idx];
    if (value[0] !== opType) {
        throw new Error(`expected value of type ${opType} at index ${idx} : got ${value[0]}`);
    }
    if (argType !== undefined && typeof value[1] !== argType) {
        throw new Error(`expected arg of type ${argType} at index ${idx} : got ${typeof value[1]}`);
    }
}



export function isDLogEnabled<QS extends QueryStack>(stack: QS) {
    const wordFn = getWord(stack, [SType.Value, 'trace']);
    return (wordFn !== undefined && isStackValue(wordFn) && wordFn[1] === true);
}
export function DLog<QS extends QueryStack>(stack: QS, ...args) {
    const wordFn = getWord(stack, [SType.Value, 'trace']);
    if (wordFn === undefined || !isStackValue(wordFn)) {
        return;
    }

    if (wordFn[1]) {
        Log.debug(...args);
    }
}