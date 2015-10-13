import _ from 'underscore';
import test from 'tape';

import {
    Elsinore,
    Utils,
} from './common';
// var Common = require('./common');
// var Elsinore = Common.Elsinore;
// var Utils = Elsinore.Utils;



test('toPascalCase', function(t){
    var cases = {
        'good work': 'GoodWork',
        'good-job': 'GoodJob',
        'good    skills': 'GoodSkills',
        'good': 'Good',
        'GoodJobEveryone': 'GoodJobEveryone',
        'goodJobEveryone': 'GoodJobEveryone'
    };

    _.each( cases, (expected,input) => t.equals( Utils.toPascalCase(input), expected ));
    t.end();
});


test('parse uri', t => {
    const record = Utils.parseUri('/foo/bar?baz=quux#frag');

    t.deepEqual( record.query, { 'baz': 'quux'} );
    t.equals( record.baseUri, '/foo/bar?baz=quux' );
    t.equals( record.fragment, 'frag' );
    
    t.end();
})