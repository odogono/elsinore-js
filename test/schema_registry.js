
var _ = require('underscore');
var test = require('tape');


var Elsinore = require('../lib');
var SchemaRegistry = Elsinore.SchemaRegistry;

var Common = require('./common');


test.skip('uri normalization', function(t){
    t.equal( Elsinore.Utils.normalizeUri( "HTTP://ABC.com/%7Esmith/home.html" ), "http://abc.com/~smith/home.html" );
    t.end();
})

test('registering a schema', function(t){
    var registry = SchemaRegistry.create();
    var schema = { id:'/schema/basic' };

    registry.register( schema );

    t.deepEqual( registry.get(schema.id), {id:'/schema/basic'} );
    t.end();
});


test('retrieving schema fragments', function(t){
    var schema = {
        id: '/schema/def',
        definitions:{
            foo: { type: 'integer' },
            bar: { id:'#bar', type: 'string' }
        },
        misc:{
            id: '/schema/other',
            sub:{
                prop: {id:'#fix/this'}
            }
        }
    };

    var registry = SchemaRegistry.create().register( schema );

    t.deepEqual( registry.get('/schema/def#definitions/foo'), {type: 'integer'} );
    t.deepEqual( registry.get('/schema/def#bar'), {id:'#bar', type:'string'} );
    t.deepEqual( registry.get('/schema/def#definitions/bar'), {id:'#bar', type:'string'} );

    t.end();
});

test('retrieving an array of properties', function(t){
    var schema = {
        id: '/schema/props',
        properties:{
            name:{ type:'string' },
            age: { type:'integer' },
            address: { type:'string' }
        }
    };

    var registry = SchemaRegistry.create();
    var schema = registry.register( schema );

    t.deepEqual(
        registry.getProperties('/schema/props'),
        [{ name:'name', type:'string' }, { name:'age', type:'integer' }, { name:'address', type:'string' }]
        )
    
    t.end();
});

test('returning an array of sorted properties', function(t){
    var schema = {
        id:'/schema/sorted',
        properties:{
            status:{ type:"integer" },
            name:{ type: "string" },
            id:{ type: "integer" },
            count:{ type: "integer" }
        },
        propertyPriorities:{
            status:-1,
            name:2,
            id:3
        }
    };
    var registry = SchemaRegistry.create();
    var schema = registry.register( schema );

    t.deepEqual(
        registry.getProperties('/schema/sorted'),
        [
            { name:'id', priority:3, type:'integer' }, 
            { name:'name', priority:2, type:'string' }, 
            { name:'count', type:'integer' }, 
            { name:'status', priority:-1, type:'integer' }
        ]);

    t.end();
});

test('returning properties from multiple schemas', function(t){
    var schemaA = {
        id:'/multiple/alpha',
        properties:{
            id: { type:'integer' },
            name: { type:'string' }
        }
    };
    var schemaB = {
        id:'/multiple/beta',
        properties:{
            status: { type:'integer' },
            count: { type:'integer' }
        }
    };
    var registry = SchemaRegistry.create();
    

    registry.register( {a:schemaA, b:schemaB} );

    t.deepEqual( 
        _.pluck( registry.getProperties( [ schemaA.id, schemaB.id ] ), 'name' ),
        [ 'id', 'name', 'status', 'count' ]
        );

    t.end();
});


test('merging two schemas', function(t){
    var schemaA = {
        id:'/schema/merge_a',
        properties:{
            count:{ type:'integer' },
            name:{ type:'string' }
        },
        propertyPriorities:{
            count:-4,
            name:4
        }
    };
    var schemaB = {
        id:'/schema/merge_b',
        allOf:[ {'$ref':'/schema/merge_a'} ],
        properties:{
            status:{ type:'integer' }
        }
    };
    var registry = SchemaRegistry.create();
    registry.register( [schemaA, schemaB] );

    // the order is important
    t.deepEqual(
        _.pluck( registry.getProperties(schemaA.id), 'name' ),
        ['name', 'count']
        );

    // should inherit name and count from other schema
    t.deepEqual(
        _.pluck( registry.getProperties(schemaB.id), 'name' ),
        ['name', 'status', 'count']
        );

    t.end();
});


test('returning default properties', function(t){
    var schema = {
        id:'/schema/default',
        properties:{
            name:{ type:'string', 'default':'unknown' },
            age:{ type:'integer', 'default':22 },
            address: { type:'string' }
        }
    };
    var registry = SchemaRegistry.create().register( schema );
    
    t.deepEqual( 
        registry.getPropertiesObject( schema.id ),
        { age: 22, name: 'unknown' }
        );

    t.deepEqual( 
        registry.getPropertiesObject( schema.id, {includeNull:true}),
        {
            address: null,
            age: 22,
            name: 'unknown'
        });

    t.end();
});


