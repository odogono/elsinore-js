'use strict';

var _ = require('underscore');
var Sinon = require('sinon');


module.exports = function( test, Common, Elsinore, EntitySet ){

    var Component = Elsinore.Component;
    var Entity = Elsinore.Entity;
    var EntityFilter = Elsinore.EntityFilter;
    var Registry = Elsinore.Registry;

test.skip('quick test', t => {

    var mixin = {
        hello: function(){
            log.debug('hello there');
        }
    };

    var base = function(){};

    var prot = _.extend( base.prototype, {soup:'tasty', colour:'beige'}, mixin );
    var instance = Object.create( prot ); //, { colour:function(){ return 'white' } } );

    instance.hello();

    log.debug('good ' + instance.soup + ' ' + instance.colour );

    t.end();
});


test('creating a filter by passing multiple component ids', t => {
    let f = EntityFilter.create( EntityFilter.INCLUDE, [Components.Animal, Components.Doctor, Components.Flower] );
    t.deepEqual( f.toArray(), [EntityFilter.INCLUDE, [Components.Animal, Components.Doctor, Components.Flower]] );
    t.end();
});



test('creating an array filter by passing an array', t => {
    let f = EntityFilter.create( EntityFilter.NONE, [Components.Mineral, Components.Animal] );
    f.add( EntityFilter.INCLUDE, [Components.Animal, Components.Doctor, Components.Flower] );

    t.equals( f.size(), 2 );
    // t.equals( f.entityFilterType, EntityFilter.ARRAY );
    
    t.deepEqual( f.toArray(),[
        [EntityFilter.NONE, [Components.Animal, Components.Mineral]],
        [EntityFilter.INCLUDE, [Components.Animal, Components.Doctor, Components.Flower]]
        ]);

    t.end();
});

test('filters will have identical hashes', t => {
    var hashFn = EntityFilter.hash;
    t.equals(
        hashFn( EntityFilter.create( EntityFilter.INCLUDE, Components.Animal ) ),
        hashFn( EntityFilter.create( EntityFilter.INCLUDE, Components.Animal ) )
        );
    t.notEqual(
        hashFn( EntityFilter.create( EntityFilter.INCLUDE, Components.Animal ) ),
        hashFn( EntityFilter.create( EntityFilter.EXCLUDE, Components.Animal ) )
        );



    t.end();
});


test('an default filter will accept an entity', t => {
    var e = Entity.create();
    var f = EntityFilter.create();
    t.ok( f.accept(e), 'the filter accepts an entity by default' );
    t.end();
});

test('will reject entities without components', t => {
    var e = Entity.create();
    var f = EntityFilter.create(EntityFilter.SOME);
    t.notOk( f.accept(e), 'the filter rejects the entity without components');
    t.end();
});

test('will accept entities with one of the components', t => {
    var f = EntityFilter.create( EntityFilter.ANY, [Components.Animal, Components.Doctor] );

    t.ok( f.accept( createEntity( Components.Animal ) ) );
    t.notOk( f.accept( createEntity( Components.Mineral ) ) );
    t.ok( f.accept( createEntity( Components.Doctor ) ) );
    t.ok( f.accept( createEntity( Components.Robot, Components.Animal ) ) );

    t.end();
});

test('reject an entity which does not have a specific component', t => {
    var e = Entity.create();
    var f = EntityFilter.create(EntityFilter.ALL, Components.Flower );

    t.notOk( f.accept(e), 'filter rejects because the component is missing');
    e.addComponent( createComponent( Components.Flower ) );
    e.addComponent( createComponent( Components.Robot ) );
    t.ok( f.accept(e), 'filter accepts because the component is present');
    t.end();
});

test('reject an entity which does not have the specific components', t => {
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.ALL, [Components.Mineral, Components.Vegetable] );

    e.addComponent( createComponent( Components.Animal ) );
    e.addComponent( createComponent( Components.Mineral ) );
    t.notOk( f.accept(e) );
    e.addComponent( createComponent( Components.Vegetable ) );
    t.ok( f.accept(e, true) );

    t.end();
});

test('accepts an entity which has some of the components', t => {
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.ANY, [Components.Animal, Components.Mineral, Components.Vegetable] );
    
    t.notOk( f.accept(e) );
    e.addComponent( createComponent( Components.Robot ) );
    t.notOk( f.accept(e) );
    // log.debug('--- should fail because none');
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( f.accept(e), 'has one of the optional components' );
    t.end();
});

test('rejects an entity which has any of the components', t => {
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.NONE, Components.Vegetable );

    t.ok( f.accept(e) );
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( f.accept(e) );
    e.addComponent( createComponent( Components.Vegetable ) );
    t.notOk( f.accept(e) );

    t.end();
});

test('rejects an entity which has any of the components with multiple filters', t => {
    var f = EntityFilter.create(
        [[EntityFilter.NONE, Components.Vegetable],
        [EntityFilter.ALL, Components.Animal]] );

    var e = Entity.create();
    t.notOk( f.accept(e) );
    
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( f.accept(e) );

    e.addComponent( createComponent( Components.Vegetable ) );
    t.notOk( f.accept(e) );

    t.end();
});



test('transform will copy an incoming entity', t => {
    let te, f = EntityFilter.create();
    let e = createEntity( Components.Mineral, Components.Vegetable, Components.Doctor );
    
    e.marked = true;
    te = f.transform(e);

    t.notOk( te.marked );
    t.ok( te.Mineral );
    t.ok( te.Vegetable );
    t.ok( te.Doctor );
    t.end();
});

