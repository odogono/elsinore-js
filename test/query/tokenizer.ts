import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';
import * as Tokenizer from '../../src/query/tokenizer';

const Log = createLog('TestQueryTokenizer');

describe('Tokenizer', () => {

    it('parses', async () => {
        let data, out;
        // out = tokenize(`[ "/component/title", "text" ] 29 :nope !d +\n`);
        out = tokenize(undefined, `[ "/component/title", "te`);
        out = tokenize(out, `xt" ] 29 :nope !d +\n`);
        
        Log.debug( out.output );

        out = tokenizeString(`{ "debug": true } \n`);
        Log.debug( out );

        data = `1 version == assert

        // create a new EntitySet
        { debug: true, ace:99 } !es
        `

        out = tokenizeString(data);
        Log.debug( out );

    //     // Log.debug( Tokenizer );

        data = `
    {
        # TL;DR
        human:   Hjson
        machine: JSON
    }`;
        out = tokenizeString(data);
        Log.debug( out );

        data = `{
            md:
                '''
                First line.
                Second line.
                  This line is indented by two spaces.
                '''
            }`
        out = tokenizeString(data);
        Log.debug( out );

        data = `
        {
            "key name": "{ sample }"
            "{}": " spaces at the start/end "
            this: "is OK though: {}[],:"
        }`;
        out = tokenizeString(data);
        Log.debug( out );
    });

    it.only('parses arrays', () => {
        // let data = '[29]';
        // let out = tokenizeString(data);
        

        // assert.deepEqual(out, [
        //     [ '[', 0, 0 ],
        //     [ 29, 1, 0 ],
        //     [ ']', 3, 0 ],
        // ]);

        let cases = [
            ['[29]', 
            [
                [ '[', 0, 0 ],
                [ 29, 1, 0 ],
                [ ']', 3, 0 ],
            ]],
            ['[29] 30',
            [
                [ '[', 0, 0 ],
                [ 29, 1, 0 ],
                [ ']', 3, 0 ],
                [ 30, 5, 0 ],
            ]],
            ['[29,+] 30',
            [
                [ '[', 0, 0 ],
                [ 29, 1, 0 ],
                [ '+', 4, 0],
                [ ']', 5, 0 ],
                [ 30, 7, 0 ],
            ]],
            [ `"get out of bed"`,
            [
                [ 'get out of bed', 0, 0]
            ]],
            [ `{"name":"Completed","uri":"/component/completed","properties":[{"name":"isComplete","type":"boolean"}]} !d`,
            [
                [ "{",0,0 ],
                ["name",1,0],
                ["Completed",8,0],
                ["uri",20,0],
                [ "/component/completed",26,0],
                ["properties",49,0],
                [ "[",62,0],
                [ "{",63,0],
                ["name",64,0],
                ["isComplete",71,0],
                ["type",84,0],
                ["boolean",91,0],
                [ "}",100,0],
                [ "]",101,0],
                [ "}",102,0],
                [ "!d",104,0],
            ]]
        ];

        cases.forEach( ([input,expected]) => {
            let output = tokenizeString(input as string);
            // Log.debug(output);
            assert.deepEqual( output, expected as [] );
        });

    });


});