test('registration of an identical schema throws an error', function(t){
    var schema = { id:'/schema/original', properties:{ name:{ type:'string' }} };
    var schemaCopy = { id:'/schema/original', properties:{ age:{ type:'integer' }} };
    var registry = SchemaRegistry.create();

    registry.register( schema );

    try{
        registry.register( schema );
    } catch(e){
        t.equal( e.message, 'schema /schema/original already exists' );
    }

    t.deepEqual( 
        registry.get( schema.id ).properties.name.type, 
        schema.properties.name.type );

    t.end();
});



test('register a modified schema', function(t){
    var schemaA = {
        properties:{
            x: { type:'number' },
            y: { type:'number' }
        },
        id:'/schema/dupe'
    };

    var schemaB = {
        id:'/schema/dupe',
        properties:{
            radius: { type:'number' },
            x: { type:'number' },
            y: { type:'number' }
        }
    };

    var registry = SchemaRegistry.create();

    registry.register( {
        id: '/schema/other',
        properties:{
            name:{ type: 'string'}
        }
    });

    t.ok( registry.register( schemaA ), 'registers the first version of the schema' );

    t.ok( registry.register( schemaB ), 'the new version is different and so is accepted' );

    t.deepEqual(
        registry.getProperties('/schema/dupe'),
        [{ name:'radius', type:'number' }, { name:'x', type:'number' }, { name:'y', type:'number' }],
        'the second version is returned' );
    
    t.end();
});

test('retrieving schema with definitions', function(t){
    var sch = {
        id: 'http://foo.bar/baz',
        properties: {
            foo: { $ref: '#/definitions/foo' }
        },
        definitions: {
            foo: { type: 'integer' },
            bar: { id: '#bar', type: 'string' }
        }
    };

    var registry = SchemaRegistry.create().register( sch );
    // printIns( registry, 5 );
    t.deepEqual( registry.get(sch.id + '#/definitions/foo'), {type: 'integer'} );
    
    t.end();
});


test('retrieving different versions of a schema by id', function(t){
    var schemaA = { id:'/schema/alpha', properties:{ name:{type:'string'} }};
    var schemaB = { id:'/schema/alpha', properties:{ fullname:{type:'string'} }};

    var registry = SchemaRegistry.create();
    // Common.logEvents(registry);

    var registeredA = registry.register( [schemaA], {returnSchemas:true} )[0];
    var registeredB = registry.register( [schemaB], {returnSchemas:true} )[0];

    t.deepEqual(
        registry.get( '/schema/alpha', registeredA.hash ),
        schemaA );

    t.deepEqual(
        registry.get( '/schema/alpha', registeredB.hash ),
        schemaB );

    // the last version registered is always returned
    t.deepEqual(
        registry.get( '/schema/alpha' ),
        schemaB );

    t.end();
});

test('obtain full details of a schema', function(t){
    var schema = {
        id:'/schema/details',
        properties:{
            createDate:{ type:'string', format:'datetime' }
        }
    };

    var registry = SchemaRegistry.create().register(schema);

    t.equal( 
        registry.get('/schema/details', {full:true}).hash,
         '0214708d' );

    t.end();
});

test('retrieving parts', function(t){
    var schema = {
        id: '/component/nix',
        properties: {
            firstName: { $ref: '#/definitions/firstName' }
        },
        definitions: {
            firstName: { type: 'string' },
        }
    };

    var registry = SchemaRegistry.create().register(schema);

    t.deepEqual(
        registry.getProperties('/component/nix'),
        [ {name:'firstName', type:'string' }] );

    t.end();
});

test('retrieve schema by hash', function(t){
    var schema = {
        id:'/schema/switch',
        properties:{
            active:{ type:'boolean', 'default':true }
        }
    };

    var registry = SchemaRegistry.create().register(schema);

    // get the latest hash for this component
    var hash = registry.getHash('/schema/switch');

    t.deepEqual(
        registry.get( hash ),
        schema );

    t.end();
})

test('emits an event when adding a schema', function(t){
    t.ok(false);
    t.end();
});

test('deleting a schema', function(t){
    t.ok(false);
    t.end();
});

test('deleting the latest version of a schema', function(t){
    t.ok(false);
    t.end();
});
