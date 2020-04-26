import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';
import * as Tokenizer from '../../src/query/tokenizer';

const Log = createLog('TestQueryTokenizer');

describe('Tokenizer', () => {

    it('parses', async () => {
        let data, out;
        // out = tokenize(`[ "/component/title", "text" ] 29 :nope !d +\n`);
        out = tokenizeString(undefined, `[ "/component/title", "te`);
        out = tokenizeString(out, `xt" ] 29 :nope !d +\n`);
        
        Log.debug( out.output );

        out = tokenize(`{ "debug": true } \n`);
        Log.debug( out.output );

        data = `1 version == assert

        // create a new EntitySet
        { debug: true, ace:99 } !es
        `

        out = tokenize(data);
        Log.debug( out.output );

    //     // Log.debug( Tokenizer );

        data = `
    {
        # TL;DR
        human:   Hjson
        machine: JSON
    }`;
        out = tokenize(data);
        Log.debug( out.output );

        data = `{
            md:
                '''
                First line.
                Second line.
                  This line is indented by two spaces.
                '''
            }`
        out = tokenize(data);
        Log.debug( out.output );

        data = `
        {
            "key name": "{ sample }"
            "{}": " spaces at the start/end "
            this: "is OK though: {}[],:"
        }`;
        out = tokenize(data);
        Log.debug( out.output );
        

    });


});