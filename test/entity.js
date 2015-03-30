var _ = require('underscore');
var Sinon = require('sinon');
var test = require('tape');


var Common = require('./common');


var Elsinore = require('../lib');
var Entity = Elsinore.Entity;
var Component = Elsinore.Component;


test('is an entity', function(t){
    var e = Entity.create();
    t.equals( e.type, 'Entity' );
    t.equals( Entity.prototype.type, 'Entity' );
    t.ok( Entity.isEntity(e) );
    t.end();
});


test('setting the id', function(t){
    var e = Entity.create();
    // e.setEntitySetId( 2000 );
    e.setEntityId( 456 );
    t.equals( e.getEntityId(), 456 );
    e.setEntityId( 22 );
    t.equals( e.getEntityId(), 22 );
    t.equals( e.id, 22 );

    e.setEntitySetId( 2000 );
    t.equals( e.getEntitySetId(), 2000 );
    t.equals( e.getEntityId(), 22 );
    
    t.end();
});

test('hashing', function(t){
    var e = Entity.create();
    // because an entity is the sum of its components, without components it is nothing
    t.equals( e.hash(), 0 );

    var c = Component.create({name:'douglas'});
    e.addComponent( c );

    t.equals( e.hash(true), '7c7ecfd3' );

    var oe = Entity.create();
    var oc = Component.create({name:'douglas'});
    oe.addComponent( oc );

    t.equals( e.hash(), oe.hash() );

    t.end();
});