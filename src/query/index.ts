import { SType, StackValue } from "./types";

import { 
    onAddComponentToEntity, onAddToEntitySet, onAddArray, onAdd, 
    onPrint, 
    onFetchArray, 
    onListOpen, onMapOpen, 
    onUnexpectedError, 
    onBuildMap, 
    onDrop, onSwap, onPush, onPop, onMap, 
    onUnique, onFilter, onReduce, onConcat, 
    onClear, 
    onDup, onSelect, 
    onListSpread, 
    onListEval,
    onComponentDef, 
    fetchComponentDef, 
    // onEntitySet, 
    onComponent, onEntity, 
    onAssertType,
    onPrintStack,
    onToString,
    onRegex,
    onDateTime,
    onRot,
    onSize,
    onGather,
    onRemoveFromEntitySet,
    // onLeave,
    onJoin,
    onUndefined,
    onRegexBuild,
    onCompare
} from "./words";
import { onPluck } from "./words/pluck";
import { onDefine } from "./words/define";
import { onLoop } from "./words/loop";
import {
    QueryStack,
} from './stack';
import { tokenizeString } from "./tokenizer";
import { onCondition } from "./words/cond";
import { Entity } from "../entity";
import { getComponentDefId, getComponentEntityId } from "../component";
export { QueryStack };
export const parse = (q:string) => tokenizeString(q,{returnValues:true});

export interface QueryOptions {
    stack?:QueryStack;
    values?:StackValue[];
    reset?:boolean;
}

export interface StatementArgs {
    [key:string]: any;
}
/**
 * 
 */
export class Statement {
    insts: any[];
    stack:QueryStack;
    // initial stack values
    values: StackValue[];

    constructor(q:string, options:QueryOptions = {}){
        this.stack = options.stack ?? createStdLibStack();
        this.insts = tokenizeString(q, {returnValues:true});
        this.values = options.values;
    }

    async clear(){
        await this.stack.clear();
        if( this.values ){
            await this.stack.pushValues( this.values );
        }
    }
    
    async run(args?:StatementArgs){
        await this.clear();
        
        if( args !== undefined ){
            const defines = Object.keys(args).reduce( (out,key) => {
                let val = args[key];
                val = Array.isArray(val) ? 
                    [SType.List, val.map( v => [SType.Value,v]) ] 
                    : [SType.Value, val];
                return [...out, 
                    val,
                    [SType.Value, key],
                    [SType.Value, 'let']
                ];
            }, []);
            await this.stack.pushValues( defines );
        }
        await this.stack.pushValues(this.insts);

        return this;
    }

    /**
     * Runs the statement and returns the top item
     * on the result stack
     * 
     * @param args 
     */
    async pop(args?:StatementArgs){
        await this.run(args);
        return this.stack.popValue();
    }

    /**
     * Runs the values on the stack and returns
     * the top value
     * 
     * @param args 
     */
    async getResult(args?:StatementArgs){
        await this.run(args);
        // console.log('[getResult]', this.stack.toString() );
        let result = this.stack.popValue();
        // console.log('[getResult]', 'result', result );
        return result;
    }

    /**
     * Returns the user defined word defined on the stack
     * 
     * @param word 
     */
    getValue(word:string){
        return this.stack.getUDValue(word);
    }
    

    

    /**
     * Runs the query and returns the result as an array of
     * entities if appropriate
     * 
     * @param args 
     */
    async getEntities(args?:StatementArgs): Promise<Entity[]> {
        await this.run(args);

        const value = this.stack.pop();
        let result: Entity[] = [];
        if (value === undefined) { return result; }

        const es = this.stack.es;
        const [type, val] = value;

        if (type === SType.List) {
            let e: Entity;
            for (const [lt, lv] of val) {
                if (lt === SType.Entity) {
                    result.push(lv);
                }
                else if (lt === SType.Component) {
                    
                    let eid = getComponentEntityId(lv);
                    let did = getComponentDefId(lv);
                    // const name = this.getByDefId(did).name;
                    if (e === undefined || e.id !== eid) {
                        if (e !== undefined) {
                            result.push(e);
                        }
                        e = es.createEntity(eid);
                    }
                    e.addComponentUnsafe(did, lv);
                }
            }
            if (e !== undefined) {
                result.push(e);
            }
        } else if (type === SType.Component) {
            // result.push( addCom(undefined,val));
            let eid = getComponentEntityId(val);
            let did = getComponentDefId(val);
            // const name = this.getByDefId(did).name;
            let e = es.createEntity(eid);
            e.addComponentUnsafe(did, val);
            result.push(e);
        } else if (type == SType.Entity) {
            result.push(val);
        }

        return result;
    }
}


/**
 * 
 * @param q 
 * @param options 
 */
export async function query( q:string, options:QueryOptions = {} ): Promise<QueryStack> {
    let stack = options.stack ?? createStdLibStack();
    const values = options.values;

    if( values ){
        await stack.pushValues( values );
    }

    if( q ){
        const insts = tokenizeString(q, {returnValues:true});
        await stack.pushValues(insts);
    }

    return stack;
}

/**
 * 
 * @param stack 
 */
