
import { isObject, isString, isPromise, isFunction, isInteger } from "../util/is";
import { createLog } from "../util/log";
import { deepExtend } from "../util/deep_extend";
import { stackToString, unpackStackValueR } from "./util";
import { toInteger } from "../util/to";
import { EntityId, getEntityId, Entity } from "../entity";
import { ComponentDefId, ComponentDef, getDefId } from "../component_def";
import { BitField, create as createBitField, toValues as bfToValues } from '../util/bitfield';
import {
    StackValue, WordFn, SType,
    StackError, InstResult, AsyncInstResult, WordSpec, WordEntry, Words
} from "./types";
import { EntitySet } from "../entity_set";
import { getComponentEntityId, getComponentDefId } from "../component";
import { buildBitfield } from "../entity_set/query";
const Log = createLog('QueryStack');


// let wordStack = [];

let pushValuesRun = 0;

export interface CloneOptions {
    items?: boolean;
    words?: boolean;
}

export const ActiveMode = {
    Active: 0,
    Leave: 1,
    Break: 2,
    Return: 3,
} as const;
type ActiveMode = typeof ActiveMode[keyof typeof ActiveMode]

// export const MODE_LEAVE = 0;
// export const MODE_BREAK = 1;

// type ActiveMode = 0 | 1;

let stackId = 0;

interface QueryStackInst {
    id: number;
    items: StackValue[];
    words: Words;
    isUDWordsActive: boolean;
    isEscapeActive: boolean;
    isActive: boolean;
    // pendingActive?: boolean;
    // leaveSet?: boolean;
    // wordStack: any[];
    // udWords: { [key:string]: any };
}

function createInst(): QueryStackInst {
    return {
        id: ++stackId,
        items: [],
        words: {},
        isUDWordsActive: true,
        isEscapeActive: true,
        isActive: true,
        // pendingActive: undefined,
        // leaveSet: undefined,
        // wordStack: []
        // udWords: {}
    };
}


export class QueryStack {

    es?: EntitySet;

    _idx: number = 0;
    _stacks: QueryStackInst[];

    // _udWords = new WeakMap();
    _udWords: { [key: string]: any } = {};

    debug: boolean = false;

    constructor(stack?: QueryStack) {
        this._stacks = [createInst()];
    }

    get inst(): QueryStackInst {
        return this._stacks[this._idx];
    }

    get words(): Words {
        return this._stacks[this._idx].words;
    }
    // get udWords(): { [key:string]: any } {
    //     return this._stacks[ this._idx ].udWords;
    // }
    get items(): StackValue[] {
        return this._stacks[this._idx].items;
    }

    set isUDWordsActive(val: boolean) {
        this._stacks[this._idx].isUDWordsActive = val;
    }
    get isUDWordsActive() {
        return this._stacks[this._idx].isUDWordsActive;
    }

    set isEscapeActive(val: boolean) {
        this._stacks[this._idx].isEscapeActive = val;
    }
    get isEscapeActive() {
        return this._stacks[this._idx].isEscapeActive;
    }

    set isActive(val: boolean) {
        this._stacks[this._idx].isActive = val;
    }

    get isActive() {
        return this._stacks[this._idx].isActive;
    }

    // get wordStack() {
    //     return this._stacks[this._idx].wordStack;
    // }

    // setActive(isit: boolean, mode: ActiveMode, reason: string) {
    //     this._stacks[this._idx].isActive = isit;
    //     // let entry = this.wordStack.pop();
    //     // if (entry !== undefined) {
    //     //     entry = { ...entry, active: isit, mode };
    //     //     this.wordStack.push(entry);
    //     //     // Log.debug('[setActive]', reason, entry, mode === ActiveMode.Leave ? 'leave' : 'break');
    //     // }
    // }

    // set pendingActive(val: boolean) {
    //     this._stacks[this._idx].pendingActive = val;
    // }

    // get pendingActive() {
    //     return this._stacks[this._idx].pendingActive;
    // }

    // set leaveSet(val:boolean){
    //     this._stacks[ this._idx ].leaveSet = val;
    // }
    // get leaveSet(){
    //     return this._stacks[this._idx].leaveSet;
    // }



    setItems(items: StackValue[]): QueryStack {
        this._stacks[this._idx].items = items;
        return this;
    }

    get size(): number {
        return this._stacks[this._idx].items.length;
    }

