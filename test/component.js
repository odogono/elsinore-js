import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Component, Entity,
    Registry,
    initialiseRegistry, 
    printE,
    printIns,
} from './common';



test('is a component', t => {
    let c = Component.create();
    t.equals( c.type, 'Component' );
    t.equals( Component.prototype.type, 'Component' );
    t.ok( Component.isComponent(c) );
    t.end();
});


test('hash depends on attributes', t => {
    let c = Component.create({name:'douglas'});
    let co = Component.create({name:'ben'});
    let ca = Component.create({name:'douglas'});

    t.notEqual( c.hash(), co.hash() );
    t.equal( c.hash(), ca.hash() );

    t.end();
});