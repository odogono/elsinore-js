/* @flow */

import test from 'tape';

import {
    Component, Entity, EntitySet,
    Registry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents, loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
    getEntityIdFromId,
    getEntitySetIdFromId,
    setEntityIdFromId,
} from './common';


test('is an entity', t => {
    let e = Entity.create();
    t.equals( e.type, 'Entity' );
    t.equals( Entity.prototype.type, 'Entity' );
    t.ok( Entity.isEntity(e) );
    t.end();
});



test('setting the id', t => {
    let e = Entity.create( 456 );
    
    t.equals( e.getEntityId(), 456 );
    e.setEntityId( 22 );
    t.equals( e.getEntityId(), 22 );
    t.equals( e.id, 22 );

    e.set({id: 54});
    t.equals( e.getEntityId(), 54 );
    t.equals( e.getEntitySetId(), 0 );

    e.set({id: 0});
    e.setEntitySetId( 2000 );
    t.equals( e.getEntitySetId(), 2000 );
    t.equals( e.getEntityId(), 0 );

    e.setEntityId( 2147483647 );
    t.equals( e.getEntityId(), 2147483647 );

    e.setEntitySetId( 2097151 );
    t.equals( e.getEntitySetId(), 2097151 );
    t.equals( e.getEntityId(), 2147483647 );

    t.end();
});

test('setting ids', t => {
    let id = 0;
    t.equals( getEntityIdFromId( id ), 0 );
    t.equals( getEntitySetIdFromId( id ), 0 );

    id = setEntityIdFromId( 872510, 3467 );
    t.equals( getEntityIdFromId( id ), 872510 );
    t.equals( getEntitySetIdFromId( id ), 3467 );        

    t.end();
});

test('setting entity set', t => {
    let e = Entity.create();
    e.setEntityId( 22 );
    e.setEntitySetId( 103 );

    let es = { id:0 };
    e.setEntitySet( es );

    t.equals( e.getEntityId(), 22 );
    t.equals( e.getEntitySetId(), 0 );

    t.end();
})

test('hashing', t => {
    let e = Entity.create();
    // because an entity is the sum of its components, without components it is nothing
    t.equals( e.hash(), 0 );

    let c = Component.create({name:'douglas'});
    e.addComponent( c );

    t.equals( e.hash(true), '7c7ecfd3' );

    let oe = Entity.create();
    let oc = Component.create({name:'douglas'});
    oe.addComponent( oc );

    t.equals( e.hash(), oe.hash() );

    t.end();
});