    getUDValue(word: string) {
        let value = this.getUDWord(word);
        return unpackStackValueR(value);
    }

    peek(offset: number = 0): StackValue {
        let items = this.items;
        const length = items.length;
        const idx = length - 1 - offset;
        // if (idx < 0 || length === 0) {
        //     // console.log('[pop]', this);
        //     throw new StackError(`stack underflow ${offset} / ${length}`);
        // }

        // const stack = this.focus();
        return items[idx];
    }

    clear(clearItems: boolean = true, clearWords: boolean = false): QueryStack {
        if (clearItems) {
            this._stacks[this._idx].items = [];
        }
        if (clearWords) {
            this._stacks[this._idx].words = {};
        }
        return this;
    }

    focus(): QueryStack {
        this._idx = this._stacks.length - 1;
        return this;
    }

    focusParent(): QueryStack {
        this._idx = this._idx > 1 ? this._idx - 1 : 0;
        return this;
    }

    // focusChild():QueryStack {
    //     const len = this._stacks.length-1;
    //     this._idx = this._idx < len ? this._idx + 1 : len;
    //     return this;
    // }

    setChild(stack?: QueryStack): QueryStack {
        let sub = createInst();
        if (stack !== undefined) {
            sub.words = deepExtend(stack.words);
        }
        this._stacks.push(sub);
        this._idx = this._stacks.length - 1;

        return this;
    }

    restoreParent(): QueryStack {
        if (this._stacks.length <= 1) {
            return this;
        }

        this._stacks.pop();
        this._idx = this._stacks.length - 1;

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
    async push(input: any | StackValue, options?: PushOptions): Promise<StackValue> {
        let value: StackValue;
        let handler: WordFn;
        // const ticket = options.ticket;

        value = isStackValue(input) ? input : [SType.Value, input];
        let [type, word] = value;

        // Log.debug('[push]', 'pre', this.isActive, value);

        if (this.isEscapeActive) {
            if (word == '@!' ) {
                this.isActive = false;
                // this.setActive(false, ActiveMode.Return, word);
            } else if (word == '@>' ) {
                this.isActive = true;
                // this.setActive(true, ActiveMode.Active, word);
                return value;
            }
        }

        if (this.isActive === false) {
            // Log.debug('[push]', 'inactive stack');
            return undefined;
        }


        // let doPush = true;
        const debug = options?.debug ?? false;
        const evalEscape = options?.evalEscape ?? false;

        if (type === SType.Value && isString(word)) {
            const len = word.length;
            let evalWord = true;

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
                else if (sigil === 'd') {
                    // console.log('new date yo', sigilV, new Date(sigilV) );
                    value = [SType.DateTime, sigilV == '' ? new Date() : new Date(sigilV)];
                }
            }

            // escape char for values which might otherwise get processed as words
            if (this.isEscapeActive && len > 1 && word.charAt(0) === '*') {
                word = word.substring(1);
                value = [SType.Value, word] as any;
                evalWord = evalEscape;// false;
                
                if( debug ) Log.debug('[push]', value, 'escaped');
            }

            if( evalWord ) {
                // save the current stack
                let stackIndex = this._idx;

                if (len > 1) {
                    // words beginning with ^ cause the stack focus to move up
                    while (word.charAt(0) === '^') {
                        // let st = wordStack.id;
                        this.focusParent();
                        // Log.debug('[push]', '^', word, 'start at', this._idx, this.wordStack);
                        word = word.substring(1);
                        value = [type, word];
                    }

                    // if( debug ) Log.debug('[push]', 'post up', word, value );

                    // if( up ) Log.debug('[push]', '^', word, wordStack.id, printStackLineage(wordStack) );
                    // Log.debug('[getWord]', 'from parent', word, parent.words );
                    // handler = getWord(parent, [SType.Value, word.substring(1)]);
                }

                // words beginning with $ refer to offsets on the root stack if they are integers,
                // or user defined words
                const pr = word.charAt(0);
                if (len > 1 && pr === '$' || pr === '%') {
                    let sub = word.substring(1);
                    // Log.debug('[push]', word, this._idx, isInteger(sub), this.isUDWordsActive );
                    if (isInteger(sub)) {
                        const idx = toInteger(sub);
                        // Log.debug('[push]', '$ pr', word, this.toString() );
                        
                        value = pr === '$' ? this.pop(idx) : this.peek(idx);
                        // Log.debug('[push]', '$ pr', word, this.toString() );
                    }
                    else if (this.isUDWordsActive) {
                        handler = this.getUDWord(sub);
                        // Log.debug('[push]', 'getUDWord', sub, handler);

                    }
                    // Log.debug('[push]', '$ po', word, wordStack.items, wordStack.id);
                    // Log.debug('[push]', '$', idx, 'pop', value, stack.id, wordStack.id);
                }

                else {
                    // try for a user defined word - these are global
                    // if( len > 1 && word.charAt(0) === '@' ){
                    //     handler = this.getUDWord( word.substring(1) );
                    // }

                    // try for a regular word - these are scoped to the current stack
                    // if( handler === undefined ){
                    handler = this.getWord(value);
                    // Log.debug('[push][getWord]', value, handler );
                    // if( this.debug && word === 'count' ) Log.debug( this.words );
                    // if( this.debug && word === 'count' ) throw new StackError('stop');
                    // }

                    // Log.debug('[push]', 'word', stack?.id, wordStack?.id );
                    // handler = this.getWord(value);
                    // if( value[1] === 'dstId' ){
                    //     let wh = this.getUDWord(value[1]);
                    //     Log.debug('[push]', 'word?', value);
                    //     Log.debug('[push]', 'word', stackIndex, handler, wh );
                    // }
                    // DLog(stack, '[push]', 'word', stack.id, wordStack.id, value );
                }

                // restore back to original index
                this._idx = stackIndex;
            }
        }

        // if( word === 'leave' ){
        // Log.debug('[push]', word, handler );
        // }

        // Log.debug('[push]', 'pre', { isActive: this.isActive, isEscapeActive: this.isEscapeActive }, value, handler);

        if (handler !== undefined) {
            try {
                if (isStackValue(handler)) {
                    value = (handler as any);
                }
                else {

                    let handlerVal = value;
                    // Log.debug('[push]', 'pre', this.isActive, value);
                    let result = handler(this, value);
                    value = isPromise(result) ? await result : result as InstResult;
                    this.focus();
                    if (value === undefined) {
                        // Log.debug('[push]', 'post', this.isActive, this.items );
                    }
                }
                // if( value && this.debug ) Log.debug('[push]', value); 
            } catch (err) {
                // Log.warn('[push]', err.stack);
                let e = new StackError(`${err.message}`); // : ${unpackStackValue(value)}
                e.original = err
                e.stack = e.stack.split('\n').slice(0, 2).join('\n') + '\n'
                    + [...new Set(err.stack?.split('\n'))].join('\n');
                throw e;
            }
        }

        if (value !== undefined) {
            this.items.push(value);
        }
        // Log.debug('[push]', word, value, handler, this.isActive );
        // Log.debug('[push]', this.items );

        return value;
    }

