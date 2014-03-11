require('./common');

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;

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

    describe('uninitialised storage', function(){
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
                    (++counter).should.equal(1);
                });
            counter.should.equal(0);
        });

        it('should create an entity with an id', function(){
            var entity = {};
            this.storage.createEntity(entity)
                .then( function(entity){
                    entity.should.be.an('object');
                    expect( entity.id ).to.equal( 1 );
                });
        });

        it('should create from an array of entities', function(){
            var entities = [{},{},{}];
            this.storage.createEntity( entities )
                .then( function(result){
                    result.should.be.an('array');
                    expect( result[0].id ).to.equal(1);
                    expect( result[1].id ).to.equal(2);
                    expect( result[2].id ).to.equal(3);
                })
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

            var toEntity = sinon.stub(MemoryStorage.prototype, 'toEntity');
            toEntity.returns(entity);

            this.storage.createEntity(entity)
                .then( function(entity){
                    entityId = entity.id;
                    return self.storage.destroyEntity( entity, true );
                })
                .then( function(){
                    self.storage.hasEntity( entityId, true ).should.eventually.equal(false);
                    toEntity.restore();
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

    describe('registering components', function(){
        beforeEach( function(){
            this.storage = MemoryStorage.create();
            return this.storage.initialize();
        });
        
        it('should assign an id to a component def', function(){
            var def = new Backbone.Model({schema:{id:'test'}});
            this.storage.registerComponent( def ).should.be.fulfilled;
        });

        it('should assign an id to a component def', function(){
            var def = new Backbone.Model({schema:{id:'test'}});
            this.storage.registerComponent( def )
                .then(function(def){
                    expect(def.id).to.equal(1);
                });
        });
    });

    describe('creating components', function(){
        beforeEach( function(){
            this.storage = MemoryStorage.create();
            // this.storage.on('all', function(evt){
            //     log.debug('storage evt ' + evt );
            //     print_ins( arguments );
            // })
            return this.storage.initialize();
        });

        it('should save a component', function(){
            var component = new Backbone.Model();
            expect(component.isNew()).to.be.true;
            this.storage.saveComponent( component ).then( function(component){
                expect(component.isNew()).to.be.false;
                expect(component.id).to.equal(1);
            });
        });

        it('should save an array of components', function(){
            var idCount = 1;
            var components = [ new Backbone.Model(), new Backbone.Model(), new Backbone.Model() ];
            this.storage.saveComponent( components ).then(function(components){
                components.forEach(function(component){
                    expect(component.isNew()).to.be.false;
                    expect(component.id).to.equal( idCount++ );
                });
            });
        });
    });


    describe('adding components to entities', function(){
        beforeEach( function(){
            this.storage = MemoryStorage.create();
            // this.storage.on('all', function(evt){
            //     log.debug('storage evt ' + evt );
            //     print_ins( arguments );
            // })
            return this.storage.initialize();
        });


        it('should add a component to an entity', function(){
            var entity = Entity.create(29);
            
            var component = new Backbone.Model();
            component.defId = 4;

            var componentDef = {
                defId: 4,
                get: function(){}
            };
            var componentDefMock = sinon.mock(componentDef);
            componentDefMock.expects('get').once().withArgs('name').returns('MyComponent');

            this.storage.registry = {
                getComponentDef:sinon.stub().returns( componentDef )
            };

            var eventSpy = sinon.spy();
            // the operation should trigger an event
            this.storage.on('component:add', eventSpy);

            this.storage.addComponent( [ component ], entity )
                .then( function(entity){
                    // component should have an entity id
                    component.get('entityId').should.equal(entity.id);

                    // the add event should have been called once
                    expect(eventSpy.calledWith(component,entity)).to.be.ok;

                    componentDefMock.verify();

                    entity.MyComponent.should.equal( component );
                });
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