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
    onComponentDef, 
    fetchComponentDef, 
    // onEntitySet, 
    onComponent, onEntity, 
    onAssertType, 
    onToString
} from "./words";
import { onPluck } from "./words/pluck";
import { onDefine } from "./words/define";
import {
    QueryStack,
} from './stack';
import { tokenizeString } from "./tokenizer";


export interface QueryOptions {
    stack?:QueryStack;
    values?:StackValue[];
}

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

export function createStdLibStack( stack?:QueryStack ){

    stack = stack ?? new QueryStack();

    stack = stack.addWords([
        ['+', onAddComponentToEntity, SType.Entity, SType.Component],
        ['+', onAddComponentToEntity, SType.Entity, SType.List],
        ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
        // pattern match stack args
        ['+', onAddArray, SType.List, SType.Any],
        // important that this is after more specific case
        ['+', onAdd, SType.Value, SType.Value],
        ['*', onAdd, SType.Value, SType.Value],
        ['%', onAdd, SType.Value, SType.Value],
        ['==', onAdd, SType.Value, SType.Value],
        ['!=', onAdd, SType.Value, SType.Value],
        ['.', onPrint, SType.Any],
        ['..', onPrint],
        ['@', onFetchArray, SType.List, SType.Value],

        ['[', onListOpen],
        ['{', onMapOpen],
        ['}', onUnexpectedError],
        [']', onUnexpectedError],
        ['to_map', onBuildMap],
        ['to_str', onToString],
        ['drop', onDrop, SType.Any],
        ['swap', onSwap, SType.Any, SType.Any],
        ['push', onPush, SType.List, SType.Any],
        ['pop', onPop, SType.List],
        ['map', onMap, SType.List, SType.List],
        ['pluck', onPluck, SType.Map, SType.Value],
        ['pluck', onPluck, SType.List, SType.Value],
        ['pluck', onPluck, SType.List, SType.List],
        ['unique', onUnique, SType.List],
        ['filter', onFilter, SType.List, SType.List],
        ['reduce', onReduce, SType.List, SType.Value, SType.List],
        ['define', onDefine, SType.Any, SType.Value],
        ['let', onDefine, SType.Any, SType.Value],
        ['concat', onConcat],
        ['cls', onClear],
        ['dup', onDup, SType.Any],
        ['over', onDup, SType.Any],
        ['select', onSelect, SType.EntitySet, SType.List],
        ['spread', onListSpread, SType.List],
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
    ]);

    return stack;
}