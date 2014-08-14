var test = require('tape');
var Common = require('./common');
var SchemaRegistry = Elsinore.SchemaRegistry;


test('registering a schema', function(t){
    var registry = SchemaRegistry.create();
    var schema = { id:'/schema/basic' };

    registry.register( schema );

    t.deepEqual( registry.get(schema.id), {id:'/schema/basic'} );
    t.end();
});

test('ignoring registration of a schema with an identical id', function(t){
    var schema = { id:'/schema/original', properties:{ name:{ type:'string' }} };
    var schemaCopy = { id:'/schema/original', properties:{ age:{ type:'integer' }} };
    var registry = SchemaRegistry.create()
        .register( schema )
        .register( schemaCopy );
    t.deepEqual( registry.get( schema.id ), _.extend({}, schema) );
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

    var registry = SchemaRegistry.create().register( schema );

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
    var registry = SchemaRegistry.create().register( schema );

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
    var registry = SchemaRegistry.create().register( schemaA ).register(schemaB);

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
    var registry = SchemaRegistry.create().register( schemaA ).register( schemaB );

    t.deepEqual(
        _.pluck( registry.getProperties(schemaA.id), 'name' ),
        ['name', 'count']
        );

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