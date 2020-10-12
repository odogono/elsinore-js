import { StackValue, InstResult, AsyncInstResult, SType } from "../types";
import { QueryStack } from "../stack";


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
            await stack.pushValues(value[1]);
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
