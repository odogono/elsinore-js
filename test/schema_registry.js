'use strict';

var _ = require('underscore');
var test = require('tape');


var Elsinore = require('../lib');
var SchemaRegistry = Elsinore.SchemaRegistry;

var Common = require('./common');


// compile a map of schema id(uri) to schema
var componentSchemas = require('./fixtures/components.json');
var componentByUri = _.reduce( componentSchemas, 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});



test.skip('uri normalization', t => {
    t.equal( Elsinore.Utils.normalizeUri( "HTTP://ABC.com/%7Esmith/home.html" ), "http://abc.com/~smith/home.html" );
    t.end();
})

test('registering a schema', t => {
    var registry = SchemaRegistry.create();
    var schema = { id:'/schema/basic' };

    registry.register( schema );

    t.deepEqual( registry.get(schema.id), {id:'/schema/basic'} );
    t.end();
});




test('retrieving schema fragments', t => {
    let schema = {
        id: 'elsinore:/schema',
        definitions:{
            foo: { type: 'integer' },
            bar: { id:'#baz', type: 'string' }
        },
        misc:{
            id: '/schema/other',
            sub:{
                prop: { id:'#fix/this' }
            }
        }
    };

    let registry = SchemaRegistry.create();
    // Common.logEvents( registry );
    registry.register( schema );

    t.deepEqual( registry.get('elsinore:/schema#definitions/foo'), {type: 'integer'} );
    t.deepEqual( registry.get('elsinore:/schema#baz'), {id:'elsinore:/schema#baz', type:'string'} );
    t.deepEqual( registry.get('elsinore:/schema#definitions/bar'), {id:'elsinore:/schema#baz', type:'string'} );

    t.end();
});

test('returns an array of all registered schemas', t => {
    let schema = {
        id: 'elsinore:/schema',
        definitions:{
            foo: { type: 'integer' },
            bar: { id:'#baz', type: 'string' }
        },
        misc:{
            id: '/schema/other',
            sub:{
                prop: { id:'#fix/this' }
            }
        }
    };

    let registry = SchemaRegistry.create();
    registry.register( schema );

    t.deepEquals( 
        _.map(registry.getAll(), s => _.pick( s, 'iid', 'uri', 'hash' ) ),
        [
            { iid: 3, uri: 'elsinore:/schema/other#fix/this', hash: 'b457288d' },
            { iid: 4, uri: 'elsinore:/schema#baz', hash: '0c8a41d6' },
            { iid: 5, uri: 'elsinore:/schema', hash: '9016491f' },
            { iid: 6, uri: 'elsinore:/schema/other', hash: '123cf727' }
        ] );

    t.end();
})

test('retrieving an array of properties', t => {
    var schema = {
        id: 'elsinore:/schema/props',
        properties:{
            name:{ type:'string' },
            age: { type:'integer' },
            address: { type:'string' }
        }
    };

    var registry = SchemaRegistry.create();
    var schema = registry.register( schema );

    t.deepEqual(
        registry.getProperties('elsinore:/schema/props'),
        [{ name:'name', type:'string' }, { name:'age', type:'integer' }, { name:'address', type:'string' }]
        )
    
    t.end();
});

test('returning an array of sorted properties', t => {
    var schema = {
        id:'elsinore:/schema/sorted',
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
        registry.getProperties('elsinore:/schema/sorted'),
        [
            { name:'id', priority:3, type:'integer' }, 
            { name:'name', priority:2, type:'string' }, 
            { name:'count', type:'integer' }, 
            { name:'status', priority:-1, type:'integer' }
        ]);

    t.end();
});

