require('./common');
var _ = require('underscore');
var SchemaRegistry = Elsinore.SchemaRegistry;

describe('SchemaRegistry', function(){

    describe('registration', function(){
        it('should register a schema', function(){
            var schema = {
                id:'/schema/basic'
            };
            var registry = SchemaRegistry.create().register( schema );
            registry.get( schema.id ).should.deep.equal( {id:'/schema/basic' } );
        });
    });

    describe('fragments', function(){
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

        it('should retrieve a schema fragment', function(){
            var registry = SchemaRegistry.create().register( schema );
            registry.get('/schema/def#definitions/foo').should.deep.equal( {type: 'integer'} );
            registry.get('/schema/def#bar').should.deep.equal( {id:'#bar', type:'string'} );
            registry.get('/schema/def#definitions/bar').should.deep.equal( {id:'#bar', type:'string'} );
        });
    });

    describe('properties', function(){
        
        it('should return an array of properties', function(){
            var schema = {
                id: '/schema/props',
                properties:{
                    name:{ type:'string' },
                    age: { type:'integer' },
                    address: { type:'string' }
                }
            };
            var registry = SchemaRegistry.create().register( schema );
            registry.getProperties('/schema/props').should.deep.equal([
                { name:'name', type:'string' }, { name:'age', type:'integer' }, { name:'address', type:'string' }
            ]);
        });

        it('should return an array of sorted properties', function(){
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

            registry.getProperties('/schema/sorted').should.deep.equal([
                { name:'id', priority:3, type:'integer' }, 
                { name:'name', priority:2, type:'string' }, 
                { name:'count', type:'integer' }, 
                { name:'status', priority:-1, type:'integer' }
            ]);
        });

        it('should return properties from multiple schemas', function(){
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
            _.pluck( registry.getProperties( [ schemaA.id, schemaB.id ] ), 'name' )
                .should.deep.equal([ 'id', 'name', 'status', 'count' ]);
        });

        it('should merge two schemas', function(){
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

            _.pluck( registry.getProperties(schemaA.id), 'name' ).should.deep.equal( ['name', 'count'] );
            _.pluck( registry.getProperties(schemaB.id), 'name' ).should.deep.equal( ['name', 'status', 'count'] );
        });

        it('should return default properties', function(){
            var schema = {
                id:'/schema/default',
                properties:{
                    name:{ type:'string', 'default':'unknown' },
                    age:{ type:'integer', 'default':22 },
                    address: { type:'string' }
                }
            };
            var registry = SchemaRegistry.create().register( schema );
            registry.getPropertiesObject( schema.id ).should.deep.equal({
                age: 22,
                name: 'unknown'
            });

            registry.getPropertiesObject( schema.id, {includeNull:true}).should.deep.equal({
                address: null,
                age: 22,
                name: 'unknown'
            });
        });
    });


    /*
    describe('resolving', function(){

        it('should resolve an integer', function(){
            assert.strictEqual( Schema.resolveProperty( "209", {"type":"integer"} ), 209 );
        });
        it('should resolve a number', function(){
            assert.strictEqual( Schema.resolveProperty( "1.34", {"type":"number"} ), 1.34 );
        });

        it('should resolve a string', function(){
            assert.strictEqual( Schema.resolveProperty( 209, {"type":"string"} ), "209" );
        });

        it('should resolve an object', function(){
            assert.deepEqual( Schema.resolveProperty( '{ "msg":"hello", "parts":[3,1,12] }', {"type":"object"} ), { "msg":"hello", "parts":[3,1,12] } );
        });

        it('should resolve a boolean', function(){
            assert.strictEqual( Schema.resolveProperty( "true", {"type":"boolean"} ), true );
            assert.strictEqual( Schema.resolveProperty( "yes", {"type":"boolean"} ), true );
            assert.strictEqual( Schema.resolveProperty( "1", {"type":"boolean"} ), true );
            assert.strictEqual( Schema.resolveProperty( "0", {"type":"boolean"} ), false );
            assert.strictEqual( Schema.resolveProperty( "no", {"type":"boolean"} ), false );
            assert.strictEqual( Schema.resolveProperty( "false", {"type":"boolean"} ), false );
        });

        // it('should resolve a reference to an model', function(){
        //     this.registry.register({
        //         "id":"/model/cmd",
        //         "type":"object",
        //         "properties":{
        //             "execute_time":{ "type":"integer" }
        //         }
        //     });
        //     var result = Schema.resolveProperty( {"execute_time":"1234"}, {"$ref":"/model/cmd"} );
        //     assert( result instanceof odgn.entity.CmdModelDef.Model );
        //     assert.strictEqual( result.get("execute_time"), 1234 );
        // });
    });//*/
});