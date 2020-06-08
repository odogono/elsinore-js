
import { isObject, isString, isPromise, isFunction, isInteger } from "../util/is";
import { createLog } from "../util/log";
import { deepExtend } from "../util/deep_extend";
import { stackToString } from "./util";
import { toInteger } from "../util/to";
import { EntityId, getEntityId } from "../entity";
import { ComponentDefId, ComponentDef, getDefId } from "../component_def";
import { toValues as bfToValues } from '../util/bitfield';
import { QueryStack, StackValue, WordFn, SType, 
    StackError, InstResult, AsyncInstResult, WordSpec, WordEntry 
} from "./types";
const Log = createLog('QueryStack');



let stackId = 0;

export function create<QS extends QueryStack>(): QS {
    return {
        id: ++stackId,
        items: [],
        words: {}
    } as QS;
}



export function isStackValue(value: any): boolean {
    return Array.isArray(value) && value.length == 2;
}


export interface CloneOptions {
    items?: boolean;
    words?: boolean;
}


/**
 * 
 * @param stack 
 * @param options 
 */
export function clone<QS extends QueryStack>(stack: QS, options:CloneOptions = {}): QS {
    const doItems = options.items ?? true;
    const doWords = options.words ?? true;

    let result = create<QS>();

    if( doItems ){
        result.items = deepExtend(stack.items);
    }
    if( doWords ){
        result.words = deepExtend(stack.words);
    }

    return result;
}

/**
 * Pushes a stack value onto the stack
 */
export async function push<QS extends QueryStack>(stack: QS, input: any | StackValue): Promise<[QS, StackValue]> {
    // Log.debug('[push]',value );
    // let resultStack:QS = stack;
    let value:StackValue;
    let handler:WordFn<QS>;
    value = isStackValue(input) ? input : [SType.Value, input];
    
    let doPush = true;
    let lastStack:QS = undefined;
    let [type,word] = value;
    
    if( type === SType.Value && isString(word) ){
        const len = word.length;

        // escape char for values which might otherwise get processed as words
        if( len > 1 && word.charAt(0) === '*' ){
            value = [SType.Value,word.substring(1)] as any;
        }
        else {
            
            if( len > 1 ){
                while( word.charAt(0) === '^' ){
                    if( stack._parent !== undefined ){
                        if( lastStack === undefined ){
                            lastStack = stack;
                            // Log.debug('[push]', '^', 'start at', stack.id);
                        }
                        // Log.debug('[push]', '^', word, {id:stack.id, parent:stack._parent.id, o:lastStack.id});
                        stack._parent._child = stack;
                        stack = stack._parent;
                        // Log.debug('[push]', '^', word, Object.keys(stack.words) );
                    }
                    word = word.substring(1);
                    value = [type, word];
                }
                // Log.debug('[getWord]', 'from parent', word, parent.words );
                // handler = getWord(parent, [SType.Value, word.substring(1)]);
            }

            // words beginning with $ refer to offsets on the root stack
            if( len > 1 && word.charAt(0) === '$' ){
                const idx = toInteger(word.substring(1));
                // let root = stack._root || stack;
                // let root = stack._parent || stack;
                // Log.debug('[push]', '$', idx, peek(root,idx), root);
                // Log.debug('[push]', '$', 'pop', idx, {id:stack.id, o:lastStack.id}, '~', stackToString(stack));
                // Log.debug(stack);
                // [root,value] = pop(root,idx);
                [stack,value] = pop(stack,idx);
                // lastStack._parent = stack;
                if( lastStack !== undefined ){
                    // horribly sucky, but otherwise the change to the stack here
                    // will get lost if we have ascended previously
                    stack = updateStackRefs( stack );
                }

                // Log.debug('[push]', '$', 'pop', value, {id:stack.id, o:lastStack.id}, '~', stackToString(stack));
                // stack._root = root;
                // value = peek(root,idx);
                // Log.debug('[push]', '$', 'cur', stack);
                // Log.debug('[push]', '$', 'las', lastStack);
            }

            else {
                // Log.debug('[push]','word', value );
                handler = getWord(stack, value);
            }
        }
    }
    if( lastStack !== undefined ){
        // Log.debug('[push]', '^', word, 'restore', {id:stack.id, o:lastStack.id});
        stack = lastStack;
        // Log.debug('[push]', '^', word, Object.keys(stack.words) );
    }

    // Log.debug('[push]','word', input, handler );

    if (handler !== undefined) {
        try {
            if( isStackValue(handler) ){
                value = (handler as any);
            }
            else {
                let result = handler(stack, value);
                [stack, value, doPush] = isPromise(result) ? await result : result as InstResult<QS>;
            }
            // if( value ) Log.debug('[push]', value); 
        } catch (err) {
            // Log.warn('[push]', err.stack);
            let e = new StackError(`${err.message}`); // : ${unpackStackValue(value)}
            e.original = err
            e.stack = e.stack.split('\n').slice(0,2).join('\n') + '\n' 
                + [...new Set(err.stack.split('\n'))].join('\n');
            throw e;
        }
    }
    
    if (value !== undefined && doPush !== false) {
        stack = { ...stack, items: [...stack.items, value] };
    }

    return [stack, value];
}