export function createStdLibStack( stack?:QueryStack ){

    stack = stack ?? new QueryStack();

    stack = stack.addWords([
        ['+', onAddComponentToEntity, SType.Entity, SType.Component],
        ['+', onAddComponentToEntity, SType.Entity, SType.List],
        ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
        ['-', onRemoveFromEntitySet, SType.EntitySet, SType.Any],
        // pattern match stack args
        ['+', onAddArray, SType.List, SType.Any],
        ['+', onAddArray, SType.Any, SType.List],

        ['eval', onRegex, SType.Any, SType.Regex],
        ['split', onRegex, SType.Value, SType.Regex],
        ['replace', onRegex, SType.Value, SType.Value, SType.Regex],
        ['==', onRegex, SType.Value, SType.Regex],
        ['!=', onRegex, SType.Value, SType.Regex],
        ['!r', onRegexBuild, SType.Value],

        
        ['==', onDateTime, SType.DateTime, SType.DateTime],
        ['!=', onDateTime, SType.DateTime, SType.DateTime],
        ['>', onDateTime, SType.DateTime, SType.DateTime],
        ['>=', onDateTime, SType.DateTime, SType.DateTime],
        ['<', onDateTime, SType.DateTime, SType.DateTime],
        ['<=', onDateTime, SType.DateTime, SType.DateTime],

        // important that this is after more specific case
        ['+', onAdd, SType.Value, SType.Value],
        ['*', onAdd, SType.Value, SType.Value],
        ['%', onAdd, SType.Value, SType.Value],
        ['==', onAdd, SType.Value, SType.Value],
        ['!=', onAdd, SType.Value, SType.Value],
        ['>', onAdd, SType.Value, SType.Value],
        ['>=', onAdd, SType.Value, SType.Value],
        ['<', onAdd, SType.Value, SType.Value],
        ['<=', onAdd, SType.Value, SType.Value],
        ['.', onPrint, SType.Any],
        ['..', onPrint],

        ['==', onCompare, SType.Any, SType.Any],
        ['!=', onCompare, SType.Any, SType.Any],

        ['@', onFetchArray, SType.List, SType.Value],

        // a defined value is evaled when pushed onto the stack
        ['define', onDefine, SType.Any, SType.Value],
        // a let or ! value is just pushed onto the stack
        ['let', onDefine, SType.Any, SType.Value],
        ['!', onDefine, SType.Any, SType.Value],

        ['[', onListOpen],
        ['{', onMapOpen],
        ['}', onUnexpectedError],
        [']', onUnexpectedError],
        ['to_map', onBuildMap],
        ['to_str!', onToString],
        ['to_str', onToString],
        ['join', onJoin, SType.Value, SType.Value],
        ['join', onJoin, SType.List, SType.Value],
        ['drop', onDrop, SType.Any],
        ['swap', onSwap, SType.Any, SType.Any],
        ['push', onPush, SType.List, SType.Any],
        ['pop?', onPop, SType.List],
        ['pop!', onPop, SType.List],
        ['pop', onPop, SType.List],
        ['map', onMap, SType.List, SType.List],
        ['pluck', onPluck, SType.Map, SType.Value],
        ['pluck', onPluck, SType.Component, SType.Value],
        ['pluck', onPluck, SType.List, SType.Value],
        ['pluck', onPluck, SType.List, SType.List],
        ['pluck', onPluck, SType.Any, SType.Value],
        
        ['unique', onUnique, SType.List],
        ['filter', onFilter, SType.List, SType.List],
        ['reduce', onReduce, SType.List, SType.Any, SType.List],
        
        ['gather', onGather],
        // ['concat', onConcat],
        ['concat', onConcat, SType.Any, SType.List],
        ['cls', onClear],
        ['dup', onDup, SType.Any],
        ['over', onDup, SType.Any],
        ['rot', onRot, SType.Any, SType.Any, SType.Any],
        ['select', onSelect, SType.Any, SType.List],
        ['spread', onListSpread, SType.List],
        
        ['eval', onListEval, SType.List],
        // ['cond', onCondition, SType.Any, SType.Any, SType.Any], // cond, if, else
        ['iif', onCondition, SType.Any, SType.Any, SType.Any], // cond, if, else
        ['if', onCondition, SType.Any, SType.Any],
        ['size!', onSize, SType.Any],
        ['size', onSize, SType.Any],
        ['loop', onLoop, SType.List],
        // ['leave', onLeave],
        // ['break', onLeave],
        // ['return', onLeave],
        ['undefined', onUndefined],
        ['!d', onComponentDef, SType.Map],
        ['!d', onComponentDef, SType.List],
        ['!d', onComponentDef, SType.Value],
        ['@d', fetchComponentDef, SType.EntitySet],
        ['@d', fetchComponentDef, SType.EntitySet, SType.Value],
        // ['!bf', buildBitfield, SType.List],
        // ['!bf', buildBitfield, SType.Value],
        // ['!es', onEntitySet, SType.Map],
        ['!c', onComponent, SType.List],
        ['!e', onEntity, SType.List],
        ['!e', onEntity, SType.Value],
        ['assert_type', onAssertType],
        ['prints', onPrintStack],
    ]);

    return stack;
}