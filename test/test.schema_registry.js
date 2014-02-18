require('./common');
var SchemaRegistry = Elsinore.SchemaRegistry;

describe('SchemaRegistry', function(){

    describe('registration', function(){
        it('should register a schema', function(){
            var schema = {
                id:'/schema/basic'
            };
            var registry = SchemaRegistry.create();
            registry.register( schema );
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
            var registry = SchemaRegistry.create();
            registry.register( schema );
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
            var registry = SchemaRegistry.create();
            registry.register( schema );
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
            var registry = SchemaRegistry.create();
            registry.register( schema );
            registry.getProperties('/schema/sorted').should.deep.equal([
                { name:'id', priority:3, type:'integer' }, 
                { name:'name', priority:2, type:'string' }, 
                { name:'count', type:'integer' }, 
                { name:'status', priority:-1, type:'integer' }
            ]);
        });
    });


    /*
    it('should return properties sorted', function(){
        var schema = {
            "id":"/schema/sorted",
            "properties":{
                "status":{ "type":"integer" },
                "name":{ "type": "string" },
                "id":{ "type": "integer" },
                "count":{ "type": "integer" }
            },
            "propertyPriorities":{
                "status":-1,
                "name":2,
                "id":3
            }
        };

        Schema.addSchema( schema );

        assert.deepEqual( 
            _.pluck(Schema.getProperties(schema.id),'name'), 
            ['id', 'name', 'count', 'status']);
    });

    it('should merge two schemas properties together', function(){
        var schemaA = {
            "id":"/schema/merge_a",
            "properties":{
                "count":{ "type":"integer" },
                "name":{ "type":"string" }
            },
            "propertyPriorities":{
                "count":-4,
                "name":4
            }
        };
        var schemaB = {
            "id":"/schema/merge_b",
            "allOf":[ {"$ref":"/schema/merge_a"} ],
            "properties":{
                "status":{ "type":"integer" }
            }
        };

        Schema.addSchema( schemaA );
        Schema.addSchema( schemaB );

        // getting just the properties of A
        assert.deepEqual( 
           _.pluck(Schema.getProperties(schemaA.id),'name'), 
           ['name', 'count']);
       
        // because B has an allOf, A's properties will be added
        assert.deepEqual(
           _.pluck(Schema.getProperties(schemaB.id),'name'), 
           ['name', 'status', 'count']);

        // specifying two schemas will join them
        assert.deepEqual( 
           _.pluck(Schema.getProperties([schemaA.id, schemaB.id]),'name'), 
           ['name', 'status', 'count']);
    });


    it('should return default properties', function(){
        var schemaA = {
            "id":"/schema/def_a", "type":"object",
            "properties":{
                "count":{ "type":"integer", "default":1 },
                "name":{ "type":"string", "default":"unknown" }
            }
        };

        Schema.addSchema( schemaA );
        assert.deepEqual(
            Schema.getDefaultValues( schemaA.id ),
            {count:1, name:'unknown'} );
    });

    it('should return no default properties if not defined', function(){
        var schemaA = {
            "id":"/schema/def_a", "type":"object",
            "properties":{
                "count":{ "type":"integer" },
                "name":{ "type":"string", "default":"unknown" }
            }
        };

        Schema.addSchema( schemaA );
        assert.deepEqual(
            Schema.getDefaultValues( schemaA.id ),
            {count:null, name:'unknown'} );
    });

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