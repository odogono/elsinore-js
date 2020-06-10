import { StackValue, InstResult, AsyncInstResult, SType } from "../types";
import { QueryStack } from "../stack";


export function onDefine(stack: QueryStack, [, op]: StackValue): InstResult {
    // let wordVal: StackValue, wordFn, value: StackValue;
    let wordFn;
    let wordVal = stack.pop();
    let value = stack.pop();
    let [, word] = wordVal;


    // console.log('[onDefine]', stack.id, op, word, 'values' );
    if (value[0] === SType.List && op !== 'let') {
        wordFn = async <QS extends QueryStack>(stack: QS): AsyncInstResult => {
            // console.log('[onDefine]', 'pushValues to', stack.id);
            await stack.pushValues(value[1]);
            return [];
        }
    } else {
        // Log.debug('[onDefine][let]', op, word, 'value', value );
        wordFn = value;
    }

    stack.addWords([[word, wordFn]]);

    return [];
};
