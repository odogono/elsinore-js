require('./common');
var tv4 = require('tv4').tv4;
var odgn = require('../index')();

describe('Registry', function(){
    beforeEach( function(){
        this.registry = odgn.entity.ComponentRegistry.create();
    });

    it('should register a new component', function(){
        var schema = {
            "id":"/component/example",
        };

        // register a component definition
        var componentDef = this.registry.register(schema);

        // Def can be retrieved by schema id. schema is attached to def. 
        assert.equal( this.registry.getComponentDef('/component/example').schema, componentDef.schema );

        // create a new component instance with default properties
        var component = this.registry.create('/component/example');

        assert( component instanceof this.registry.getComponentDef('/component/example').Component );

        // print_ins( this.registry.getComponentDef('/component/example'), false, 2 );
        // print_ins( component, false, 2 );
        
        // should have a component id
        assert.equal( component.constructor.componentDef.defId, componentDef.defId );
    });

    it('should create a component with data', function(){
        this.registry.register({
            "id":"/component/data",
            "type":"object",
            "properties":{
                "name":{ "type":"string" },
                "count":{ "type":"integer" }
            }
        });

        var com = this.registry.create("/component/data", {"name":"diamond", "count":23} );
        assert.equal( com.get("name"), "diamond" );
        assert.equal( com.get("count"), 23 );
    });

    it('should retrieve all components of a type', function(){
        var defA = this.registry.register( {"id":"/component/example_a"} );
        var defB = this.registry.register( {"id":"/component/example_b"} );

        for( var i=0;i<10;i++ ){
            defA.create();
            defB.create();
        }

        var components = this.registry.select(defA);

        assert.equal( components.length, 10 );
    });
});