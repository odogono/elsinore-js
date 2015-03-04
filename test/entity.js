var _ = require('underscore');
var Sinon = require('sinon');
var test = require('tape');


var Common = require('./common');


var Elsinore = require('../lib');
var Entity = Elsinore.Entity;


test('is an entity', function(t){
    var e = Entity.create();
    t.equals( e.type, 'Entity' );
    t.equals( Entity.prototype.type, 'Entity' );
    // printIns( Entity.prototype );
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