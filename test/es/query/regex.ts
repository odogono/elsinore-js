import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    parse,
    prep,
    QueryStack,
    StackValue,
    sv,
} from '../helpers';

let test = suite('es/mem/query - Regex');

test('matches', async () => {
    let [stack] = await prep(`
            "foo is bar" ~r/foo/ ==
            `);

    let result = stack.popValue();
    assert.equal(result, true);
});

test('matches length >', async () => {
    let [stack] = await prep(`
            "foo" ~r/^.{3,}$/ ==
            `);

    let result = stack.popValue();
    assert.equal(result, true);
});

test('ensure leading slash', async () => {
    let [stack] = await prep(`    
        [
            dup ~r/^\\// eval
            
            [["/" *^^$0] "" join ] swap false == if

        ] ensureLeadingSlash define
        
        "hello" ensureLeadingSlash
        "/hello" ensureLeadingSlash
    `);

    assert.equal( stack.popValue(), "/hello" );
    assert.equal( stack.popValue(), "/hello" );
    
});

test('executes a regex', async () => {
    let [stack] = await prep(`
        "file:///test/fixtures/rootA/static"
        ~r/(?!.*/).+/
        eval pop!
    `);
    assert.equal( stack.popValue(), "static" );
});

test('executes a regex', async () => {
    let [stack] = await prep(`
        "file:///test/fixtures/rootA/static/index.html"
        ~r/^.*:\\/\\/([\\/\\w]+\\/)/
        eval pop!
    `);
    assert.equal( stack.popValue(), "/test/fixtures/rootA/static/" );
});

test('executes a file selection regex', async () => {
    let [stack] = await prep(`
        "file:///content/style.scss"
        ~r/[^/\\\\&\\?#]+\\.\\w{3,4}(?=([\\?&#].*$|$))/
        eval "" join
    `);
    assert.equal( stack.popValue(), "style.scss" );
});

test('trim leading char', async () => {
    let [stack] = await prep(`
        "" "/content/style.scss"
        ~r/^\\/+/
        replace
    `);
    assert.equal( stack.popValue(), "content/style.scss" );

})


test('split with regex', async () => {
    let [stack] = await prep(`
        "file:///test/fixtures/rootA/static/"
        ~r/(?!\/\/)\/(?=.*\/)/
        split
        pop
        drop
        / join / join
    `);
    assert.equal( stack.popValue(), "file:///test/fixtures/rootA/" );
});

test('create a regex', async () => {
    let [stack] = await prep(`
        "file:///layout/main.mdx"
        ["^.*://" "/layout/main" ".*"] "" join !r
        eval
        pop?
    `);

    assert.equal( stack.popValue(), "file:///layout/main.mdx" );

});


test('case insensitive regex', async () => {
    let [stack] = await prep(`
            "FOO is bar" ~r/foo/i ==
            `);

    let result = stack.popValue();
    assert.equal(result, true);
});

test.run();


// /[^/\\&\?#]+\.\w{3,4}(?=([\?&#].*$|$))/
// /[^/\\&\?#]+\.\w{3,4}(?=([\?&#].*$|$))/