    /**
     * Pushes a value onto the stack without processing it
     * 
     * @param value 
     */
    pushRaw(value: StackValue): QueryStack {
        const stack = this;//.focus();
        // stack.items = [...stack.items, value];
        stack.items.push(value);
        return stack;
    }

    // async pushWordValues(stack: QueryStack, word: string, values: StackValue[], options: PushOptions = {}) {
    //     const ticket = Math.random().toString(36).substring(7);
    //     const ignoreActive = options.ignoreActive ?? false;
    //     const isWord = options.isWord ?? false;
    //     const wasActive = stack.isActive;
    //     let activeMode: ActiveMode = ActiveMode.Active;
    //     // stack.leaveSet = undefined;

    //     let wordActive: boolean = undefined;

    //     // let opts = { isActive: stack.isActive, wasActive, ignoreActive, pendingActive: stack.pendingActive };

    //     // if( isWord ){
    //     // this.wordStack.push({ word, isWord });
    //     // }

    //     // console.log('[pushWordValues]', 'start', ticket, word, this.wordStack, values);

    //     // if( stack.pendingActive ){
    //     //     stack.isActive = true;
    //     //     stack.pendingActive = undefined;
    //     // }
    //     // else if( wasActive && !stack.isActive ){
    //     //     stack.pendingActive = true;
    //     // }

    //     const result = await this.pushValues(values, { ticket });

