import { suite } from 'uvu';
import assert from 'uvu/assert';
import { isInteger } from '../../src/util/is';


let test = suite('util/is');


test('isInteger', () => {
    assert.ok( isInteger(1) );
    assert.ok( isInteger("2") );
    assert.ok( isInteger("two") === false );
    assert.ok( isInteger( [100] ) === false );
});


test.run();