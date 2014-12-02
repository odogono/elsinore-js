var _ = require('underscore');
var test = require('tape');


var Common = require('./common');
var Sinon = require('sinon');

var Elsinore = require('../lib');

var Entity = Elsinore.Entity;
var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Registry = Elsinore.Registry;




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
    log.debug('--- should fail because none');
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

test('chaining', function(t){
    var e = Entity.create();

    var f = EntityFilter.create( EntityFilter.ANY, Components.Animal, Components.Mineral, Components.Vegetable );
    f.next = EntityFilter.create(EntityFilter.NONE, Components.Robot );

    e.addComponent( createComponent( Components.Animal ) );
    t.ok( f.accept(e) );
    e.addComponent( createComponent( Components.Robot ) );
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
    '/animal': { iid:1, name:'Animal', schemaHash:'001' },
    '/mineral': { iid:2, name:'Mineral', schemaHash:'002' },
    '/vegetable': { iid:3, name:'Vegetable', schemaHash:'003' },
    '/doctor': { iid:4, name:'Doctor', schemaHash:'004' },
    '/robot': { iid:5, name:'Robot', schemaHash:'005' },
    '/flower': { iid:6, name:'Flower', schemaHash:'006' }
};

var Components = _.reduce( ComponentDefs, function(memo,val,key){
    memo[ val.name ] = val.iid;
    return memo;
},{});

var ComponentIIdToObject = _.reduce( ComponentDefs, function(memo,val,key){
    memo[ parseInt(val.iid,10) ] = val;
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

/*function createComponents(returnType, options, entity){
    var result = {
        animal: mockComponent( 13, '/component/animal' ),
        mineral: mockComponent( 178, '/component/mineral' ),
        vegetable: mockComponent( 96, '/component/vegetable' ),
        robot: mockComponent( 32, '/component/robot' ),
        doctor: mockComponent( 5, '/component/doctor' ),
    };

    if( returnType == 'ids'){
        return _.compact(_.map( result, function(v,k,l){
            if( _.indexOf(options,k) != -1 )
                return v.ComponentDef.id;
            return null;
        }));
    }
    else if( returnType == 'add' ){
        entity = Entity.toEntity(entity);
        _.each( result, function(v,k){
            if( _.indexOf(options,k) != -1 ){
                entity.addComponent( v );
            }
        });
        return entity;
    }

    return result;
}//*/

// function mockComponent( schemaUri, schemaHash ){
//     var result = Component.create();
//     result.schemaUri = schemaUri;
//     result.schemaHash = schemaHash;
//     // var def = ComponentDef.create( {id:componentDefSchemaId} );
//     // def.id = componentDefId;
//     // var result = def.create();
//     // return result;
// }