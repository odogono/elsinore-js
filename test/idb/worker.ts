if( process.env.JS_ENV !== 'browser' ){
    require('fake-indexeddb/auto');
}
import Worker from 'web-worker';
import { assert } from 'chai';
import { createLog } from '../../src/util/log';


describe('IDB Web Worker', () => {

    it('does stuff', async () => {
        const worker = new Worker('data:,postMessage("hello")');
        worker.onmessage = e => console.log(e.data);  // "hello"
    })

});