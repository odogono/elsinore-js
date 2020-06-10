import { StackValue, InstResult, AsyncInstResult, SType } from "../types";
import { addWords, QueryStack } from "../stack";


export function onDefine<QS extends QueryStack>(stack: QS, [, op]: StackValue): InstResult<QS> {
    // let wordVal: StackValue, wordFn, value: StackValue;
    let wordFn;
    let wordVal = stack.pop();
    let value = stack.pop();
    let [, word] = wordVal;


    if (value[0] === SType.List && op !== 'let') {
        // Log.debug('[onDefine]', op, word, 'values', value );
        wordFn = async <QS extends QueryStack>(stack: QS): AsyncInstResult<QS> => {
            await stack.pushValues(value[1]);
            return [stack];
        }
    } else {
        // Log.debug('[onDefine][let]', op, word, 'value', value );
        wordFn = value;
    }

    stack = addWords<QS>(stack, [[word, wordFn]]);

    return [stack];
};
