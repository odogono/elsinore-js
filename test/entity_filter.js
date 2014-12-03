var _ = require('underscore');
var test = require('tape');


var Common = require('./common');
var Sinon = require('sinon');

var Elsinore = require('../lib');

var Entity = Elsinore.Entity;
var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Registry = Elsinore.Registry;



test('creating a filter by passing multiple component ids', function(t){
    var f = EntityFilter.create( EntityFilter.INCLUDE, Components.Animal, Components.Doctor, Components.Flower );

    t.equals( f.type, EntityFilter.INCLUDE );
    t.deepEqual( f.bitField.toValues(), [Components.Animal, Components.Doctor, Components.Flower] );

    t.end();
});

test('creating multiple filters by passing an array', function(t){
    var f = EntityFilter.create( [
                [EntityFilter.NONE, Components.Mineral, Components.Animal],
                [EntityFilter.INCLUDE, Components.Animal, Components.Doctor, Components.Flower]] );

    t.equals( f[0].type, EntityFilter.NONE );
    t.deepEqual( f[0].bitField.toValues(), [Components.Animal, Components.Mineral] );

    t.equals( f[1].type, EntityFilter.INCLUDE );
    t.deepEqual( f[1].bitField.toValues(), [Components.Animal, Components.Doctor, Components.Flower] );

    t.end();
});


test('an default filter will accept an entity', function(t){
    var e = Entity.create();
    var f = EntityFilter.create();
    t.ok( f.accept(e), 'the filter accepts an entity by default' );
    t.end();
});

test('will reject entities without components', function(t){
    var e = Entity.create();
    var f = EntityFilter.create(EntityFilter.SOME);
    t.notOk( f.accept(e), 'the filter rejects the entity without components');
    t.end();
});

test('will accept entities with one of the components', function(t){
    var f = EntityFilter.create( EntityFilter.ANY, Components.Animal, Components.Doctor );

    t.ok( f.accept( createEntity( Components.Animal ) ) );
    t.notOk( f.accept( createEntity( Components.Mineral ) ) );
    t.ok( f.accept( createEntity( Components.Doctor ) ) );
    t.ok( f.accept( createEntity( Components.Robot, Components.Animal ) ) );

    t.end();
});

test('reject an entity which does not have a specific component', function(t){
    var c = createComponent( Components.Flower );
    var e = Entity.create();
    var f = EntityFilter.create(EntityFilter.ALL, Components.Flower );

    t.notOk( f.accept(e), 'filter rejects because the component is missing');
    e.addComponent(c);
    t.ok( f.accept(e), 'filter accepts because the component is present');
    t.end();
});

test('reject an entity which does not have the specific components', function(t){
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.ALL, Components.Mineral, Components.Vegetable );

    e.addComponent( createComponent( Components.Animal ) );
    e.addComponent( createComponent( Components.Mineral ) );
    t.notOk( f.accept(e) );
    e.addComponent( createComponent( Components.Vegetable ) );
    t.ok( f.accept(e, true) );

    t.end();
});

test('accepts an entity which has some of the components', function(t){
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.ANY, Components.Animal, Components.Mineral, Components.Vegetable );
    
    t.notOk( f.accept(e) );
    e.addComponent( createComponent( Components.Robot ) );
    t.notOk( f.accept(e) );
    // log.debug('--- should fail because none');
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( f.accept(e), 'has one of the optional components' );
    t.end();
});

test('rejects an entity which has any of the components', function(t){
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.NONE, Components.Vegetable );

    t.ok( f.accept(e) );
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( f.accept(e) );
    e.addComponent( createComponent( Components.Vegetable ) );
    t.notOk( f.accept(e) );

    t.end();
});


test('transform will copy an incoming entity', function(t){
    var e = createEntity( Components.Mineral, Components.Vegetable, Components.Doctor );
    e.marked = true;
    var f = EntityFilter.create();
    var te = f.transform(e);

    t.notOk( te.marked );
    t.ok( te.Mineral );
    t.ok( te.Vegetable );
    t.ok( te.Doctor );
    t.end();
});

test('transform will include only specified components on an entity', function(t){
    var e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );

    var f = EntityFilter.create( EntityFilter.INCLUDE, Components.Animal, Components.Robot, Components.Doctor );

    t.ok( e.Robot, 'entity will have Robot component' );
    t.ok( e.Mineral, 'entity will have Mineral component' );

    var te = f.transform( e );
    t.equal( e.id, te.id, 'transformed entity id will be the same' );
    t.ok( te.Robot, 'transformed entity will have Robot component' );
    t.notOk( te.Mineral, 'transformed entity will not have Mineral component' );
    
    t.end();
});

test('transform will exclude specified components on an entity', function(t){
    var e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );
    var f = EntityFilter.create( EntityFilter.EXCLUDE, Components.Vegetable );
    
    var te = f.transform( e );
    t.equal( e.id, te.id, 'transformed entity id will be the same' );
    t.ok( te.Mineral, 'transformed entity will have Mineral component' );
    t.notOk( te.Vegetable, 'transformed entity will not have Vegetable component' );

    t.end();
});








var MockComponent = function( attrs ){
    return _.extend({}, attrs,{
        setEntityId: function(eid){
            this['_e'] = eid;
        }
    });
}

var ComponentDefs = {
    '/animal': { schemaIId:1, name:'Animal', schemaHash:'001' },
    '/mineral': { schemaIId:2, name:'Mineral', schemaHash:'002' },
    '/vegetable': { schemaIId:3, name:'Vegetable', schemaHash:'003' },
    '/doctor': { schemaIId:4, name:'Doctor', schemaHash:'004' },
    '/robot': { schemaIId:5, name:'Robot', schemaHash:'005' },
    '/flower': { schemaIId:6, name:'Flower', schemaHash:'006' }
};

var Components = _.reduce( ComponentDefs, function(memo,val,key){
    memo[ val.name ] = val.schemaIId;
    return memo;
},{});

var ComponentIIdToObject = _.reduce( ComponentDefs, function(memo,val,key){
    memo[ parseInt(val.schemaIId,10) ] = val;
    return memo;
},[]);



function createEntity( componentIIds ){
    var i,len,com;
    var args = Array.prototype.slice.call( arguments );

    var entity = Entity.create();

    for(i=0,len=args.length;i<len;i++){
        com = MockComponent( ComponentIIdToObject[ args[i] ] );
        entity.addComponent( com );
    }

    return entity;
}

function createComponent( componentIId ){
    return MockComponent( ComponentIIdToObject[ componentIId ] );
}
