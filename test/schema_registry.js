import _ from 'underscore';
import test from 'tape';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query, SchemaRegistry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';

import * as SchemaProperties from '../src/schema/properties';

// compile a map of schema id(uri) to schema
let componentSchemas = require('./fixtures/components.json');
let componentByUri = _.reduce( componentSchemas, 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});


/**
 
 NOTE: this style of schema registry is not currently being used - its
 been replaced with a simpler, non JSON schema, variant.

*/

// test.skip('uri normalization', t => {
//     t.equal( Elsinore.Utils.normalizeUri( "HTTP://ABC.com/%7Esmith/home.html" ), "http://abc.com/~smith/home.html" );
//     t.end();
// })

test.skip('registering a schema', t => {
    const registry = SchemaRegistry.create();
    const schema = { id:'/schema/basic' };

    registry.register( schema );

    t.deepEqual( registry.get(schema.id), {id:'/schema/basic'} );
    t.end();
});




test.skip('retrieving schema fragments', t => {
    const schema = {
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

    const registry = SchemaRegistry.create();
    // Common.logEvents( registry );
    registry.register( schema );

    t.deepEqual( registry.get('elsinore:/schema#definitions/foo'), {type: 'integer'} );
    t.deepEqual( registry.get('elsinore:/schema#baz'), {id:'elsinore:/schema#baz', type:'string'} );
    t.deepEqual( registry.get('elsinore:/schema#definitions/bar'), {id:'elsinore:/schema#baz', type:'string'} );

    t.end();
});

test.skip('returns an array of all registered schemas', t => {
    const schema = {
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

    const registry = SchemaRegistry.create();
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

test.skip('retrieving an array of properties', t => {
    
    const registry = SchemaRegistry.create();
    const schema = registry.register( {
        id: 'elsinore:/schema/props',
        properties:{
            name:{ type:'string' },
            age: { type:'integer' },
            address: { type:'string' }
        }
    } );

    t.deepEqual(
        SchemaProperties.getProperties(registry, 'elsinore:/schema/props'),
        [{ name:'name', type:'string' }, { name:'age', type:'integer' }, { name:'address', type:'string' }]
        )
    
    t.end();
});

test.skip('returning an array of sorted properties', t => {
    const schemaData = {
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
    const registry = SchemaRegistry.create();
    const schema = registry.register( schemaData );

    t.deepEqual(
        SchemaProperties.getProperties(registry,'elsinore:/schema/sorted'),
        [
            { name:'id', priority:3, type:'integer' }, 
            { name:'name', priority:2, type:'string' }, 
            { name:'count', type:'integer' }, 
            { name:'status', priority:-1, type:'integer' }
        ]);

    t.end();
});

test.skip('returning properties from multiple schemas', t => {
    const schemaA = {
        id:'/multiple/alpha',
        properties:{
            id: { type:'integer' },
            name: { type:'string' }
        }
    };
    const schemaB = {
        id:'/multiple/beta',
        properties:{
            status: { type:'integer' },
            count: { type:'integer' }
        }
    };
    const registry = SchemaRegistry.create();
    

    registry.register( {a:schemaA, b:schemaB} );

    t.deepEqual( 
        _.pluck( SchemaProperties.getProperties( registry, [ schemaA.id, schemaB.id ] ), 'name' ),
        [ 'id', 'name', 'status', 'count' ]
        );

    t.end();
});


test.skip('merging two schemas', t => {
    const schemaA = {
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
    const schemaB = {
        id:'/schema/merge_b',
        allOf:[ {'$ref':'/schema/merge_a'} ],
        properties:{
            status:{ type:'integer' }
        }
    };
    const registry = SchemaRegistry.create();
    registry.register( [schemaA, schemaB] );

    // the order is important
    t.deepEqual(
        _.pluck( SchemaProperties.getProperties(registry, schemaA.id), 'name' ),
        ['name', 'count']
        );

    // printVar( registry.schemaByHash );

    // should inherit name and count from other schema
    t.deepEqual(
        _.pluck( SchemaProperties.getProperties(registry, schemaB.id), 'name' ),
        ['name', 'status', 'count']
        );

    t.end();
});


test.skip('returning default properties', t => {
    const schema = {
        id:'/schema/default',
        properties:{
            name:{ type:'string', 'default': 'unknown' },
            age:{ type:'integer', 'default': 22 },
            address: { type:'string' }
        }
    };
    const registry = SchemaRegistry.create();
    registry.register( schema );

    t.deepEqual(
        SchemaProperties.getProperties( registry, schema.id ),
        [
        { default: 'unknown', name: 'name', type: 'string' }, 
        { default: 22, name: 'age', type: 'integer' }, 
        { name: 'address', type: 'string' }
        ] );
    
    t.deepEqual( 
        SchemaProperties.getPropertiesObject( registry, schema.id ),
        { age: 22, name: 'unknown' }
        );

    t.deepEqual( 
        SchemaProperties.getPropertiesObject( registry, schema.id, {includeNull:true}),
        {
            address: null,
            age: 22,
            name: 'unknown'
        });

    // fragment value picks out the specific property
    t.deepEqual(
        SchemaProperties.getProperties( registry, '/schema/default#age' ),
        { default: 22, name: 'age', type: 'integer' } );

    t.end();
});


test.skip('registration of an identical schema throws an error', t => {
    const schema = { id:'/schema/original', properties:{ name:{ type:'string' }} };
    const schemaCopy = { id:'/schema/original', properties:{ age:{ type:'integer' }} };
    const registry = SchemaRegistry.create();

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

test.skip('registration of an identical schema doesnt throw an error if required', t => {
    const schema = { id:'/schema/original', properties:{ name:{ type:'string' }} };
    const registry = SchemaRegistry.create();

    registry.register( schema );
    
    const outcome = registry.register( schema, {throwOnExists:false} );
    
    t.deepEqual( 
        registry.get( schema.id ).properties.name.type, 
        schema.properties.name.type );

    t.end();
});

test.skip('register a modified schema', t => {
    const schemaA = {
        properties:{
            x: { type:'number' },
            y: { type:'number' }
        },
        id:'/schema/dupe'
    };

    const schemaB = {
        id:'/schema/dupe',
        properties:{
            radius: { type:'number' },
            x: { type:'number' },
            y: { type:'number' }
        }
    };

    const registry = SchemaRegistry.create();

    registry.register( {
        id: '/schema/other',
        properties:{
            name:{ type: 'string'}
        }
    });

    t.ok( registry.register( schemaA ), 'registers the first version of the schema' );

    t.ok( registry.register( schemaB ), 'the new version is different and so is accepted' );

    t.deepEqual(
        SchemaProperties.getProperties(registry, '/schema/dupe'),
        [{ name:'radius', type:'number' }, { name:'x', type:'number' }, { name:'y', type:'number' }],
        'the second version is returned' );
    
    t.end();
});

test.skip('retrieving schema with definitions', t => {
    const sch = {
        id: 'http://foo.bar/baz',
        properties: {
            foo: { $ref: '#/definitions/foo' }
        },
        definitions: {
            foo: { type: 'integer' },
            bar: { id: '#bar', type: 'string' }
        }
    };

    const registry = SchemaRegistry.create();
    registry.register( sch );

    // printIns( registry, 5 );
    t.deepEqual( registry.get(sch.id + '#/definitions/foo'), {type: 'integer'} );
    
    t.end();
});


test.skip('retrieving different versions of a schema by id', t => {
    const schemaA = { id:'/schema/alpha', properties:{ name:{type:'string'} }};
    const schemaB = { id:'/schema/alpha', properties:{ fullname:{type:'string'} }};

    const registry = SchemaRegistry.create();
    // Common.logEvents(registry);

    const registeredA = registry.register( [schemaA] )[0];
    const registeredB = registry.register( [schemaB] )[0];

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

test.skip('something or other', t => {
    const schema = {
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

    const registry = SchemaRegistry.create();
    // Common.logEvents( registry );
    registry.register( schema );

    t.deepEqual(
        registry.get('elsinore:/schema#boat'),
        {id: 'elsinore:/schema#boat', properties: { length: {}, name: {} }} );
    
    t.end();

});

test.skip('obtain full details of a schema', t => {
    const schema = {
        id:'/schema/details',
        properties:{
            createDate:{ type:'string', format:'datetime' }
        }
    };

    const registry = SchemaRegistry.create();

    registry.register(schema);

    t.equal( 
        registry.get('/schema/details', {full:true}).hash,
         '0214708d' );

    t.end();
});

test.skip('retrieving parts', t => {
    const schema = {
        id: '/component/nix',
        properties: {
            firstName: { $ref: '#/definitions/firstName' }
        },
        definitions: {
            firstName: { type: 'string' },
        }
    };

    const registry = SchemaRegistry.create();
    registry.register(schema);

    t.deepEqual(
        SchemaProperties.getProperties( registry, '/component/nix'),
        [ {name:'firstName', type:'string' }] );

    t.end();
});

test.skip('retrieve schema by hash', t => {
    const schema = {
        id:'/schema/switch',
        properties:{
            active:{ type:'boolean', 'default':true }
        }
    };

    const registry = SchemaRegistry.create()
    registry.register(schema);

    // get the latest hash for this component
    const hash = registry.getHash('/schema/switch');

    t.deepEqual(
        registry.get( hash ),
        schema );

    t.end();
});


test.skip('new version of sub schema', t => {
    const schema = {
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

    const registry = SchemaRegistry.create()
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


test.skip('registering a schema returns the schemas registered', t => {
    const registry = SchemaRegistry.create();

    const registered = registry.register({
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


test.skip('attempting to retrieve an unknown schema throws an error', t => {
    const registry = SchemaRegistry.create();

    t.throws( function(){
        registry.getIId('/component/missing')}, /could not find schema \/component\/missing/ );
    
    t.end();
});

test.skip('returns an array of schema internal ids from a series of identifiers', t => {
    const registry = SchemaRegistry.create();
    registry.register( componentSchemas );

    t.deepEqual(
        registry.getIId( '/component/position', 'c6c1bcdf', 9, '/component/geo_location', 'bd12d7de' ),
        [ 20, 17, 9, 8, 4 ] );

    t.end();
});


test.skip('returns schema uris from internal ids', t => {
    let registry = SchemaRegistry.create();
    registry.register( componentSchemas );

    const cases = {
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
