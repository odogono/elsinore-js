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
        
        it('should create an entity with an id', function(){
            var entity = {};

            MemoryStorage.create(null, {initialize:true})
            .then( function(storage){
                return storage.createEntity(entity);
            }).then( function(entity){
                entity.should.be.an('object');
                expect( entity.id ).to.equal( 1 );
            });
        });

        it('should retrieve an entity', function(){
            var entity = {}, storage, entityId;

            var registryMock = { toEntity:function(e){
                return {id:e};
            }};

            MemoryStorage.create(null, {initialize:true})
            .then( function(store){
                storage = store;
                storage.registry = registryMock;
                return storage.createEntity(entity);
            }).then( function(entity){
                entityId = entity.id;
                return storage.retrieveEntity( entityId );
            }).then( function(entity){
                entity.should.be.an('object');
                expect( entity.id ).to.equal( entityId );
            });
        });
    });
});