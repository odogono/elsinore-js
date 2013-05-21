require('./common');
var tv4 = require('tv4').tv4;

describe('Registry', function(){
    beforeEach( function(){
        // unload and reload the odgn module
        delete require.cache[ require.resolve('../index') ];
        odgn = require('../index')();
        this.registry = odgn.Entity.Registry.create();
    });

    describe('resolving', function(){

        it('should resolve an integer', function(){
            assert.strictEqual( this.registry.resolve( "209", {"type":"integer"} ), 209 );
        });
        it('should resolve a number', function(){
            assert.strictEqual( this.registry.resolve( "1.34", {"type":"number"} ), 1.34 );
        });

        it('should resolve a string', function(){
            assert.strictEqual( this.registry.resolve( 209, {"type":"string"} ), "209" );
        });

        it('should resolve an object', function(){
            assert.deepEqual( this.registry.resolve( '{ "msg":"hello", "parts":[3,1,12] }', {"type":"object"} ), { "msg":"hello", "parts":[3,1,12] } );
        });

        it('should resolve a boolean', function(){
            assert.strictEqual( this.registry.resolve( "true", {"type":"boolean"} ), true );
            assert.strictEqual( this.registry.resolve( "yes", {"type":"boolean"} ), true );
            assert.strictEqual( this.registry.resolve( "1", {"type":"boolean"} ), true );
            assert.strictEqual( this.registry.resolve( "0", {"type":"boolean"} ), false );
            assert.strictEqual( this.registry.resolve( "no", {"type":"boolean"} ), false );
            assert.strictEqual( this.registry.resolve( "false", {"type":"boolean"} ), false );
        });

        it('should resolve a reference to an entity', function(){
            this.registry.register({
                "id":"/entity/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });
            var result = this.registry.resolve( {"execute_time":"1234"}, {"$ref":"/entity/cmd"} );
            assert( result instanceof odgn.Entity.CmdEntityDef.Model );
            assert.strictEqual( result.get("execute_time"), 1234 );
        });
    });

    describe('Registration', function(){

        it('should retrieve properties from the schema', function(){
            this.registry.register({
                "id":"/entity/cmd",
                "type":"object",
                "properties":{
                    "type":{ "type":"integer" },
                    "execute_time":{ "type":"integer" },
                    "created_at":{ "type":"string" }
                }
            });

            assert.deepEqual( 
                this.registry.get("/entity/cmd").retrieveSchemaProperties(['type', 'created_at']),
                { "type":{ "type":"integer" }, "created_at":{ "type":"string" } } ); 
        });

    });
});

describe('Entity', function(){

    beforeEach( function(){
        // unload and reload the odgn module
        delete require.cache[ require.resolve('../index') ];
        odgn = require('../index')();
        this.registry = odgn.Entity.Registry.create();
    });

    describe('registration', function(){

        /*it.only('should normalise', function(){
            var schema = {
                "id":"/user",
                "title": "User",
                "type": "object",
                "properties": {
                    "username": {
                        "title": "User name",
                        "type": "string",
                        "pattern": "[a-zA-Z][a-zA-Z0-9]*",
                        "minLength": 4,
                        "maxLength": 20,
                    }
                },
                "required": [ "username" ]
            };
            // tv4.normSchema( schema );
            print_var( schema );
            tv4.addSchema( schema.id, schema );

            var username = { "user": "kip" };

            var result = tv4.validate( username, "/user" );// "/user#/properties/username");
            print_var( tv4.error );
            print_var( tv4.resolveUrl('/user', '/required/0'));
        });//*/

        it('should register a new entity',function(){
            
            var ActorEntityDef = this.registry.register({
                id: "/entity/actor",
                type:"object"
            });

            var inst = ActorEntityDef.create();
            assert( inst instanceof odgn.Entity.ActorEntityDef.Model );
        });

        it('should register an entity with a title', function(){
            this.registry.register({
                id: "/entity/misc",
                title:"primary"
            });
            var inst = this.registry.create('primary');
            assert( inst instanceof odgn.Entity.PrimaryEntityDef.Model );
        });

        it('should create an entity instance from a schema id', function(){
            this.registry.register({
                id: "/entity/actor",
                type:"object"
            });

            var oinst = this.registry.create("/entity/actor");
            assert( oinst instanceof odgn.Entity.ActorEntityDef.Model );
        });

        it('should retrieve an entity definition', function(){
            this.registry.register({ "id":"/entity/person", "type":"object" });
            assert.equal( odgn.Entity.PersonEntityDef, this.registry.get("/entity/person") );
        });
    });

    describe('properties', function(){
    });

    describe('parsing', function(){
        
        it('should parse', function(){
            var ActorEntityDef = this.registry.register({
                id: "/entity/actor",
                type:"object",
                properties:{
                    name: { type:"string" }
                }
            });

            var inst = ActorEntityDef.parse({
                name: 'alec',
                age:56
            });
            assert.equal( inst.get('name'), 'alec' );
            assert.equal( inst.get('age'), 56 );
        });

        it('should parse an identified serialised entity', function(){
            this.registry.register({
                "id":"/entity/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });

            var inst = this.registry.parse({
                "schema_id":"/entity/cmd",
                "execute_time": 1234
            });

            assert( inst instanceof odgn.Entity.CmdEntityDef.Model );

            // the schemaId can also be specified in the options
            var inst = this.registry.parse({ "execute_time": 909}, {schemaId:"/entity/cmd"} );
            assert( inst instanceof odgn.Entity.CmdEntityDef.Model );
            assert.equal( inst.get('execute_time'), 909 );            
        });

        it('should parse an array of serialised entities', function(){
            this.registry.register({
                "title":"cmd",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });

            var instArray = this.registry.parse([
                { "schema_id":"cmd", "execute_time": 1234 },
                { "execute_time": 25 },
                { "execute_time": 256 }
            ]);

            assert.equal( instArray.length, 3 );
            assert( instArray[2] instanceof odgn.Entity.CmdEntityDef.Model );

            instArray = this.registry.parse([
                { "execute_time":23 },
                { "execute_time":1908, "exeute_count":5 },
                { "execute_time":668 },
            ], {schemaId:'cmd'} );

            assert( instArray[0] instanceof odgn.Entity.CmdEntityDef.Model );
            assert.equal( instArray[1].get('exeute_count'), 5 );
        });
    });


    describe('one to one', function(){

        it('should have a o2o', function(){

            // register a command, which has an execute time attribute
            this.registry.register({
                "id":"/entity/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });

            // register a command queue, which has an id and a
            // single command reference
            this.registry.register({
                "id":"/entity/cmd_queue",
                "type":"object",
                "properties":{
                    "id":{ "type":"string" },
                    "cmd":{
                        "$ref":"/entity/cmd"
                    }
                }
            });

            // parse the JSON into an entity
            var inst = odgn.Entity.CmdQueueEntityDef.parse({
                "id":"cq.001",
                "cmd":{
                    "id":"cmd.001",
                    "execute_time": 400
                }
            });

            // the result is an instance of the command queue
            assert( inst instanceof odgn.Entity.CmdQueueEntityDef.Model );
            assert.equal( inst.id, "cq.001" );

            // retrieving the command attribute returns a command entity instance
            assert( inst.get('cmd') instanceof odgn.Entity.CmdEntityDef.Model );
            assert.equal( inst.get('cmd').id, "cmd.001" );
            assert.equal( inst.get('cmd').get('execute_time'), 400 );
        });

        it.skip('can maintain a back reference to the parent', function(){
            // register a command, which has an execute time attribute
            this.registry.register({
                "id":"/entity/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" },
                    "queue":{ "$ref":"/entity/cmd_queue", "$backRef":"cmd" }
                }
            });

            // register a command queue, which has an id and a
            // single command reference
            this.registry.register({
                "id":"/entity/cmd_queue",
                "type":"object",
                "properties":{
                    "id":{ "type":"string" },
                    "cmd":{
                        "$ref":"/entity/cmd"
                    }
                }
            });
        });
    });

    describe('one to many', function(){
    });


    describe('toJSON', function(){
    });

});