function updateStackRefs<QS extends QueryStack>(stack: QS): QS {
    // walk children
    let cur = stack;
    while( cur._child !== undefined ){
        let child = cur._child;
        if( child._parent?.id === stack.id ){
            child._parent = stack;
        }
        if( child._root?.id === stack.id ){
            child._root = stack;
        }
        cur = child;
    }
    return stack;
}

export function pushRaw<QS extends QueryStack>(stack: QS, value: StackValue): QS {
    return { ...stack, items: [...stack.items, value] };
}

export interface PushOptions {
    debug?:boolean;
}

export async function pushValues<QS extends QueryStack>(stack: QS, values: StackValue[],options:PushOptions = {}): Promise<[QS, StackValue[]]> {
    let ovalues: StackValue[] = [];

    try {
    for( const value of values ){
        let ovalue;
        // let perf;
        // if( process.env.JS_ENV !== 'browser' ){
        //     const pf = require('perf_hooks');
        //     perf = pf.performance;
        // } else {
        //     perf = performance;
        // }
        // DLog(stack, '[pushValues]', value);
        // if( options.debug ){
        //     Log.debug('[pushValues!]', value);
        // }
        // let pre = stack;
        // let st = perf.now();
        [stack, ovalue] = await push(stack, value);
        // let end = perf.now() - st;
        // if( end > 10 ){
        //     Log.debug('[pushValues]', value, stackToString(pre), end );
        // }
        ovalues.push(ovalue);
    }

    } catch( err ){
        // Log.debug('st un?', (stack as any)._parent.items );
        let e = new StackError(`${err.message}: (${stackToString(stack)})`);
        e.original = err
        e.stack = e.stack.split('\n').slice(0,2).join('\n') + '\n' 
            + err.stack;// [...new Set(err.stack.split('\n'))].join('\n');
        throw e;
    }
    return [stack, ovalues];
}


/**
 * Prepends a value to the stack
 * 
 * @param stack 
 * @param value 
 */
export function unshift(stack: QueryStack, value: StackValue): QueryStack {
    return {
        ...stack,
        items: [value, ...stack.items]
    }
}

/**
 * Removes and returns a value from
 * @param stack 
 */
// export function shift(stack: QueryStack): [QueryStack, StackValue] {
//     let items = [...stack.items];
//     let value = items.shift();
//     return [{ ...stack, items }, value];
// }

// export function unshiftV(stack: QueryStack, value: any, valueType = SType.Value): QueryStack {
//     let itemValue: StackValue = [valueType, value];
//     if (isObject(value) && value.type) {
//         itemValue = [value.type, value];
//     }
//     return unshift(stack, itemValue);
// }

/**
 * Pushes an arbirtrary value onto the stack
 */
// export function pushV( stack:QueryStack, value:any, valueType = AnyValue ):QueryStack {
//     let itemValue:StackValue = [ valueType, value ];
//     if( isObject(value) && value.type ){
//         itemValue = [value.type, value];
//     }
//     return push( stack, itemValue );
// }

