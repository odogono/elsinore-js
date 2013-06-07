require('./common');
var odgn = require('../index')();

describe('Component', function(){
    beforeEach( function(done){
        var self = this;
        // passing a callback to create will initialise
        this.registry = odgn.entity.Registry.create({initialise:true}, function(err,registry){
            self.registry = registry;
            done();
        });
    });

    it('should register a new component', function(done){
        var self = this;
        var schema = { "id":"/component/example" }

        // register a component definition
        // the act of registering component means:
        // - it can be instantiated
        // - it can be looked up by its schema id
        // - it will receive a global id that can be used to reference it
        // - it may be persisted in the attached datastore
        this.registry.registerComponent(schema, function(err, componentDef){
            // Def can be retrieved by schema id. schema is attached to def. 
            assert.equal( self.registry.getComponentDef('/component/example').schema, componentDef.schema );

            // create a new component instance with default properties
            self.registry.createComponent('/component/example', function(err,component){
                assert( component instanceof self.registry.getComponentDef('/component/example').Component );

                // should have a component id
                assert.equal( component.constructor.componentDef.defId, componentDef.defId );
                done();
            });
        });
    });

    it('should create an identifiable component', function(done){
        var self = this, componentDefs;
        async.waterfall([
            function(cb){
                self.registry.registerComponent(
                    [{"id":"/component/test/ident_a"},{"id":"/component/test/ident_b"}], 
                    cb);
            },
            function(cDefs,cb){
                componentDefs = cDefs;
                self.registry.createComponent('/component/test/ident_b', cb);
            }
        ], function(err, component){
            assert.equal(component.defId, componentDefs[1].id );
            done();
        });
    });

    it('should create a component with data', function(done){
        var self = this;
        this.registry.registerComponent({
            "id":"/component/data",
            "type":"object",
            "properties":{
                "name":{ "type":"string" },
                "count":{ "type":"integer" }
            }
        }, function(err,cDef){
            self.registry.createComponent("/component/data", {"name":"diamond", "count":23}, function(err,com){
                assert.equal( com.get("name"), "diamond" );
                assert.equal( com.get("count"), 23 );
                done();
            });
        });
    });

    it('should create a component with default data', function(done){
        var self = this;
        var schema = {
            "id":"/component/customer",
            "type":"object",
            "properties":{
                "name":{ "type":"string", "default":"peter" },
                "age":{ "type":"integer", "default":32 }
            }
        };

        async.waterfall([
            // register two components
            function(cb){
                self.registry.registerComponent( schema, cb );
            },
            function(def, cb){
                self.registry.createComponent( def, cb );
            }
        ], function(err,component){
            assert.equal( component.get("name"), "peter" );
            assert.equal( component.get("age"), 32 );
            done();
        });
    });

    it('should retrieve all components of a type', function(done){
        var self = this;

        async.waterfall([
            // register two components
            function(cb){
                self.registry.registerComponent( [{"id":"/component/example_a"}, {"id":"/component/example_b"}], cb );
            },
            // create 10 example_a components
            function(defs, cb){
                var def = self.registry.getComponentDef("/component/example_a");
                async.times(10, function(n,next){
                    self.registry.createComponent( def, function(err,com){
                        next(err,com);
                    });
                }, cb);
            },
            // create 10 example_b components
            function( comsA, cb ){
                var def = self.registry.getComponentDef("/component/example_b");
                async.times(10, function(n,next){
                    self.registry.createComponent( def, function(err,com){
                        next(err,com);
                    });
                }, cb );
            }
        // select all component_a components
        ], function(err){
            if( err ){ throw err };
            self.registry.selectComponents("/component/example_a", function(err, components){
                assert.equal( components.length, 10 );
                done();
            });
        });
    });
});