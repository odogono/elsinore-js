import test from 'tape';

import { parse as parseEJSON, through as throughEJSON } from '../src/util/ejson';

import Pull from 'pull-stream';
import Pushable from 'pull-pushable';
import PullMap from 'pull-stream/throughs/map';
import PullFilter from 'pull-stream/throughs/filter';


import {
    createLog,
    initialiseRegistry,
    loadEntities,
    stringify,
} from './common';

const Log = createLog('TestEJSON');


test('parses basic', async t => {
    try{
        
        t.deepEquals( parseEJSON('{}'), {} );

        t.deepEquals( parseEJSON(`{
            # example key/value
            "msg": "hello"
        }`), [{msg:'hello'}] );

        t.end();

    }catch( err ){
        Log.error( err.stack );
    }
});



test('parses stream', async t => {
    try {

        Pull(
            Pull.values([
                '{ "@cm',
                'd": "regist',
                'er", "uri": "/component',
                '/piece/king"'
            ]),
            throughEJSON(),
            Pull.collect((err, result) => {

                Log.info('result', result);
                t.end();
            })
        );

    }
    catch( err ){
        Log.error( err.stack );
    }
})