require('./common');
var _ = require('underscore');

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;



describe('Registry', function(){

    describe('creating a registry', function(){

        it('should return a registry instance', function(){
            Registry.create().should.be.instanceof( Registry );
        });

        it('should use memory storage by default', function(){
            var spy = sinon.spy( Registry.prototype, 'useStorage' );
            Registry.create().initialize().then( function(registry){
                assert(spy.calledWith( MemoryStorage, {} ));
                Registry.prototype.useStorage.restore();
            });
        });

        it('should initialize storage in creation', function(){
            Registry.create().initialize().should.be.fulfilled;
        })

    });

    describe('initializing a registry', function(){
        beforeEach(function(){
            var self = this;
            return Registry.create().initialize()
                .then( function(registry){
                    return self.registry = registry;
                });
        });

        it('should initialize', function(){
            this.registry.initialize().should.eventually.equal( this.registry );
        });
    });

    describe('creating an entity', function(){
        beforeEach( function(){
            this.registry = Registry.create();
            return this.registry.initialize();
        });

        it('should return an entity instance', function(){
            this.registry.createEntity().should.eventually.be.an.instanceof( Entity );
        });

        it('should accept an id', function(){
            this.registry.createEntity({id:980})
                .should.eventually.have.property('id', 980);
        });
    });

    describe('registering components', function(){

        beforeEach(function(){
            this.registry = Registry.create();
            this.storageObj = {
                registerComponent: function(){}
            };
            return this.registry.initialize();
        });

        it('should register a component', function(){
            this.registry.registerComponent( {id:'example'} ).should.eventually.be.an.instanceof( ComponentDef );
        });

        it('should create a constant for the ComponentDef on the registry', function(){
            var self = this, 
                storageMock = sinon.mock( this.registry.storage );
            
            storageMock.expects('registerComponent').once().returns(
                Promise.resolve( new Backbone.Model({id:34, schema:'test', name:'Test'}) )
            );

            this.registry.registerComponent( {id:'test'} )
                .then( function(cDef){
                    expect( cDef.id ).to.equal( self.registry.ComponentDef.Test );
                    storageMock.verify();
                });
        });

        // it('should set the component def id on the component', function(){
        //     var self = this, 
        //         storageMock = sinon.mock( this.registry.storage );
        //     storageMock.expects('registerComponent').once().returns(
        //         Promise.resolve({id:10, schema:'test'})
        //     );

        //     this.registry.registerComponent( {id:'test'} )
        //         .then( function(cDef){

        //         });
        // });
    });

    describe('importing component definitions', function(){
        beforeEach(function(){
            this.registry = Registry.create();
        });

        it('should register each component', function(){
            var data = [
                { id:'/component/alpha' },
                { id:'/component/beta' }
            ];
            // var register = { registerComponent: function(data,options){} };
            var registerMock = sinon.mock( this.registry );

            registerMock.expects('registerComponent').twice();
            registerMock.expects('begin').once().returns( Promise.resolve() );
            registerMock.expects('end').once().returns( Promise.resolve() );

            this.registry.importComponents( data ).then( function(){
                registerMock.verify();
            });
        });

        it('should unregister all existing components if the option is set');
        it('should remove unreferenced components if the option is set');
    });


    describe('creating components', function(){
        beforeEach( function(){
            return setupRegistry( this, true );
        });

        it('should set the component def id on the component', function(){
            var registryMock = sinon.mock( this.registry );
            var storageMock = sinon.mock( this.registry.storage );
            var eventSpy = sinon.spy();

            // the operation should trigger an event
            this.registry.on('component:create', eventSpy);

            registryMock.expects('getComponentDef')
                .once().withArgs('/component/idtest');

            storageMock.expects('saveComponent').once().returns( Promise.resolve(['comA','comB']) );

            this.registry.createComponent('/component/idtest')
                .then( function(){
                    registryMock.verify();
                    storageMock.verify();
                    expect(eventSpy.calledWith(['comA','comB'])).to.be.ok;
                });
        });

        it.only('should add a component to an entity using the component def url', function(){
            var entity = {};
            var registerMock = sinon.mock( this.registry );
            var storageMock = sinon.mock( this.registry.storage );
            var def = ComponentDef.create('/component/test');

            registerMock.expects('getComponentDef').once().returns( def );
            registerMock.expects('createComponent').once().returns( Promise.resolve( {} ) );
            
            storageMock.expects('addComponent').withArgs( {} ,entity).once().returns( Promise.resolve() );

            this.registry.addComponent('/component/test', entity)
                .then( function(){
                    registerMock.verify();
                    storageMock.verify();
                });
        });

        // for the time being, registry operations only operate on single instances - multiple
        // instances will come later as an optimisation step
        it('should add an array of component defs to an entity', function(){
            var entity = {};
            var registerMock = sinon.mock( this.registry );
            var storageMock = sinon.mock( this.registry.storage );
            
            var def = ComponentDef.create('/component/test');
            registerMock.expects('getComponentDef').once().returns( [def,def,def] );
            registerMock.expects('createComponent').once().returns( Promise.resolve( {} ) );
            storageMock.expects('addComponent').once().returns( Promise.resolve() );

            this.registry.addComponent(['/component/alpha', '/component/beta', '/component/gamma', '/component/zeta'], entity)
                .then( function(){
                    registerMock.verify();
                    storageMock.verify();
                });
        })
    });

    describe('processors', function(){
        beforeEach(function(){
            self = this;
            return Registry.create().initialize().then( function(registry){
                return self.registry = registry;
            });
        });

        it('should call update on a processor when updating', function(){
            var self = this;
            var Processor = Backbone.Model.extend({
                update: function(dt, updatedAt, now, options){
                    return Promise.resolve(true);
                }
            });
            var processors = [ new Processor(), new Processor() ];
            var mocks = processors.map( function(s){ return sinon.mock(s); });

            mocks.forEach( function(mock){
                mock.expects('update').once();
            });

            processors.forEach( function(processor){ self.registry.processors.add( processor ); });

            this.registry.update().then( function(){
                mocks.forEach( function(mock){
                    mock.verify();
                });
            });
        });
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

function setupRegistry( self, doInitialize ){
    var registry = self.registry = Registry.create();
    if( doInitialize ){
        return registry.initialize();
    }
    return Promise.resolve( registry );
}