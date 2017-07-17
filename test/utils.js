import _ from 'underscore';
import test from 'tape';
import {toPascalCase} from '../src/util/to';


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