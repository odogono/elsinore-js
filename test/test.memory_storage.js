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
    });

    describe.only('uninitialised storage', function(){
        beforeEach( function(){
            this.storage = MemoryStorage.create();
        });

        it('should not allow creation of an entity before initialisation', function(){
            this.storage.createEntity({})
                .catch(Error, function(e){
                    e.message.should.equal('memory storage is uninitialized');
                });
            // NOTE - doesn't seem to work
            // return this.storage.createEntity({}).should.be.rejectedWith(Error, 'memory storage is ');
        });
    })

    describe('creating an entity', function(){
        beforeEach( function(){
            var self = this;

            // create a memory store with a single entity
            this.storage = MemoryStorage.create();
            return this.storage.initialize();
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
            var self = this, entity = {}, entityId;

            this.storage.createEntity(entity)
                .then( function(entity){
                    entityId = entity.id;
                    return self.storage.destroyEntity( entityId );
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
            this.storage = MemoryStorage.create();
            return this.storage.initialize()
                .then( function(storage){
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