test('returning properties from multiple schemas', t => {
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


test('merging two schemas', t => {
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

    // printVar( registry.schemaByHash );

    // should inherit name and count from other schema
    t.deepEqual(
        _.pluck( registry.getProperties(schemaB.id), 'name' ),
        ['name', 'status', 'count']
        );

    t.end();
});


test('returning default properties', t => {
    var schema = {
        id:'/schema/default',
        properties:{
            name:{ type:'string', 'default': 'unknown' },
            age:{ type:'integer', 'default': 22 },
            address: { type:'string' }
        }
    };
    var registry = SchemaRegistry.create();
    registry.register( schema );

    t.deepEqual(
        registry.getProperties( schema.id ),
        [
        { default: 'unknown', name: 'name', type: 'string' }, 
        { default: 22, name: 'age', type: 'integer' }, 
        { name: 'address', type: 'string' }
        ] );
    
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


test('registration of an identical schema throws an error', t => {
    var schema = { id:'/schema/original', properties:{ name:{ type:'string' }} };
    var schemaCopy = { id:'/schema/original', properties:{ age:{ type:'integer' }} };
    var registry = SchemaRegistry.create();

    // Common.logEvents( registry );

    registry.register( schema );
    // printIns( registry, 6 );

    try{
        registry.register( schema );
    } catch(e){
        t.equal( e.message, 'schema /schema/original (d3335c43) already exists' );
    }

    t.deepEqual( 
        registry.get( schema.id ).properties.name.type, 
        schema.properties.name.type );

    t.end();
});



test('register a modified schema', t => {
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

test('retrieving schema with definitions', t => {
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

    var registry = SchemaRegistry.create();
    registry.register( sch );

    // printIns( registry, 5 );
    t.deepEqual( registry.get(sch.id + '#/definitions/foo'), {type: 'integer'} );
    
    t.end();
});


test('retrieving different versions of a schema by id', t => {
    var schemaA = { id:'/schema/alpha', properties:{ name:{type:'string'} }};
    var schemaB = { id:'/schema/alpha', properties:{ fullname:{type:'string'} }};

    var registry = SchemaRegistry.create();
    // Common.logEvents(registry);

    var registeredA = registry.register( [schemaA] )[0];
    var registeredB = registry.register( [schemaB] )[0];

    // printIns( registeredA );

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

test('something or other', t => {
    var schema = {
        id: 'elsinore:/schema',

        boat:{
            properties:{
                name: { '$ref':'#definitions/name' },
                length: { '$ref':'#definitions/length' }
            }
        },

        definitions:{
            length: { type: 'integer' },
            name: { type: 'string' }
        },
    };

    var registry = SchemaRegistry.create();
    // Common.logEvents( registry );
    registry.register( schema );

    t.deepEqual(
        registry.get('elsinore:/schema#boat'),
        {id: 'elsinore:/schema#boat', properties: { length: {}, name: {} }} );
    
    t.end();

});

test('obtain full details of a schema', t => {
    var schema = {
        id:'/schema/details',
        properties:{
            createDate:{ type:'string', format:'datetime' }
        }
    };

    var registry = SchemaRegistry.create();

    registry.register(schema);

    t.equal( 
        registry.get('/schema/details', {full:true}).hash,
         '0214708d' );

    t.end();
});

test('retrieving parts', t => {
    var schema = {
        id: '/component/nix',
        properties: {
            firstName: { $ref: '#/definitions/firstName' }
        },
        definitions: {
            firstName: { type: 'string' },
        }
    };

    var registry = SchemaRegistry.create();
    registry.register(schema);

    t.deepEqual(
        registry.getProperties('/component/nix'),
        [ {name:'firstName', type:'string' }] );

    t.end();
});

test('retrieve schema by hash', t => {
    var schema = {
        id:'/schema/switch',
        properties:{
            active:{ type:'boolean', 'default':true }
        }
    };

    var registry = SchemaRegistry.create()
    registry.register(schema);

    // get the latest hash for this component
    var hash = registry.getHash('/schema/switch');

    t.deepEqual(
        registry.get( hash ),
        schema );

    t.end();
});


test('new version of sub schema', t => {
    var schema = {
        id:'/schema/parent',

        components:{
            'personal':{
                id:'personal',
                properties:{
                    firstName: { '$ref': '#/definitions/firstName'}
                }
            },

            'address':{
                id:'address',
                properties:{
                    postCode: { '$ref': '#/definitions/postCode' }
                }
            }
        },

        definitions:{
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            postCode: { type:'string' }
        }
    };

    var registry = SchemaRegistry.create()
    registry.register(schema);

    registry.register({
        id: '/schema/parent/address',
        properties:{
            streetName:{ type:'string' }
        }
    });

    // printIns( registry.schemaByHash, 6 );

    // printIns( registry.get('/schema/parent/address', {resolve:true} ), 6 );
    t.end();
})


test('registering a schema returns the schemas registered', t => {
    var registry = SchemaRegistry.create();

    var registered = registry.register({
        id: '/schema/parent/address',
        properties:{
            streetName:{ type:'string' }
        },
        sub:{
            id: '/schema/related',
            properties:{
                age:{ type:'integer' }
            }
        }
    });

    t.deepEqual(
        _.map( registered, function(s){ return s.uri; }),
        [ '/schema/parent/address', '/schema/related' ] );

    t.end();
});


test('attempting to retrieve an unknown schema throws an error', t => {
    var registry = SchemaRegistry.create();

    t.throws( function(){
        registry.getIId('/component/missing')}, /could not find schema \/component\/missing/ );
    
    t.end();
});

test('returns an array of schema internal ids from a series of identifiers', t => {
    var registry = SchemaRegistry.create();
    registry.register( componentSchemas );

    t.deepEqual(
        registry.getIId( '/component/position', 'c6c1bcdf', 9, '/component/geo_location', 'bd12d7de' ),
        [ 20, 17, 9, 8, 4 ] );

    t.end();
});

test('returns schema uris from internal ids', t => {
    let registry = SchemaRegistry.create();
    registry.register( componentSchemas );

    var cases = {
        '/component/position': '/component/position', 
        'c6c1bcdf': '/component/command', 
        16: '/component/channel',
        '4f9f94d8': '/component/geo_location'
    };

    _.each( cases, (expected,val) => {
        // log.debug('grabbing ' + val);
        var r = registry.get(val);
        // log.debug('got back ' + JSON.stringify(r) );
        t.equals( registry.get( val ).id, expected ); 
    });

    // t.equals(
    //     registry.getIId('/component/geo_location')

    t.end();
});

test.skip('registering a schema doesnt return non-registered schemas', t => {
    t.ok( false );
    t.end();
});



test.skip('emits an event when adding a schema', t => {
    t.ok(false);
    t.end();
});

test.skip('deleting a schema', t => {
    t.ok(false);
    t.end();
});

test.skip('deleting the latest version of a schema', t => {
    t.ok(false);
    t.end();
});
