
import { isObject, isString, isPromise, isFunction, isInteger } from "../util/is";
import { createLog } from "../util/log";
import { deepExtend } from "../util/deep_extend";
import { stackToString, unpackStackValueR } from "./util";
import { toInteger } from "../util/to";
import { EntityId, getEntityId, Entity } from "../entity";
import { ComponentDefId, ComponentDef, getDefId } from "../component_def";
import { toValues as bfToValues } from '../util/bitfield';
import {
    StackValue, WordFn, SType,
    StackError, InstResult, AsyncInstResult, WordSpec, WordEntry, Words
} from "./types";
import { EntitySet } from "../entity_set";
import { getComponentEntityId, getComponentDefId } from "../component";
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
    words: Words = {};

    _root: QueryStack;
    _parent: QueryStack;
    _child: QueryStack;

    // the current operating stack
    // _focus: QueryStack;

    constructor(stack?: QueryStack) {
        this.id = ++stackId;
        if (stack !== undefined) {
            this.words = deepExtend(stack.words);
        }
    }

    get size(): number {
        return this.items.length;
    }

    focus(): QueryStack {
        return this._child ? this._child.focus() : this;
    }

    peek(offset: number = 0): StackValue {
        const stack = this.focus();
        return stack.items[stack.items.length - 1 - offset];
    }

    setChild(child: QueryStack): QueryStack {
        let self = this.focus();
        child._parent = self;
        self._child = child;
        child._root = self._root ?? this._root ?? this;

        // Log.debug('[setChild]', this.focus().id, 'focus now', printStackLineage(this.focus()) );
        return this;
    }



    restoreParent(): QueryStack {
        const root = this._root ?? this;
        let child = root;
        // find current child
        while (child._child !== undefined) {
            child = child._child;
        };
        let parent = child._parent;
        // Log.debug( '[restoreParent]', 'root', root.id );
        // Log.debug( '[restoreParent]', 'child', child.id );
        // Log.debug( '[restoreParent]', 'parent', parent.id );

        child._parent = undefined;
        parent._child = undefined;

        // let self = this.focus();
        // if( self._parent === undefined ){ return this; }
        // self._parent._child = undefined;
        // self = this.focus();
        // Log.debug('[restoreParent]', this.id, this.focus().id, 'focus now', printStackLineage(root) );
        // Log.debug('[restoreParent]', this.id, this.focus().id, 'focus now', printStackLineage(this) );
        // Log.debug( this );
        // Log.debug('[restoreParent]', self._parent.id, self.id, 'focus now', printStackLineage(this.focus()) );
        // throw 'stop';
        return this;
    }

    // async push(input: any | StackValue): Promise<StackValue> {
    //     let [stack, value] = await push(this, input);
    //     Object.assign(this, stack);
    //     return value;
    // }


    /**
     * Pushes a stack value onto the stack
     */
    async push(input: any | StackValue): Promise<StackValue> {
        let value: StackValue;
        let handler: WordFn;
        value = isStackValue(input) ? input : [SType.Value, input];

        // let doPush = true;
        let [type, word] = value;
        let stack = this.focus();

        // Log.debug('[push]', stack.id, `(${this.id})`, value );

        if (type === SType.Value && isString(word)) {
            const len = word.length;

            if (len > 1 && word.charAt(0) === '~') {
                const sigil = word.charAt(1);
                const sep = word.charAt(2);
                const end = word.lastIndexOf(sep);
                const flags = word.substring(end + 1);
                const sigilV = word.substring(3, end);

                if (sigil === 'r') {
                    const regex = new RegExp(sigilV, flags);
                    value = [SType.Regex, regex];
                }
                else if( sigil === 'd' ){
                    // console.log('new date yo', sigilV, new Date(sigilV) );
                    value = [SType.DateTime, sigilV == '' ? new Date() : new Date(sigilV) ];
                }
            }

            // escape char for values which might otherwise get processed as words
            if (len > 1 && word.charAt(0) === '*') {
                value = [SType.Value, word.substring(1)] as any;
            }
            else {
                let wordStack: QueryStack = stack;

                if (len > 1) {
                    let up = word.charAt(0) === '^';
                    while (word.charAt(0) === '^') {
                        wordStack = wordStack._parent !== undefined ? wordStack._parent : wordStack;
                        // Log.debug('[push]', '^', 'start at', wordStack.id, wordStack._parent?.id  );
                        word = word.substring(1);
                        value = [type, word];
                    }

                    // if( up ) Log.debug('[push]', '^', word, wordStack.id, printStackLineage(wordStack) );
                    // Log.debug('[getWord]', 'from parent', word, parent.words );
                    // handler = getWord(parent, [SType.Value, word.substring(1)]);
                }

                // words beginning with $ refer to offsets on the root stack
                if (len > 1 && word.charAt(0) === '$') {
                    const idx = toInteger(word.substring(1));
                    // Log.debug('[push]', '$ pr', word, wordStack.items, wordStack.id);
                    // value = wordStack.peek(idx);
                    value = wordStack.pop(idx);
                    // Log.debug('[push]', '$ po', word, wordStack.items, wordStack.id);
                    // Log.debug('[push]', '$', idx, 'pop', value, stack.id, wordStack.id);
                }

                else {
                    handler = wordStack.getWord(value);
                    // DLog(stack, '[push]', 'word', stack.id, wordStack.id, value );
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
                    // Log.debug('[push]', 'pre', this.focus().id, printStackLineage(stack) );//, this.focus().items );
                    let result = handler(stack, value);
                    value = isPromise(result) ? await result : result as InstResult;
                    // Log.debug('[push]', 'post', this.focus().id, printStackLineage(stack) );//, this.focus().items );
                    stack = this.focus();
                }
                // if( value ) Log.debug('[push]', value); 
            } catch (err) {
                // Log.warn('[push]', err.stack);
                let e = new StackError(`${err.message}`); // : ${unpackStackValue(value)}
                e.original = err
                e.stack = e.stack.split('\n').slice(0, 2).join('\n') + '\n'
                    + [...new Set(err.stack?.split('\n'))].join('\n');
                throw e;
            }
        }

        if (value !== undefined) { // && doPush !== false) {
            // Log.debug('[push]', stack.id, value);
            stack.items = [...stack.items, value];
        }

        return value;
    }

    /**
     * Pushes a value onto the stack without processing it
     * 
     * @param value 
     */
    pushRaw(value: StackValue): QueryStack {
        const stack = this;//.focus();
        stack.items = [...stack.items, value];
        return stack;
    }

    async pushValues(values: StackValue[], options: PushOptions = {}): Promise<StackValue[]> {
        let ovalues: StackValue[] = [];

        // Log.debug('[pushValues!]', values);

        // const stack = this.focus();
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
                let ovalue = await this.push(value);
                // Log.debug('[pushValues]', 'post', printStackLineage(this), 'focus', printStackLineage(this._focus) );
                // Log.debug('[pushValues]', 'post', this.id, this._parent?.id, stack.id, stack._parent?.id);
                // Object.assign(this, stack);
                // let end = perf.now() - st;
                // if( end > 10 ){
                //     Log.debug('[pushValues]', value, stackToString(pre), end );
                // }
                ovalues.push(ovalue);
            }

            // Object.assign(this, stack);
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

    popValue(offset: number = 0, recursive: boolean = true): any {
        const sv = this.pop(offset);
        return sv === undefined ? undefined : recursive ? unpackStackValueR(sv) : sv[1];
    }

    /**
     * 
     * @param offset 
     */
    pop(offset: number = 0): StackValue {
        const stack = this; //this.focus();

        const length = this.items.length;
        const idx = length - 1 - offset;
        if (idx < 0 || length === 0) {
            throw new StackError('stack underflow');
        }
        const value = stack.items[idx];
        let items;


        if (offset > 0) {
            // Log.debug('[pop]', idx, value );
            items = stack.items.filter((val, ii) => idx !== ii)
            // return [{...stack, items }, value];
        } else {
            items = stack.items.slice(0, -1);
        }
        stack.items = items;
        return value;
    }


    /**
     * Pops values from the stack while the type matches
     * 
     * @param stack 
     * @param type 
     */
    popOfType(...types: SType[]): StackValue[] {
        const stack = this; //this.focus();
        const length = stack.items.length;
        if (length === 0) {
            return [];
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

        return results;
    }


    addWords(words: WordSpec[], replace: boolean = false): QueryStack {
        
        for (const spec of words) {
            const [word, fn, ...args] = spec;
            
            let patterns = replace ? 
                [] 
                : (this.words[word] || []);
                // : Array.isArray(word) ? this.words[word[0]] : (this.words[word] || []);
                // : Array.isArray(word) ? word.reduce( (o,w) => [...o,this.words[w]], [] ) : (this.words[word] || []);
            patterns = [...patterns, [fn, (args as (SType[]))]] as WordEntry[];

            // if( Array.isArray(word) ){
            //     this.words = word.reduce( (out,w) => ({...out,[w]:patterns }), this.words );
            //     // console.log('[getWord]', this.words);
            //     // throw 'stop';
            // } else {
                this.words = { ...this.words, [word]: patterns };
            // }
        }

        return this;
    }


    getWord(value: StackValue): WordFn | undefined {
        // const [type,word] = value;
        if (value[0] !== SType.Value || !isString(value[1])) {
            return undefined;
        }
        const wval = value[1];

        const patterns = this.words[wval];
        if (patterns === undefined) {
            return undefined;
        }
        let pattern = patterns.find(pat => {
            const [, args] = pat;
            
            return matchStack(this.items, args) ? pat : undefined;

            // Log.debug('[getWord]', 'match', `'${wval}'`, args, stack.items );
        });
        // Log.debug('[getWord]', value, wval, pattern);
        if (pattern !== undefined) {
            return pattern[0];
        }

        // Log.debug('[getWord]', 'match', `'${wval}'`, patterns.map(p => p.slice(1)));
        // Log.debug('[getWord]', 'match', `'${wval}'`, stackToString(this));
        throw new StackError(`invalid params for ${wval}`);
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




    /**
     * 
     */
    findWithIndex(type: SType): [number, StackValue] {
        const stack = this;// this.focus();
        for (let ii = stack.items.length - 1; ii >= 0; ii--) {
            const item = stack.items[ii];
            if (type === item[0]) {
                // Log.debug('[findWithIndex]', 'found', item, ii );
                return [ii, item];
            }
        }
        return [-1, undefined];
    }

    //  findWithIndexV(stack: QueryStack, type: SType): [number, any] {
    //     let [index, [_, value]] = findWithIndex(stack, type);
    //     if (index === -1) {
    //         throw new Error(`type ${type} missing on stack`);
    //     }
    //     return [index, value];
    // }

    /**
     * Returns the first value of type from the stack
     * 
     * @param stack 
     * @param type 
     */
    findV(type: SType): any {
        const stack = this;// this.focus();
        const [_, value] = stack.findWithIndex(type);
        return value ? value[1] : undefined;
    }
    find(type: SType): StackValue {
        const stack = this; //this.focus();
        const [_, value] = stack.findWithIndex(type);
        return value;
    }


    popBitField<CD extends ComponentDef>(asObj: boolean = true): CD[] | ComponentDefId[] {
        const stack = this; //this.focus();
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
        return asObj ? defs : dids;
    }

    toString(): string {
        return stackToString(this);
    }
}



export function isStackValue(value: any): boolean {
    return Array.isArray(value) && value.length == 2;
}


function printStackLineage(st: QueryStack, result: string = '') {
    result += String(st.id);
    let curr = st;
    let pre = '';

    while (curr._parent) {
        pre = `${curr._parent.id} < ` + pre;
        curr = curr._parent;
    }

    curr = st;
    let post = '';
    while (curr._child) {
        post = post + `> ${curr._child.id}`;
        curr = curr._child;
    }

    return `${pre} (${st.id}) ${post}`;
}

export interface PushOptions {
    debug?: boolean;
}




export interface ExecuteOptions {
    pushResult?: boolean;
}


// interface WordMap {
//     [word: string]: [WordFn, SType[]]
// };




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
    const wordFn = stack.getWord([SType.Value, 'trace']);
    return (wordFn !== undefined && isStackValue(wordFn) && wordFn[1] === true);
}
export function DLog<QS extends QueryStack>(stack: QS, ...args) {
    const wordFn = stack.getWord([SType.Value, 'trace']);
    if (wordFn === undefined || !isStackValue(wordFn)) {
        return;
    }

    if (wordFn[1]) {
        Log.debug(...args);
    }
}