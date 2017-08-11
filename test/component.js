import test from 'tape';

import Component from '../src/component';


test('is a component', t => {
    let c = new Component();
    t.equals( c.type, 'Component' );
    t.equals( Component.prototype.type, 'Component' );
    t.ok( Component.isComponent(c) );
    t.end();
});


test('hash depends on attributes', t => {
    let c = new Component({name:'douglas'});
    let co = new Component({name:'ben'});
    let ca = new Component({name:'douglas'});

    t.notEqual( c.hash(), co.hash() );
    t.equal( c.hash(), ca.hash() );

    t.end();
});

test('apply copies non-identifying attributes', t => {
    const src = new Component({name:'charles', age:15, height:186, 'id':421, '@e':1000});
    const dst = new Component({name:'peter', age:32, '@i':422, 'id':1001, '@e':null});

    src.apply(dst);

    t.deepEqual( src.toJSON(), {'@e': 1000, '@i': 421, age: 32, height: 186, name: 'peter'} );

    t.end();
});

test('clone', t => {
    const src = new Component({name:'charles', age:15, height:186, 'id':421, '@e':1000});
    const dst = src.clone();

    t.deepEqual( src.toJSON(), dst.toJSON() );

    t.end();
})