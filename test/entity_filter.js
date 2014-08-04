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

    var f = EntityFilter.create( EntityFilter.ANY, [13, 178, 96] );
    f.add( EntityFilter.create(EntityFilter.NONE, [32] ));

    e.addComponent( coms.animal );
    t.ok( f.accept(e) );
    e.addComponent( coms.robot );
    t.notOk( f.accept(e) );
    
    t.end();
});


function createComponents(){
    return {
        animal: mockComponent( 13, '/component/animal' ),
        mineral: mockComponent( 178, '/component/mineral' ),
        vegetable: mockComponent( 96, '/component/vegetable' ),
        robot: mockComponent( 32, '/component/robot' )
    };
}

function mockComponent( componentDefId, componentDefSchemaId ){
    var def = ComponentDef.create( {id:componentDefSchemaId} );
    def.id = componentDefId;
    var result = def.create();
    return result;
}