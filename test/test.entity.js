require('./common');
var tv4 = require('tv4').tv4;

describe('Entity', function(){

    beforeEach( function(){
        // unload and reload the odgn module
        delete require.cache[ require.resolve('../index') ];
        odgn = require('../index')();
        this.registry = odgn.Entity.Registry.create();
    });

    describe('registration', function(){

        it.only('should normalise', function(){
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
        });

        it('should register a new entity',function(){
            
            var ActorEntityDef = this.registry.register({
                id: "/entity/actor",
                type:"object"
            });

            var inst = ActorEntityDef.create();
            assert( inst instanceof odgn.Entity.ActorEntityDef.model );
        });

        it('should create an entity instance from a schema id', function(){
            this.registry.register({
                id: "/entity/actor",
                type:"object"
            });

            var oinst = this.registry.create("/entity/actor");
            assert( oinst instanceof odgn.Entity.ActorEntityDef.model );
        });

        it('should retrieve an entity definition', function(){
            this.registry.register({ "id":"/entity/person", "type":"object" });
            assert.equal( odgn.Entity.PersonEntityDef, this.registry.get("/entity/person") );
        });

        it.skip('should register multiple entities', function(){
            this.registry.register({
                "id":"/root",
                "cmdqueue":{
                    "id":"/cmdqueue",
                    "type":"object"
                },
                "cmd":{
                    "id":"/cmd",
                    "type":"object"
                }
            });
            print_var( this.registry.tv4.context );
            print_var( this.registry.tv4.getSchema('/root/cmd') );
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

    });


    describe('one to one', function(){

        it('should o2o', function(){

            this.registry.register({
                id: "/entity/actor",
                type:"object",
                properties:{
                    name: { type:"string" },
                    home: {
                        type: "object",
                        properties:{
                            address:{ type:"string" }
                        }
                    }
                }
            });

            var def = this.registry.get("/entity/actor");

            var inst = def.parse({
                name: 'eric',
                home:{
                    address: '59 Long Lane'
                }
            });

            // assert( oinst instanceof odgn.Entity.ActorEntityDef.model );

            // assert( odgn.Entity.HomeEntityDef );

            // print_ins( tv4.context );
            // print_ins( tv4.getSchema('/entity/actor#/properties/home') );
        });



    });
});