    //     // if( isWord ){
    //     // let entry = this.wordStack.pop();
    //     // // console.log('[pushWordValues]', 'end', word, 'entry', entry);
    //     // wordActive = entry.active;
    //     // activeMode = entry.mode ?? ActiveMode.Active;
    //     // if (isWord) {
    //     //     if (entry.subActive === false) {
    //     //         wordActive = true;
    //     //     }
    //     // }
    //     // else if (wordActive === false) {
    //     //     let above = this.wordStack.pop();
    //     //     if (above !== undefined) {
    //     //         this.wordStack.push({ ...above, mode: activeMode, subActive: false });
    //     //     }
    //     // }

    //     // console.log('[pushWordValues]', 'staaack!',activeMode, this.wordStack);
    //     // console.log('[pushWordValues]', 'woorrdd!', entry); 
    //     // }

    //     // if( entry !== undefined ){
    //     //     let {active} = entry;
    //     // }

    //     // opts = { isActive: stack.isActive, wasActive, ignoreActive, pendingActive: stack.pendingActive };
    //     // if( stack.pendingActive ){
    //     //     stack.isActive = true;
    //     //     stack.pendingActive = undefined;
    //     //     console.log('[pushWordValues]', 'end', ticket, word, 'reactive after pending', {...opts,pendingActive:stack.pendingActive});
    //     // }
    //     // // else if( ignoreActive === false && wasActive && !stack.isActive ){
    //     // // }
    //     // else if( ignoreActive === false && wasActive && !stack.isActive ){
    //     //     // if( wordStack.length === 0 ){
    //     //     //     stack.isActive = true;
    //     //     //     console.log('[pushWordValues]', 'end', ticket, word, 'wordstack empty', {...opts,pendingActive:stack.pendingActive} );
    //     //     // } else 
    //     //     {
    //     //     stack.pendingActive = true;
    //     //     console.log('[pushWordValues]', 'end', ticket, word, 'set pending', {...opts,pendingActive:stack.pendingActive} );
    //     //     }
    //     // }
    //     // else {
    //     //     console.log('[pushWordValues]', 'end', ticket, word, opts );
    //     // }

    //     // console.log('[pushWordValues]', 'end', word, { wordActive, isWord, isActive: stack.isActive, activeMode });

    //     // if (isWord) {
    //     //     if (activeMode === ActiveMode.Leave) {
    //     //         stack.isActive = true;
    //     //     } else if (activeMode === ActiveMode.Break) {

    //     //     }
    //     // }

    //     // if( isWord ){
    //     // if( isWord && stack.isActive === false && wordActive === false ){
    //     //     stack.isActive = true;
    //     //     console.log('[pushWordValues]', 'end', word, 'reset active');
    //     // }else {
    //     //     // console.log('[pushWordValues]', 'fuck', isWord, stack.isActive, wordActive );
    //     // }

    //     // if( wordStack.length === 0 && !stack.isActive ){
    //     // console.log('[pushWordValues]', 'end', 'clearing active');
    //     // stack.isActive = true;
    //     // }

    //     // stack.leaveSet = undefined;

    //     return result;
    // }

    async pushValues(values: StackValue[], options: PushOptions = {}): Promise<number> {
        // let ovalues: StackValue[] = [];
        const ignoreActive = options.ignoreActive ?? false;
        // const ticket = options.ticket;
        const debug = options.debug;

        // if( ignoreActive === false ) pushValuesRun++;


        // if( !ignoreActive ){
        //     Log.debug('[pushValues$]', 'inc run from', pushValuesRun, 'to', pushValuesRun+1);    
        // }

        // let run = !ignoreActive ? pushValuesRun++ : pushValuesRun;
        // let run = pushValuesRun++;
        // let run = pushValuesRun; // !ignoreActive ? pushValuesRun++ : pushValuesRun;
        // if( ignoreActive !== true ){
        //     pushValuesRun++;
        //     run = pushValuesRun;
        // }
        let count = 0;
        // let revertActive = false;
        // Log.debug('[pushValues$]', this.isActive, {run,ticket}, values);
        // let startActive = this.isActive;

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
                // Log.debug('[pushValues!]', run, count, value);
                // }
                // let pre = stack;
                // let st = perf.now();
                // let isActive = this.isActive;
                let ovalue = await this.push(value, options);
                // if( isActive && !this.isActive ){
                //     Log.debug('[pushValues!]', run, count, 'inactive'); 
                // }
                // revertActive = isActive !== this.isActive;
                // Log.debug('[pushValues!]', run, `${count}/${values.length}`, this.isActive, value);

                // if( this.isActive === false && ignoreActive === false ){
                // if (this.isActive === false) {
                //     //     // Log.debug('[pushValues]', run, count, 'breaking due to inactive', value, values);
                //     //     this.isActive = true;
                //     break;
                // }

                // let end = perf.now() - st;
                // if( end > 10 ){
                //     Log.debug('[pushValues]', value, stackToString(pre), end );
                // }
                // ovalues.push(ovalue);
                count++;
            }

