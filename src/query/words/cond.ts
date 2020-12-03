import { QueryStack } from "../stack";
import { StackValue, InstResult, AsyncInstResult, SType } from "../types";





/**
 * <else> <then> <condition> iif
 *
 */
export async function onCondition(stack: QueryStack, [, op]: StackValue): AsyncInstResult {
    const isIfElse = op !== 'if';
    const condVal = stack.pop();
    const ifVal = stack.pop();
    const elseVal = isIfElse ? stack.pop() : undefined;
    const condition = condVal[1];

    // console.log('[onCondition]', condVal, ifVal, elseVal );
    
    // if( condition ){
    //     console.log('[onCondition]', 'result', ifVal );
    // } else {
    //     console.log('[onCondition]', 'result', elseVal );
    // }

    if( isIfElse ){
        // await stack.push( condition ? ifVal : elseVal );
        await pushValue( stack, condition ? ifVal : elseVal );
    } else if( condition ) {
        // console.log('[onCondition]', ifVal );
        // console.log('[onCondition]', op, stack.toString() );
        // await stack.push( ifVal );
        await pushValue( stack, ifVal );
        // console.log('[onCondition]', 'post', op, stack.toString() );
    }
    
    return undefined;
}

async function pushValue( stack:QueryStack, value:StackValue ){
    if( value[0] === SType.List ){
        // console.log('[onCondition]', op, value[1]);
        
        await stack.pushValues(value[1]);
        // await stack.pushWordValues(stack,op,value[1], {ignoreActive:true});

        // await stack.pushValues( value[1], {ticket,ignoreActive:true} );
        // console.log('[onCondition]', op, 'end', {isActive:stack.isActive} );
    } else {
        return stack.push(value);
    }
}