export function pop<QS extends QueryStack>(stack: QS, offset:number = 0): [QS, StackValue] {
    const length = stack.items.length;
    // if (length === 0) {
    //     // return undefined;
    // }
    const idx = length-1-offset;
    if( idx < 0 || length === 0 ){
        throw new StackError('stack underflow');
    }
    const value = stack.items[idx];
    let items;

    
    if( offset > 0 ){
        // Log.debug('[pop]', idx, value );
        items = stack.items.filter( (val,ii) => idx !== ii )
        // return [{...stack, items }, value];
    } else {
        items = stack.items.slice(0, -1);
    }
    stack = {...stack, items};
    return [stack, value];
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
    stack = {
        ...stack,
        items: stack.items.slice(0, ii + 1)
    };

    return [stack, results];
}

// export function popOfTypeV(stack: QueryStack, ...types: SType[]): [QueryStack, any[]] {

//     let results = [];
//     [stack, results] = popOfType(stack, ...types);
//     return [stack, results.map(r => r[1])];
// }

export function peek(stack: QueryStack, offset: number = 0): StackValue {
    return stack.items[stack.items.length - 1 - offset];
}

// export function peekV(stack: QueryStack): any {
//     const value = stack.items[stack.items.length - 1];
//     if (value !== undefined) {
//         return value[1];
//     }
//     return undefined;
// }



/**
 * Replaces an item in the stack at the given index
 * 
 * @param stack 
 * @param index 
 * @param newItem 
 */
export function replace(stack: QueryStack, index: number, newItem: StackValue): QueryStack {
    const items = stack.items.map((item, ii) => {
        if (ii !== index) {
            return item;
        }
        return newItem;
    });
    return { ...stack, items };
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


export function popBitField<ST extends QueryStack, CD extends ComponentDef>(stack:ST, asObj:boolean = true): [ST,CD[] | ComponentDefId[]] {
    const {es} = stack;
    let val;
    let dids:ComponentDefId[];
    let defs:CD[];
    val = peek(stack);

    let [type, bf] = val;
    // Log.debug('[popBitField]', 'yes', stack.items);
    if( type === SType.Bitfield ){
        dids = bfToValues(bf);
        defs = asObj ? dids.map( d => es.getByDefId(d) as CD ) : [];
    } else if( type === SType.Value && bf === 'all' ){
        // get all def ids
        if( asObj ){
            defs = es.componentDefs as CD[];
        } else {
            dids = es.componentDefs.map(d => getDefId(d));
        }
    }
    if( dids !== undefined || defs !== undefined ){
        [stack] = pop(stack);
    }
    return [stack, asObj ? defs : dids ];
}

export interface ExecuteOptions {
    pushResult?: boolean;
}


// interface WordMap {
//     [word: string]: [WordFn, SType[]]
// };



export function addWords<QS extends QueryStack>(stack: QS, words: WordSpec<QS>[], replace:boolean = false):QS {
    // Log.debug('[addWords]', words );//[fn,args]);
    return words.reduce((stack, spec) => {
        const [word, fn, ...args] = spec;
        let patterns = replace ? [] : stack.words[word] || [];
        patterns = [...patterns, [fn, (args as (SType[]))] ] as WordEntry<QS>[];
        return { ...stack, words: { ...stack.words, [word]: patterns } };
    }, stack);
}


function getWord<QS extends QueryStack>(stack: QS, value: StackValue): WordFn<QS> | undefined {
    // const [type,word] = value;
    if (value[0] !== SType.Value || !isString(value[1]) ) {
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
    if( pattern !== undefined ){
        return pattern[0];
    }
    
    Log.debug('[getWord]', 'match', `'${wval}'`, patterns.map(p => p.slice(1)) );
    Log.debug('[getWord]', 'match', `'${wval}'`, stackToString(stack));
    throw new StackError(`invalid params for ${wval}`);
}


export function entityIdFromValue( value:StackValue ):EntityId {
    const [type,val] = value;
    switch( type ){
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
        const [vt,v] = stackItems[sLength - 1 - ii];
        if (sym !== SType.Any && sym !== vt && sym !== v ) {
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



export function isDLogEnabled<QS extends QueryStack>(stack:QS) {
    const wordFn = getWord(stack,[SType.Value,'trace']);
    return ( wordFn !== undefined && isStackValue(wordFn) && wordFn[1] === true );
}
export function DLog<QS extends QueryStack>(stack:QS, ...args) {
    const wordFn = getWord(stack,[SType.Value,'trace']);
    if( wordFn === undefined || !isStackValue(wordFn) ){
        return;
    }

    if( wordFn[1] ){
        Log.debug(...args);
    }
}