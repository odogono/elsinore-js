import _ from 'underscore';
import test from 'tape';
import {toPascalCase} from '../src/util/to';
import Collection from '../src/util/collection';

test('toPascalCase', t => {
    const cases = {
        'good work': 'GoodWork',
        'good-job': 'GoodJob',
        'good    skills': 'GoodSkills',
        'good': 'Good',
        'GoodJobEveryone': 'GoodJobEveryone',
        'goodJobEveryone': 'GoodJobEveryone',
        'spud42u': 'Spud42U',
        '1999partyOver': '1999PartyOver'
    };

    Object.keys(cases).forEach( input => t.equals( toPascalCase(input), cases[input] ));
    t.end();
});



test('add to a collection', t => {
    const collection = new Collection();

    collection.add( {id:5} );
    collection.add( {id:5} );

    t.equals( collection.size(), 1 );

    t.end();
})

test('remove from a collection', t => {
    const collection = new Collection();

    collection.add( {id:5} );
    collection.add( {id:7} );

    collection.remove( {id:5} );

    t.equals( collection.size(), 1 );

    collection.remove( {id:7} );

    t.equals( collection.size(), 0 );

    collection.add( {id:7} );

    t.equals( collection.size(), 1 );

    t.end();
})