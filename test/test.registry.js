var Common = require('./common');
var _ = require('underscore');
var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;
var Component = Elsinore.Component;


describe('Registry', function(){

    describe('creating a registry', function(){

        it('should return a registry instance', function(){
            Registry.create().should.be.instanceof( Registry );
        });

        it('should use memory storage by default', function(){
            var spy = Sinon.spy( Registry.prototype, 'useStorage' );
            Registry.create().initialize().then( function(registry){
                assert(spy.calledWith( MemoryStorage, {} ));
                Registry.prototype.useStorage.restore();
            });
        });

        it('should initialize storage in creation', function(){
            Registry.create().initialize().should.be.fulfilled;
        });
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

    describe('registering components', function(){

        beforeEach(function(){
            return setupRegistry( this, true );
        });

        it('should register a component', function(){
            this.registry.registerComponent( {id:'example'} ).should.eventually.be.an.instanceof( ComponentDef );
        });

        it('should create a constant for the ComponentDef on the registry', function(){
            var self = this;
            var storageMock = Sinon.mock( this.registry.storage );

            storageMock.expects('registerComponentDef').once().returns(
                Promise.resolve( ComponentDef.create( '/component/test', null,null, {id:34} ) )
            );

            return this.registry.registerComponent( {id:'/component/test'} )
                .then( function(cDef){
                    expect( cDef.id ).to.equal( self.registry.ComponentDef.Test );
                    assert( Elsinore.Utils.isInteger(cDef.id) );
                    storageMock.verify();
                });
        });
    });

    describe('retrieving component defs', function(){
        beforeEach( function(){
            var self = this;
            this.registry = Registry.create();
            return this.registry.initialize().then( function(){
                self.componentDef = ComponentDef.create( '/component/get_test', null,null, {id:34} );
                self.registry._addComponentToRegistry( self.componentDef );
            });
        });

        it('should return from an instance', function(){
            expect( this.registry.getComponentDef( this.componentDef ) ).to.deep.equal( this.componentDef );
        });

        it('should return from its integer id', function(){
            expect( this.registry.getComponentDef(34) ).to.deep.equal( this.componentDef );
        });

        it('should return from its string schema-id', function(){
            expect( this.registry.getComponentDef('/component/get_test').id ).to.equal( 34 );
        });

        it('should return from its shortened schema-id', function(){
            expect( this.registry.getComponentDef('get_test').id ).to.equal( 34 );
        });

        it('should return from an object property', function(){
            expect( this.registry.getComponentDef({schema:'get_test'}).id ).to.equal(34);
        });
    });



    describe('creating components', function(){
        beforeEach( function(){
            return setupRegistry( this, true );
        });
        beforeEach( function registerComponentDefs(){
            return this.registry.registerComponent( Common.loadJSONFixture('components.json') );
        });
        // beforeEach( function(){
        //     return this.registry.registerComponent( {id:'/component/test'} );
        // });

        it('should create a component from a def schema id', function(){
            var storageMock = Sinon.mock( this.registry.storage );
            var registryMock = Sinon.mock( this.registry );
            var def = ComponentDef.create('/component/position');
            var eventSpy = Sinon.spy();

            // the operation should trigger an event
            this.registry.on('component:create', eventSpy);

            registryMock.expects('getComponentDef')
                .once().withArgs('/component/position').returns( def );
            
            storageMock.expects('saveComponents')
                .once().returns( Promise.resolve([ Component.create() ]) );

            return this.registry.createComponent({schema:'/component/position', entityId:25},{save:true})
                .then( function(component){
                    registryMock.verify();
                    storageMock.verify();
                    expect( eventSpy.called ).to.be.true; 
                });
        });//*/

        it.only('should add a component to an entity using the component def url', function(){
            var entity = {};
            var registerMock = Sinon.mock( this.registry );
            var storageMock = Sinon.mock( this.registry.storage );
            var def = ComponentDef.create('/component/test');

            registerMock.expects('createComponent').once().returns( Promise.resolve( {} ) );
            // storageMock.expects('addComponent').withArgs( {} ,entity).once().returns( Promise.resolve() );

            return this.registry.addComponent('/component/test', entity)
                .then( function(){
                    registerMock.verify();
                    storageMock.verify();
                });
        });

        // for the time being, registry operations only operate on single instances - multiple
        // instances will come later as an optimisation step
        it('should add an array of component defs to an entity', function(){
            var entity = {};
            var registerMock = Sinon.mock( this.registry );
            var storageMock = Sinon.mock( this.registry.storage );
            
            var def = ComponentDef.create('/component/test');
            registerMock.expects('createComponent').once().returns( Promise.resolve( {} ) );
            storageMock.expects('addComponent').once().returns( Promise.resolve() );

            return this.registry.addComponent(['/component/alpha', '/component/beta', '/component/gamma', '/component/zeta'], entity)
                .then( function(){
                    registerMock.verify();
                    storageMock.verify();
                });
        });


        it('should instantiate with attributes', function(){
            var registryMock = Sinon.mock( this.registry );
            var storageMock = Sinon.mock( this.registry.storage );
            var def = ComponentDef.create('/component/create');

            registryMock.expects('getComponentDef').once().returns( def );
            storageMock.expects('saveComponents').never();

            return this.registry.createComponent( 100, {name:'tiger', age:12}, {save:false} )
                .then( function(component){
                    expect( component.get('name') ).to.equal('tiger');
                    registryMock.verify();
                    storageMock.verify();
                });
        });

        it('should instantiate with attributes', function(){
            var registryMock = Sinon.mock( this.registry );
            var storageMock = Sinon.mock( this.registry.storage );
            var def = ComponentDef.create('/component/create');

            registryMock.expects('getComponentDef').twice().returns( def );
            storageMock.expects('saveComponents').never();

            return this.registry.createComponent( 
                [{ schema:100, name:'tiger', age:12}, { schema:100, name:'lion', age:4} ], null, {save:false} )
                .then( function(components){
                    expect( components[0].isNew() ).to.be.true;
                    expect( components[0].get('name') ).to.equal('tiger');
                    expect( components[1].get('name') ).to.equal('lion');
                    registryMock.verify();
                    storageMock.verify();
                });
        });

        it('should instantiate with a component id', function(){
            var registryMock = Sinon.mock( this.registry );
            var def = ComponentDef.create('/component/comident');

            registryMock.expects('getComponentDef').twice().returns( def );

            return this.registry.createComponent( 
                [{ schema:'comident', id:456, name:'tiger', age:12}, { schema:'comident', id:457, name:'lion', age:4} ], null, {save:false})
                .then( function(components){
                    expect( components[0].isNew() ).to.be.false;
                    expect( components[0].id ).to.equal( 456 );
                    expect( components[1].id ).to.equal( 457 );

                    registryMock.verify();
                });
        });
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
            var mocks = processors.map( function(s){ return Sinon.mock(s); });

            mocks.forEach( function(mock){
                mock.expects('update').once();
            });

            processors.forEach( function(processor){ self.registry.processors.add( processor ); });

            return this.registry.update().then( function(){
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
            var destroyEvent = Sinon.spy();
            var storageStub = Sinon.stub( this.registry.storage, 'destroyEntity', function(entity,cb){
                return cb(null,entity);
            });

            this.registry.bind('entity:destroy', destroyEvent );

            this.registry.destroyEntity( 101, null, function(err,entity){
                assert.equal( destroyEvent.getCall(0).args[0].id, 101 );
                assert( Entity.isEntity(entity) );
                assert.equal( entity.id, 101 );
                Sinon.assert.calledOnce(storageStub);
                Sinon.assert.calledOnce(destroyEvent);
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