require('./common');
var odgn = require('../index')();

describe('EntityRegistry', function(){

    beforeEach( function(done){
        var self = this;
        async.waterfall([
            function createRegistry(cb){
                odgn.entity.Registry.create({initialize:true}, cb);
            },
        ], function(err, pRegistry){
            if( err ) throw err;
            self.registry = pRegistry;
            return done();
        });
    });

    describe('Registering Components', function(){
        it('should return a component def from a schema id', function(){
            var componentDef = this.registry.registerComponent({"id":"/component/tr/a"} );
            var result = this.registry.getComponentDef('/component/tr/a');
            assert.equal( result.id, componentDef.id );
        });

        it('should register multiple components at once', function(){
            var componentDefs = this.registry.registerComponent([{"id":"/component/tr/a"},{"id":"/component/tr/b"}] );
            assert( _.isArray(componentDefs) );
            assert( this.registry.getComponentDef('/component/tr/a').id, componentDefs[0].id );
            assert( this.registry.getComponentDef('/component/tr/b').id, componentDefs[1].id );
        });

        it('should return a component def from a schema id', function(){
            
        });
    });
});