import { StackValue, InstResult, AsyncInstResult, SType } from "../types";
import { QueryStack } from "../stack";
import { hash } from "../../util/hash";


/**
 * define and let words
 * 
 * a define value will be evaluated when it is pushed onto the stack
 * 
 * a let value will just be pushed onto the stack
 * 
 * @param stack 
 * @param param1 
 */
export function onDefine(stack: QueryStack, [, op]: StackValue): InstResult {
    let wordFn;
    let wordVal = stack.pop();
    let value = stack.pop();
    let [, word] = wordVal;
    
    const isUDFunc = op === 'define';

    

    // if (value[0] === SType.List && op !== 'let') {
    if (value[0] === SType.List && isUDFunc ) {
        wordFn = async (stack: QueryStack): AsyncInstResult => {
            
            // console.log('[onDefine]', 'wordFn', word, value[1] );
            // let wasActive = stack.isActive;
            // const ticket = Math.random().toString(36).substring(7);
            // let count = await stack.pushValues(value[1], {ticket,ignoreActive:true});
            
            
            await stack.pushValues(value[1]);
            // const count = await stack.pushWordValues(stack,word,value[1],{ticket, isWord:true});
            
            // console.log('[onDefine]', 'end wordFn', word, {count, ticket, wasActive,isActive:stack.isActive}, stack.items );
            // if the stack is inActive coming out of a word, set a flag
            // so that the active state is restored after leaving containing word
            
            // if( stack.pendingActive ){
            //     console.log('[onDefine]', 'end wordFn', word, 'reactive after pending');
            //     stack.isActive = true;
            //     stack.pendingActive = undefined;
            // }
            // else if( wasActive && !stack.isActive ){
            //     console.log('[onDefine]', 'end wordFn', word, 'set pending');
            //     stack.pendingActive = true;
            // }

            

            return undefined;
        }
    } else {
        // let existing = stack.getWord([SType.Value,word]);
        // console.log('[onDefine]', 'existing', existing);
        
        wordFn = value;
        // if( existing !== undefined ) explain = true;
    }

    if( isUDFunc ){
        // console.log('[onDefine]', op, word, value );
        stack.addWords([[word, wordFn]]);
    } else {
        // console.log('[onDefine][UDWord]', op, word, value );
        stack.addUDWord(word, wordFn);
    }

    // if( explain ){
    //     console.log('[onDefine]', stack.words);
    // }

    return undefined;
};
