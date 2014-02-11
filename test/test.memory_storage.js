require('./common');

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;

describe('MemoryStorage', function(){
    
    describe('creation', function(){

        it('should initialize', function(){
            var storage = MemoryStorage.create();
            assert( Promise.is( storage.initialize() ) );
        });

        it('should resolve to an instance', function(){
            var storage = MemoryStorage.create();
            storage.initialize().then(function(st){
                assert.equal( storage, st );
            });
        });

        it('should initialize from options', function(){
            var registry = {};
            var initializeSpy = sinon.spy( MemoryStorage.prototype, 'initialize' );
            var storage = MemoryStorage.create(registry, {initialize:true} );
            assert( Promise.is( storage ) );
            storage.then( function(st){
                assert( initializeSpy.calledOnce );
                st.registry.should.equal( registry );
                initializeSpy.restore();
            });
        });
    });

    describe('creating an entity', function(){
        beforeEach( function(){
            var self = this;

            // create a memory store with a single entity
            return MemoryStorage.create( null, {initialize:true} )
                .then( function(storage){
                    self.storage = storage;
                });
            
        });

        afterEach( function(){
        });

        it('should create an entity asynchronously', function(){
            var counter = 0;
            this.storage.createEntity({})
                .then( function(entity){
                    counter.should.equal(1);
                });
            (counter++).should.equal(0);
        });

        it('should create an entity with an id', function(){
            var entity = {};
            this.storage.createEntity(entity)
                .then( function(entity){
                    entity.should.be.an('object');
                    expect( entity.id ).to.equal( 1 );
                });
        });

        it('should retrieve an entity', function(){
            var self = this, entity = {}, entityId;

            var toEntityStub = sinon.stub().returns( {id:1} );
            this.storage.registry = {toEntity:toEntityStub};

            this.storage.createEntity(entity)
                .then( function(entity){
                    entityId = entity.id;
                    return self.storage.retrieveEntity( entityId );
                }).then( function(entity){
                    entity.should.be.an('object');
                    expect( entity.id ).to.equal( entityId );
                });
        });

        it('should destroy an entity', function(){
            var entity = {}, storage, entityId;
            MemoryStorage.create(null, {initialize:true})
            .then( function(store){
                storage = store;
                return storage.createEntity(entity);
            }).then( function(entity){
                entityId = entity.id;
                return storage.destroyEntity( entityId );
            });
        });

    });

    describe('retrieving entity', function(){
        before( function(){
            var self = this;
            var toEntity = sinon.stub(MemoryStorage.prototype, 'toEntity');
            toEntity.withArgs(1).returns( {id:1} );
            toEntity.withArgs(2).returns( {id:2} );

            // create a memory store with a single entity
            return MemoryStorage.create( null, {initialize:true} )
                .then( function(storage){
                    self.storage = storage;
                    return storage.createEntity({id:1});
                });
        });

        after( function(){
            MemoryStorage.prototype.toEntity.restore();
        });

        it('should determine whether an entity exists', function(){
            return this.storage.hasEntity( 1 ).should.eventually.equal(true);
        });

        it('should report a missing entity', function(){
            return this.storage.hasEntity( 2 ).should.eventually.equal(false);
        });

        it('should retrieve an entity', function(){
            return this.storage.retrieveEntity( 1 ).should.eventually.be.an('object');
        });

        it('should not retrieve an unknown entity', function(){
            return this.storage.retrieveEntity( 2 ).should.be.rejectedWith(Error);
        });
    });
});

/**
*   Returns a promise of a MemoryStorage
*/  
function createStorage(){
    var registryMock = { toEntity:function(e){
        return {id:e};
    }};
    return MemoryStorage.create( registryMock, {initialize:true} );
}