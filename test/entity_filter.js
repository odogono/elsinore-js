var test = require('tape');
var Common = require('./common');

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
    var f = EntityFilter.create( EntityFilter.ANY, 
        createComponents('ids', ['animal', 'doctor']) );

    t.ok( f.accept(createComponents('add', ['animal'] )) );
    t.notOk( f.accept(createComponents('add', ['mineral'] )) );
    t.ok( f.accept(createComponents('add', ['doctor'] )) );
    t.ok( f.accept(createComponents('add', ['robot', 'animal'] )) );

    t.end();
});

test('reject an entity which does not have a specific component', function(t){
    var c = mockComponent( 2, '/component/flower' );
    var e = Entity.create();
    var f = EntityFilter.create(EntityFilter.ALL, [2] );
    t.notOk( f.accept(e), 'filter rejects because the component is missing');
    e.addComponent(c);
    t.ok( f.accept(e), 'filter accepts because the component is present');
    t.end();
});

test('reject an entity which does not have the specific components', function(t){
    var coms = createComponents();
    var e = Entity.create();
    var f = EntityFilter.create( EntityFilter.ALL, [178, 96] );

    e.addComponent( coms.animal );
    e.addComponent( coms.mineral );
    t.notOk( f.accept(e) );
    e.addComponent( coms.vegetable );
    t.ok( f.accept(e, true) );

    t.end();
});

test('accepts an entity which has some of the components', function(t){
    var e = Entity.create();
    var coms = createComponents();
    var f = EntityFilter.create( EntityFilter.ANY, [13, 178, 96] );
    
    t.notOk( f.accept(e) );
    e.addComponent( coms.robot );
    t.notOk( f.accept(e) );
    log.debug('--- should fail because none');
    e.addComponent( coms.animal );
    t.ok( f.accept(e), 'has one of the optional components' );
    t.end();
});

test('rejects an entity which has any of the components', function(t){
    var e = Entity.create();
    var coms = createComponents();
    var f = EntityFilter.create( EntityFilter.NONE, [96] );

    t.ok( f.accept(e) );
    e.addComponent( coms.animal );
    t.ok( f.accept(e) );
    e.addComponent( coms.vegetable );
    t.notOk( f.accept(e) );

    t.end();
});

test('chaining', function(t){
    var e = Entity.create();
    var coms = createComponents();

    var f = EntityFilter.create( EntityFilter.ANY, 
        createComponents('ids',['animal','mineral','vegetable']) );
    f.next = EntityFilter.create(EntityFilter.NONE, [32] );

    e.addComponent( coms.animal );
    t.ok( f.accept(e) );
    e.addComponent( coms.robot );
    t.notOk( f.accept(e) );
    
    t.end();
});

test('transform will copy an incoming entity', function(t){
    var e = createComponents('add', ['mineral', 'vegetable', 'doctor'], 22 );
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
    var e = createComponents('add', ['mineral', 'robot', 'vegetable'], 23 );
    var f = EntityFilter.create( EntityFilter.INCLUDE, 
        createComponents('ids',['animal','robot','doctor']) );

    t.ok( e.Robot, 'entity will have Robot component' );
    t.ok( e.Mineral, 'entity will have Mineral component' );

    var te = f.transform( e );
    t.equal( e.id, te.id, 'transformed entity id will be the same' );
    t.ok( te.Robot, 'transformed entity will have Robot component' );
    t.notOk( te.Mineral, 'transformed entity will not have Mineral component' );
    
    t.end();
});

test('transform will exclude specified components on an entity', function(t){
    var e = createComponents('add', ['mineral', 'robot', 'vegetable'], 24 );
    var f = EntityFilter.create( EntityFilter.EXCLUDE, 
        createComponents('ids',['vegetable']) );
    

    var te = f.transform( e );
    t.equal( e.id, te.id, 'transformed entity id will be the same' );
    t.ok( te.Mineral, 'transformed entity will have Mineral component' );
    t.notOk( te.Vegetable, 'transformed entity will not have Vegetable component' );

    t.end();
});


function createComponents(returnType, options, entity){
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
}

function mockComponent( schemaUri, schemaHash ){
    var result = Component.create();
    result.schemaUri = schemaUri;
    result.schemaHash = schemaHash;
    // var def = ComponentDef.create( {id:componentDefSchemaId} );
    // def.id = componentDefId;
    // var result = def.create();
    // return result;
}