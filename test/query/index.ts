import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';
import * as Tokenizer from '../../src/query/tokenizer';
import { create as createQuery, pushValues } from '../../src/query/stack';

const Log = createLog('TestQuery');


describe('Query', () => {
    it('parses', async () => {

        const data = [
            1, 'version', '==', 'assert'
        ];

        let stack = createQuery();

        [stack] = pushValues( stack, data );

        Log.debug('stack', stack);


    });
})