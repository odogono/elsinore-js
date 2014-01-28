require('./common');

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;

describe('EntityRegistry', function(){

    describe('creating a registry', function(){

        it('create should return a promise', function(){
            assert( Promise.is( Registry.create() ) );
        });

        it('should return a registry instance', function(){
            Registry.create().should.eventually.be.an("object");
        });

        it('should use memory storage by default', function(){
            var spy = sinon.spy( Registry.prototype, 'useStorage' );
            Registry.create().then( function(registry){
                assert(spy.calledWith( MemoryStorage, {} ));
                Registry.prototype.useStorage.restore();
            });
        });
    });

    describe('creating an entity', function(){
        
    });

    /*
    beforeEach( function(done){
        var self = this;
        async.waterfall([
            function createRegistry(cb){
                odgnEntity.Registry.create({initialize:true}, cb);
            },
        ], function(err, pRegistry){
            if( err ) throw err;
            self.registry = pRegistry;
            return done();
        });
    });


    describe('Registering Components', function(){

        it('should reject a non component def instance');

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
            var destroyEvent = sinon.spy();
            var storageStub = sinon.stub( this.registry.storage, 'destroyEntity', function(entity,cb){
                return cb(null,entity);
            });

            this.registry.bind('entity:destroy', destroyEvent );

            this.registry.destroyEntity( 101, null, function(err,entity){
                assert.equal( destroyEvent.getCall(0).args[0].id, 101 );
                assert( Entity.isEntity(entity) );
                assert.equal( entity.id, 101 );
                sinon.assert.calledOnce(storageStub);
                sinon.assert.calledOnce(destroyEvent);
                done();
            });
        });


        it('destroys an entity with a component', function(done){
            var self = this;

            async.waterfall([
                function createEntity(cb){
                    self.registry.createEntityFromTemplate("/entity_template/simple",next);
                },
                function destroyEntity(pEntity, cb){
                    self.registry.destroyEntity( entity, cb );
                }
            ], function(err,results){
                done();
            });
        });
    });//*/
});