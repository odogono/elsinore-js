import _ from 'underscore';
import test from 'tape';
// import Url from 'omnibox';

import {
    toPascalCase,
    parseUri,
} from './common';



test('toPascalCase', function(t){
    var cases = {
        'good work': 'GoodWork',
        'good-job': 'GoodJob',
        'good    skills': 'GoodSkills',
        'good': 'Good',
        'GoodJobEveryone': 'GoodJobEveryone',
        'goodJobEveryone': 'GoodJobEveryone'
    };

    _.each( cases, (expected,input) => t.equals( toPascalCase(input), expected ));
    t.end();
});


// test('parse uri', t => {
//     const record = parseUri('/foo/bar?baz=quux#frag');

//     t.deepEqual( record.query, { 'baz': 'quux'} );
//     t.equals( record.baseUri, '/foo/bar?baz=quux' );
//     t.equals( record.fragment, 'frag' );
    
//     t.end();
// });