test('transform will include only specified components on an entity', t => {
    var e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );

    var f = EntityFilter.create( EntityFilter.INCLUDE, [Components.Animal, Components.Robot, Components.Doctor] );

    t.ok( e.Robot, 'entity will have Robot component' );
    t.ok( e.Mineral, 'entity will have Mineral component' );

    var te = f.transform( e );
    t.equal( e.id, te.id, 'transformed entity id will be the same' );
    t.ok( te.Robot, 'transformed entity will have Robot component' );
    t.notOk( te.Mineral, 'transformed entity will not have Mineral component' );
    
    t.end();
});

test('transform will exclude specified components on an entity', t => {
    var e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );
    var f = EntityFilter.create( EntityFilter.EXCLUDE, Components.Vegetable );

    var te = f.transform( e );
    t.equal( e.id, te.id, 'transformed entity id will be the same' );
    t.ok( te.Mineral, 'transformed entity will have Mineral component' );
    t.notOk( te.Vegetable, 'transformed entity will not have Vegetable component' );

    t.end();
});


test('transform all on a single component', t => {
    var e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );
    var f = EntityFilter.create( EntityFilter.ALL, Components.Vegetable );

    var te = f.transform( e );
    t.ok( te.Mineral, 'transformed entity will have Mineral component' );
    t.ok( te.Robot, 'transformed entity will have Robot component' );
    t.ok( te.Vegetable, 'transformed entity will not have Vegetable component' );

    t.end();
});

test('creating a filter with a custom accept function', t => {

    var f = EntityFilter.create( function accept(entity,options){
        if( entity.Robot && entity.Robot.get('age') > 40  ){
            return true;
        }
        return false;
    });


    t.notOk( f.accept( createEntity( {_c:Components.Robot, age:32} )));
    t.ok( f.accept( createEntity( {_c:Components.Robot, age:41} )));
    t.notOk( f.accept( createEntity( Components.Animal ) ));

    t.end();
});

test.skip('creating a filter with a standard and a custom function', t => {
    
    var f = EntityFilter.create( 
        EntityFilter.ALL, Components.Robot,
        function accept(entity,options){
            if( entity.Robot.get('age') > 40  ){
                return true;
            }
            return false;
        });


    t.ok( f.accept( createEntity( {_c:Components.Robot, age:41} )), 'accepting a robot aged 41');
    t.notOk( f.accept( createEntity( {_c:Components.Robot, age:32} )), 'not accepting a robot aged 32');
    t.notOk( f.accept( createEntity( {_c:Components.Animal, age:51} )), 'not accepting an animal age 51');

    t.end();
});

test('adding a user function to the filter', t => {
    let f = EntityFilter.create();
    f.add( EntityFilter.ALL, Components.Robot );
    f.add( entity => entity.Robot.get('age') > 500 );

    t.ok( f.accept( createEntity( {_c:Components.Robot, age:600} )), 'accepting a robot aged 600');
    t.notOk( f.accept( createEntity( {_c:Components.Robot, age:32} )), 'not accepting a robot aged 32');
    t.notOk( f.accept( createEntity( {_c:Components.Animal, age:51} )), 'not accepting an animal age 51');

    t.end();
});

test('attribute filter filters attributes', t => {
    var f = EntityFilter.create( EntityFilter.ATTRIBUTES, Components.Robot, {colour:'blue'} );

    t.ok(
        f.accept( createEntity( {_c:Components.Robot, colour:'blue'})),
        'accepting a blue robot' );
    t.notOk(
        f.accept( createEntity( {_c:Components.Robot, colour:'white'})),
        'not accepting a white robot' );
    t.end();
});

test('iterator iterates allowable entities from a source', t => {
    var entity;
    var it;
    var count;
    var f = EntityFilter.create( EntityFilter.ANY, [Components.Animal, Components.Mineral, Components.Vegetable] );
    var entitySet = createEntitySet();
    // Common.logEvents( es );

    entitySet.addEntity( createEntity( Components.Animal ) );
    entitySet.addEntity( createEntity( Components.Flower ) );
    entitySet.addEntity( createEntity( Components.Mineral ) );
    entitySet.addEntity( createEntity( Components.Vegetable ) );
    entitySet.addEntity( createEntity( Components.Robot ) );

    // use the entitySet as the source of entities
    it = f.iterator( entitySet );
    count = 0;

    while( (entity = it.next().value) ){
        count++;
    }

    t.equal( count, 3, 'three entities should have been returned' );

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
    entity.setEntityId( _.uniqueId() );
    
    for(i=0,len=args.length;i<len;i++){
        com = createComponent( args[i] );
        entity.addComponent( com );
    }

    return entity;
}

function createComponent( componentIId ){
    var attrs;
    var result;
    var data;
    if( _.isObject(componentIId) ){
        attrs = _.omit( componentIId, '_c' );
        componentIId = componentIId._c;
    }
    result = Component.create(_.extend( attrs, {id: _.uniqueId() }) );
    data = ComponentIIdToObject[ componentIId ];
    _.each( data, function(val,key){
        result[ key ] = val;
    });
    return result;
}

function createEntitySet(){
    var result = EntitySet.create();
    result._createComponentId = function(){
        return _.uniqueId();
    };
    return result;
}




}

// serverside only execution of tests
if( !process.browser ){
    var Elsinore = require('../lib');
    module.exports( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}