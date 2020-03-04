const test = require('ava');
import { ChangeSet } from '../src/entity_set/change_set';


const fn = () => 'foo';

test('fn() returns foo', t => {
	t.is(fn(), 'foo');
});