require('./common');
var tv4 = require('tv4').tv4;
var odgn = require('../index')();

describe('Component', function(){
    beforeEach( function(){
        this.cRegistry = odgn.entity.ComponentRegistry.create();
    });

    it.only('should register a new component', function(done){
        var self = this;
        var schema = { "id":"/component/example" }

        // register a component definition
        // the act of registering component means:
        // - it can be instantiated
        // - it can be looked up by its schema id
        // - it will receive a global id that can be used to reference it
        // - it may be persisted in the attached datastore
        this.cRegistry.register(schema, function(err, componentDef){
            // Def can be retrieved by schema id. schema is attached to def. 
            assert.equal( self.cRegistry.getComponentDef('/component/example').schema, componentDef.schema );

            // create a new component instance with default properties
            self.cRegistry.create('/component/example', function(err,component){
                assert( component instanceof self.cRegistry.getComponentDef('/component/example').Component );

                // should have a component id
                assert.equal( component.constructor.componentDef.defId, componentDef.defId );
                done();
            });
        });
    });

    it('should create a component with data', function(done){
        var self = this;
        this.cRegistry.register({
            "id":"/component/data",
            "type":"object",
            "properties":{
                "name":{ "type":"string" },
                "count":{ "type":"integer" }
            }
        }, function(err,cDef){
            self.cRegistry.create("/component/data", {"name":"diamond", "count":23}, function(err,com){
                assert.equal( com.get("name"), "diamond" );
                assert.equal( com.get("count"), 23 );
                done();
            });
        });
    });

    it('should retrieve all components of a type', function(done){
        var self = this;

        async.waterfall([
            function(cb){
                self.cRegistry.register( [{"id":"/component/example_a"}, {"id":"/component/example_b"}], cb );
            },
            // create 10 example_a components
            function(defs, cb){
                var def = self.cRegistry.getComponentDef("/component/example_a");
                async.times(10, function(n,next){
                    def.create(function(err,com){
                        next(err,com);
                    });
                }, cb);
            },
            // create 10 example_b components
            function( comsA, cb ){
                var def = self.cRegistry.getComponentDef("/component/example_b");
                async.times(10, function(n,next){
                    def.create(function(err,com){
                        next(err,com);
                    });
                }, cb );
            }
        // select all component_a components
        ], function(err){
            self.cRegistry.select("/component/example_a", function(err, components){
                assert.equal( components.length, 10 );
                done();
            });
        });
    });
});