            // if( revertActive ){
            //     this.isActive = true;
            // }
            // Object.assign(this, stack);
            // let changed = startActive && !this.isActive;
            // Log.debug('[pushValues]', 'finished', this.isActive, {run,ticket, count} );

            if (ignoreActive) {
                // this.isActive = true;
            }

        } catch (err) {
            // Log.debug('st un?', (stack as any)._parent.items );
            let e = new StackError(`${err.message}: (${stackToString(this)})`);
            e.original = err
            e.stack = e.stack.split('\n').slice(0, 2).join('\n') + '\n'
                + err.stack;// [...new Set(err.stack.split('\n'))].join('\n');
            throw e;
        }

        return count;
        // return ovalues;
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
        // const stack = this; //this.focus();

        const length = this.items.length;
        const idx = length - 1 - offset;
        if (idx < 0 || length === 0) {
            // console.log('[pop]', this);
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
        this.setItems(items);// = items;
        return value;
    }


    /**
     * Pops values from the stack while the type matches
     * 
     * @param stack 
     * @param type 
     */
    popOfType(...types: SType[]): StackValue[] {
        // const stack = this; //this.focus();
        const length = this.items.length;
        if (length === 0) {
            return [];
        }

        let results = [];
        let ii = length - 1;

        for (ii; ii >= 0; ii--) {
            const value = this.items[ii];
            if (types.indexOf(value[0] as SType) === -1) {
                break;
            }
            results.push(value);
        }

        // cut the stack down to size
        this.setItems(this.items.slice(0, ii + 1));

        return results;
    }

    addUDWord(word: string, val: any): QueryStack {
        // console.log('[addUDWord]', this._idx, word, val );
        // this.udWords[word] = val;
        this._udWords[word] = val;
        // this._udWords.set(word, val);
        // return this.addWords([[word,val]], true);
        return this;
    }

    getUDWord(word: string) {
        return this._udWords[word];
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
            this.words[word] = patterns;
            // this.words = { ...this.words, [word]: patterns };
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

        // if (options.items ?? true) {
        //     result.items = deepExtend(this.items);
        // }
        // if (options.words ?? true) {
        //     result.words = deepExtend(this.words);
        // }

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


    /**
     * Conditionally pops a bitfield from the stack if it is present.
     * If it is, then either defs or dids are returned as a result.
     * 
     * @param asObj 
     */
    popBitField<CD extends ComponentDef>(asObj: boolean = true): CD[] | ComponentDefId[] {
        const stack = this; //this.focus();
        const { es } = stack;
        let val;
        let dids: ComponentDefId[];
        let defs: CD[];
        val = stack.peek();

        let [type, bf] = val;
        // Log.debug('[popBitField]', 'yes', stack.items);
        if (type === SType.BitField) {
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

    popBitFieldOpt(): BitField {
        const stack = this;
        let val = stack.peek();
        if (val === undefined) {
            return undefined;
        }
        let [type, bf] = val;
        if (type === SType.BitField) {
            stack.pop();
            return bf;
        }
        else if (type === SType.Value && bf === 'all') {
            stack.pop();
            return createBitField(bf);
        }
        return undefined;
    }

    toString(reverse: boolean = true): string {
        return stackToString(this, reverse);
    }
}



export function isStackValue(value: any): boolean {
    return Array.isArray(value) && value.length == 2;
}


// function printStackLineage(st: QueryStack, result: string = '') {
//     result += String(st.id);
//     let curr = st;
//     let pre = '';

//     while (curr.getParent()) {
//         pre = `${curr._parent} < ` + pre;
//         curr = curr.focus(curr._parent);
//     }

//     curr = st;
//     let post = '';
//     while (curr.getChild()) {
//         post = post + `> ${curr._child}`;
//         curr = curr.getChild();
//     }

//     return `${pre} (${st.id}) ${post}`;
// }

export interface PushOptions {
    debug?: boolean;
    ignoreActive?: boolean;
    ticket?: string;
    isWord?: boolean;
    evalEscape?: boolean;
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