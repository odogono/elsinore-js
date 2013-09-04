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


    describe('Destroying', function(){
        it('should destroy an entity', function(done){
            var evtSpy = sinon.spy();
            var storageStub = sinon.stub( this.registry.storage, 'destroyEntity', function(entity,cb){
                return cb(null,entity);
            });

            this.registry.bind('entity:destroy', evtSpy );

            this.registry.destroyEntity( 101, function(err,entity){
                assert.equal( evtSpy.getCall(0).args[0].id, 101 );
                assert( Entity.isEntity(entity) );
                assert.equal( entity.id, 101 );
                assert( storageStub.called );
                assert( evtSpy.called );
                done();
            });
        });
    });
});