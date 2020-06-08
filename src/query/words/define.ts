import { StackValue, InstResult, QueryStack, AsyncInstResult, SType } from "../types";
import { pushValues, pop, addWords } from "../stack";


export function onDefine<QS extends QueryStack>(stack: QS, [, op]: StackValue): InstResult<QS> {
    let wordVal: StackValue, wordFn, value: StackValue;
    [stack, wordVal] = pop(stack);
    [stack, value] = pop(stack);
    let [, word] = wordVal;


    if (value[0] === SType.List && op !== 'let') {
        // Log.debug('[onDefine]', op, word, 'values', value );
        wordFn = async <QS extends QueryStack>(stack: QS): AsyncInstResult<QS> => {
            [stack] = await pushValues(stack, value[1]);
            return [stack];
        }
    } else {
        // Log.debug('[onDefine][let]', op, word, 'value', value );
        wordFn = value;
    }

    stack = addWords<QS>(stack, [[word, wordFn]]);

    return [stack];
};
