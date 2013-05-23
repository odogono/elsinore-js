require('./common');
var tv4 = require('tv4').tv4;

describe('Registry', function(){
    beforeEach( function(){
        // unload and reload the odgn module
        delete require.cache[ require.resolve('../index') ];
        odgn = require('../index')();
        this.registry = odgn.entity.ModelRegistry.create();
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

        it('should resolve a reference to an model', function(){
            this.registry.register({
                "id":"/model/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });
            var result = this.registry.resolve( {"execute_time":"1234"}, {"$ref":"/model/cmd"} );
            assert( result instanceof odgn.entity.CmdModelDef.Model );
            assert.strictEqual( result.get("execute_time"), 1234 );
        });
    });

    describe('Registration', function(){

        it('should retrieve properties from the schema', function(){
            this.registry.register({
                "id":"/model/cmd",
                "type":"object",
                "properties":{
                    "type":{ "type":"integer" },
                    "execute_time":{ "type":"integer" },
                    "created_at":{ "type":"string" }
                }
            });

            assert.deepEqual( 
                this.registry.get("/model/cmd").retrieveSchemaProperties(['type', 'created_at']),
                { "type":{ "type":"integer" }, "created_at":{ "type":"string" } } ); 
        });

    });
});

describe('Model', function(){

    beforeEach( function(){
        // unload and reload the odgn module
        delete require.cache[ require.resolve('../index') ];
        odgn = require('../index')();
        this.registry = odgn.entity.ModelRegistry.create();
    });

    describe('registration', function(){

        it('should register a new model',function(){
            
            var ActorModelDef = this.registry.register({
                id: "/model/actor",
                type:"object"
            });

            var inst = ActorModelDef.create();
            assert( inst instanceof odgn.entity.ActorModelDef.Model );
        });

        it('should register an model with a title', function(){
            this.registry.register({
                id: "/model/misc",
                title:"primary"
            });
            var inst = this.registry.create('primary');
            assert( inst instanceof odgn.entity.PrimaryModelDef.Model );
        });

        it('should create an model instance from a schema id', function(){
            this.registry.register({
                id: "/model/actor",
                type:"object"
            });

            var oinst = this.registry.create("/model/actor");
            assert( oinst instanceof odgn.entity.ActorModelDef.Model );
        });

        it('should retrieve an model definition', function(){
            this.registry.register({ "id":"/model/person", "type":"object" });
            assert.equal( odgn.entity.PersonModelDef, this.registry.get("/model/person") );
        });
    });

    describe('properties', function(){
    });

    describe('parsing', function(){
        
        it('should parse', function(){
            var ActorModelDef = this.registry.register({
                id: "/model/actor",
                type:"object",
                properties:{
                    name: { type:"string" }
                }
            });

            var inst = ActorModelDef.parse({
                name: 'alec',
                age:56
            });
            assert.equal( inst.get('name'), 'alec' );
            assert.equal( inst.get('age'), 56 );
        });

        it('should parse an identified serialised model', function(){
            this.registry.register({
                "id":"/model/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });

            var inst = this.registry.parse({
                "schema_id":"/model/cmd",
                "execute_time": 1234
            });

            assert( inst instanceof odgn.entity.CmdModelDef.Model );

            // the schemaId can also be specified in the options
            var inst = this.registry.parse({ "execute_time": 909}, {schemaId:"/model/cmd"} );
            assert( inst instanceof odgn.entity.CmdModelDef.Model );
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
            assert( instArray[2] instanceof odgn.entity.CmdModelDef.Model );

            instArray = this.registry.parse([
                { "execute_time":23 },
                { "execute_time":1908, "exeute_count":5 },
                { "execute_time":668 },
            ], {schemaId:'cmd'} );

            assert( instArray[0] instanceof odgn.entity.CmdModelDef.Model );
            assert.equal( instArray[1].get('exeute_count'), 5 );
        });
    });


    describe('one to one', function(){

        it('should have a o2o', function(){

            // register a command, which has an execute time attribute
            this.registry.register({
                "id":"/model/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" }
                }
            });

            // register a command queue, which has an id and a
            // single command reference
            this.registry.register({
                "id":"/model/cmd_queue",
                "type":"object",
                "properties":{
                    "id":{ "type":"string" },
                    "cmd":{
                        "$ref":"/model/cmd"
                    }
                }
            });

            // parse the JSON into an model
            var inst = odgn.entity.CmdQueueModelDef.parse({
                "id":"cq.001",
                "cmd":{
                    "id":"cmd.001",
                    "execute_time": 400
                }
            });

            // the result is an instance of the command queue
            assert( inst instanceof odgn.entity.CmdQueueModelDef.Model );
            assert.equal( inst.id, "cq.001" );

            // retrieving the command attribute returns a command model instance
            assert( inst.get('cmd') instanceof odgn.entity.CmdModelDef.Model );
            assert.equal( inst.get('cmd').id, "cmd.001" );
            assert.equal( inst.get('cmd').get('execute_time'), 400 );
        });

        it.skip('can maintain a back reference to the parent', function(){
            // register a command, which has an execute time attribute
            this.registry.register({
                "id":"/model/cmd",
                "type":"object",
                "properties":{
                    "execute_time":{ "type":"integer" },
                    "queue":{ "$ref":"/model/cmd_queue", "$backRef":"cmd" }
                }
            });

            // register a command queue, which has an id and a
            // single command reference
            this.registry.register({
                "id":"/model/cmd_queue",
                "type":"object",
                "properties":{
                    "id":{ "type":"string" },
                    "cmd":{
                        "$ref":"/model/cmd"
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