import test from 'tape';
import Path from 'path';

import Pull from 'pull-stream';
import PullUtf8 from 'pull-utf8-decoder';
import Pushable from 'pull-pushable';
import PullMap from 'pull-stream/throughs/map';
import PullFilter from 'pull-stream/throughs/filter';
import PullTo from 'stream-to-pull-stream';
import Stringify from 'pull-stringify';
import File from 'pull-file';
import parseEJSON from 'odgn-json';

import { createLog } from './common';
import { Registry } from '../src/registry';

const Log = createLog('TestPullStream');

test.skip('source close after existing', async t => {
    try {
        const registry = Registry.create();
        const entitySet = registry.createEntitySet();
        const filePath = Path.join(
            Path.dirname(__filename),
            './fixtures/chessboard.ldjson'
        );

        // stream items from the ldjson file
        Pull(
            File(filePath),
            PullUtf8(),
            parseEJSON(),
            // Stringify.lines(),
            // PullTo.sink(process.stdout, err => {
            //     if(err) throw err;
            //     t.end();
            // })
            entitySet.sink({ debug: false }, err => {
                if (err) throw err;
                // Log.debug('[sink]', entityToString(receivingES));
                t.equals(receivingES.size(), 3);
                t.end();
            })
        );
    } catch (err) {
        Log.error(err.stack);
    }
});


test('uri parse', async t => {
    try {
        Log.debug( parseUrl("/component/poi#woe-id") );
        
        Log.debug( parseUrl("elsinore://component/poi?woe-id=44418") )

        t.end();

    } catch(err){
        Log.error( err.stack );
    }
})

function parseURI(uri) {
    
    let match = uri.match(
        /^(.*?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/
    );
    return (
        match && {
            uri,
            protocol: match[1],
            host: match[2],
            hostname: match[3],
            port: match[4],
            pathname: match[5],
            search: match[6],
            hash: match[7]
        }
    );
}

function parseUrl(url) {
    var m = url.match(/^(([^:\/?#]+:)?(?:\/\/(([^\/?#:]*)(?::([^\/?#:]*))?)))?([^?#]*)(\?[^#]*)?(#.*)?$/),
        r = {
            hash: m[8] || "",                    // #asd
            host: m[3] || "",                    // localhost:257
            hostname: m[4] || "",                // localhost
            href: m[0] || "",                    // http://localhost:257/deploy/?asd=asd#asd
            origin: m[1] || "",                  // http://localhost:257
            pathname: m[6] || (m[1] ? "/" : ""), // /deploy/
            port: m[5] || "",                    // 257
            protocol: m[2] || "",                // http:
            search: m[7] || ""                   // ?asd=asd
        };
    if (r.protocol.length == 2) {
        r.protocol = "file:///" + r.protocol.toUpperCase();
        r.origin = r.protocol + "//" + r.host;
    }
    r.href = r.origin + r.pathname + r.search + r.hash;
    return m && r;
};