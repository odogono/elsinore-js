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
    
    const isDefine = op === 'define';

    if (value[0] === SType.List && isDefine ) {
        wordFn = [SType.Word,value[1]];
    } else {
        wordFn = value;
    }

    if( isDefine ){
        stack.addWords([ [word, wordFn] ]);
    } else {
        stack.addUDWord(word, wordFn);
    }

    return undefined;
};
