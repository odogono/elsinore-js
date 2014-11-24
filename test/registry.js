var _ = require('underscore');
var test = require('tape');


var Common = require('./common');
var Es = require('event-stream');
var Sinon = require('sinon');

var Elsinore = require('../lib');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var ComponentDef = Elsinore.ComponentDef;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;
var JSONComponentParser = require('../lib/streams').JSONComponentParser;

var componentData = _.reduce( require('./fixtures/components.json'), 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});

var entitySet, entities, registry, storage, ComponentDefs;


// test('registering a component def', function(t){
//     var registry = Registry.create();
//     // Common.logEvents( registry.schemaRegistry );

//     var def = registry.registerComponent({id:'example'});

//     t.ok( ComponentDef.isComponentDef( def ), 
//         'registering a component returns a ComponentDef instance' );

//     t.end();
// });


// test('registering a component def attaches the def to the registry', function(t){
//     var registry = Registry.create();

//     var def = registry.registerComponent({id:'example'});

//     t.equal( registry.getComponentDef('example'), def,
//         'retrieving the def with its id returns a ComponentDef instance' );

//     t.equal( registry.ComponentDef.Example, def.id,
//         'the registry adds the ComponentDef id to itself' );
//     t.end();
// });



// test('retrieving component defs', function(t){
//     var registry = Registry.create();
//     var componentDef = ComponentDef.create('/component/get_test');
//     componentDef.set('id', 34);

//     registry.registerComponent( componentDef );
    
//     test('return from an instance', function(t){
        
//         t.deepEqual(
//             registry.getComponentDef( componentDef ),
//             componentDef, 'retrieve from an instance' );
//         t.end();
//     });

//     test('from a non-registered instance', function(t){
//         t.equal(
//             registry.getComponentDef( ComponentDef.create('/component/unknown') ),
//             null, 'not retrieve from an unregistered instance' );
//         t.end();
//     });

//     test('return from its integer id', function(t){
//         t.deepEqual( 
//             registry.getComponentDef(34),
//             componentDef, 'retrieve from integer id' );
//         t.end();
//     });

//     test('return from its string schema id', function(t){
//         t.deepEqual( 
//             registry.getComponentDef('/component/get_test'),
//             componentDef, 'retrieve from schema id' );
//         t.end();
//     });

//     test('return from its shortened schema id', function(t){
//         t.deepEqual( 
//             registry.getComponentDef('get_test'),
//             componentDef, 'retrieve from shortened schema id' );
//         t.end();
//     });

//     test('return from an object property', function(t){
//         t.deepEqual( 
//             registry.getComponentDef({schema:'get_test'}),
//             componentDef, 'retrieve from object property' );
//         t.end();
//     });


//     test.skip('return from its hash', function(t){
//         t.deepEqual(
//             registry.getComponentDef( componentDef.getHash() ),
//             componentDef, 'retrieve from hash' );

//         t.end();
//     });

//     t.end();
// });

// test.only('creating components', function(t){

    test('create from a schema', function(t){
        var registry = Registry.create();
        // Common.logEvents( registry );
        // Common.logEvents( registry.schemaRegistry );

        // passing a schema as the first argument will cause the component to be
        // registered at the same time
        var component = registry.createComponent( componentData['/component/position'], { x:200 } );

        // printIns( component );
        t.equals( component.schemaId, '/component/position' );
        t.equals( component.hash, '6f39b39f' );
        t.equals( component.get('x'), 200 );

        t.end();
    });

    test('create from a schema hash', function(t){
        var registry = Registry.create();
        var def = registry.registerComponent( componentData['/component/score'] );
        var component = registry.createComponent( 'd3f0bf51', {score:200} );
        
        t.equals( component.get('score'), 200 );
        t.equals( component.get('lives'), 3 );

        t.end();
    });

    test('create from a pre-registered schema', function(t){
        var registry = Registry.create();

        registry.registerComponent( componentData['/component/nickname'] );

        var component = registry.createComponent( '/component/nickname', {nick:'peter'} );

        t.equals( component.get('nick'), 'peter' );

        t.end();
    });

    test('create from a pre-registered schema using data object', function(t){
        var registry = Registry.create();

        registry.registerComponent( componentData['/component/nickname'] );

        var component = registry.createComponent( {_s:'/component/nickname', nick:'susan'} );

        t.equals( component.get('nick'), 'susan' );

        t.end();
    });

    test('create from an array of data', function(t){
        var registry = Registry.create();

        registry.registerComponent( componentData['/component/position'] );

        var components = registry.createComponent( '/component/position', [ {x:0,y:-1}, {x:10,y:0}, {x:15,y:-2} ] );

        t.equals( components.length, 3 );
        t.equals( components[1].get('x'), 10 );

        t.end();
    });

//     t.end();
// });


test('create entity', function(t){
    t.end();
});


// describe('Registry', function(){


//     describe('creating components', function(){
//         beforeEach( function(){
//             return setupRegistry( this, true );
//         });
//         beforeEach( function registerComponentDefs(){
//             return this.registry.registerComponent( Common.loadJSONFixture('components.json') );
//         });
//         // beforeEach( function(){
//         //     return this.registry.registerComponent( {id:'/component/test'} );
//         // });

//         it('should create a component from a def schema id', function(){
//             var storageMock = Sinon.mock( this.registry.storage );
//             var registryMock = Sinon.mock( this.registry );
//             var def = ComponentDef.create('/component/position');
//             var eventSpy = Sinon.spy();

//             // the operation should trigger an event
//             this.registry.on('component:create', eventSpy);

//             registryMock.expects('getComponentDef')
//                 .once().withArgs('/component/position').returns( def );
            
//             storageMock.expects('saveComponents')
//                 .once().returns( Promise.resolve([ Component.create() ]) );

//             return this.registry.createComponent({schema:'/component/position', entityId:25},{save:true})
//                 .then( function(component){
//                     registryMock.verify();
//                     storageMock.verify();
//                     expect( eventSpy.called ).to.be.true; 
//                 });
//         });

//         it('should add a component to an entity using the component def url', function(){
//             var entity = {};
//             var def = this.registry.getComponentDef('/component/position'); 
//             return this.registry.addComponent('/component/position', entity)
//                 .then( function(entity){
//                     assert( entity.hasComponent(def) );
//                 });
//         });

//         // for the time being, registry operations only operate on single instances - multiple
//         // instances will come later as an optimisation step
//         it('should add an array of component defs to an entity', function(){
//             var entity = {};
//             var coms = ['/component/geo_location', '/component/channel_member', '/component/realname', '/component/score'];
//             var componentsBf = this.registry.getComponentDefBitfield(coms);
//             var altBf = this.registry.getComponentDefBitfield(['/component/position','/component/tag']);
//             // var registerMock = Sinon.mock( this.registry );
//             // var storageMock = Sinon.mock( this.registry.storage );
            
//             // var def = ComponentDef.create('/component/test');
//             // registerMock.expects('createComponent').once().returns( Promise.resolve( {} ) );
//             // storageMock.expects('addComponent').once().returns( Promise.resolve() );

//             return this.registry.addComponent(coms, entity)
//                 .then( function(entity){
//                     assert( entity.hasComponent(componentsBf) );
//                     assert( !entity.hasComponent(altBf) );
//                     // registerMock.verify();
//                     // storageMock.verify();
//                 });
//         });


//         it('should instantiate with attributes', function(){
//             var component = this.registry.createComponent( {_s:'/component/animal', name:'tiger', age:12}, {save:false} );
//             expect( component.get('name') ).to.equal('tiger');
//         });

//         it('should instantiate with attributes again', function(){
//             // var registryMock = Sinon.mock( this.registry );
//             // var storageMock = Sinon.mock( this.registry.storage );
//             // var def = ComponentDef.create('/component/create');

//             // registryMock.expects('getComponentDef').twice().returns( def );
//             // storageMock.expects('saveComponents').never();

//             var components = this.registry.createComponent([ 
//                 {_s:'/component/animal', name:'tiger', age:12},
//                 {_s:'/component/animal', name:'lion', age:4},
//             ], {save:false});

//             // return this.registry.createComponent( 
//                 // [{ schema:100, name:'tiger', age:12}, { schema:100, name:'lion', age:4} ], null, {save:false} )
//                 // .then( function(components){
//             expect( components[0].isNew() ).to.be.true;
//             expect( components[0].get('name') ).to.equal('tiger');
//             expect( components[1].get('name') ).to.equal('lion');
//                     // registryMock.verify();
//                     // storageMock.verify();
//                 // });
//         });

//         it('should instantiate with a component id', function(){

//             var component = this.registry.createComponent( {_s:'/component/animal', id:456, name:'tiger', age:12}, {save:false} );
//             expect( component.isNew() ).to.be.false;
//             expect( component.id ).to.equal( 456 );

//             // var registryMock = Sinon.mock( this.registry );
//             // var def = ComponentDef.create('/component/comident');

//             // registryMock.expects('getComponentDef').twice().returns( def );

//             // return this.registry.createComponent( 
//             //     [{ schema:'comident', id:456, name:'tiger', age:12}, { schema:'comident', id:457, name:'lion', age:4} ], null, {save:false})
//             //     .then( function(components){
//             //         expect( components[0].isNew() ).to.be.false;
//             //         expect( components[0].id ).to.equal( 456 );
//             //         expect( components[1].id ).to.equal( 457 );

//             //         registryMock.verify();
//             //     });
//         });
//     });

    

//     describe('processors', function(){
//         beforeEach(function(){
//             self = this;
//             return Registry.create().initialize().then( function(registry){
//                 return self.registry = registry;
//             });
//         });

//         it('should call update on a processor when updating', function(){
//             var self = this;
//             var Processor = Backbone.Model.extend({
//                 update: function(dt, updatedAt, now, options){
//                     return Promise.resolve(true);
//                 }
//             });
//             var processors = [ new Processor(), new Processor() ];
//             var mocks = processors.map( function(s){ return Sinon.mock(s); });

//             mocks.forEach( function(mock){
//                 mock.expects('update').once();
//             });

//             processors.forEach( function(processor){ self.registry.processors.add( processor ); });

//             return this.registry.update().then( function(){
//                 mocks.forEach( function(mock){
//                     mock.verify();
//                 });
//             });
//         });
//     });


//     /*
//     beforeEach( function(done){
//         var self = this;
//         async.waterfall([
//             function createRegistry(cb){
//                 odgnEntity.Registry.create({initialize:true}, cb);
//             },
//         ], function(err, pRegistry){
//             if( err ) throw err;
//             self.registry = pRegistry;
//             return done();
//         });
//     });


//     describe('Registering Components', function(){

//         it('should reject a non component def instance');

//         it('should return a component def from a schema id', function(){
//             var componentDef = this.registry.registerComponent({"id":"/component/tr/a"} );
//             var result = this.registry.getComponentDef('/component/tr/a');
//             assert.equal( result.id, componentDef.id );
//         });

//         it('should register multiple components at once', function(){
//             var componentDefs = this.registry.registerComponent([{"id":"/component/tr/a"},{"id":"/component/tr/b"}] );
//             assert( _.isArray(componentDefs) );
//             assert( this.registry.getComponentDef('/component/tr/a').id, componentDefs[0].id );
//             assert( this.registry.getComponentDef('/component/tr/b').id, componentDefs[1].id );
//         });

//         it('should return a component def from a schema id', function(){
            
//         });
//     });


//     describe('Destroying', function(){
//         it('should destroy an entity', function(done){
//             var destroyEvent = Sinon.spy();
//             var storageStub = Sinon.stub( this.registry.storage, 'destroyEntity', function(entity,cb){
//                 return cb(null,entity);
//             });

//             this.registry.bind('entity:destroy', destroyEvent );

//             this.registry.destroyEntity( 101, null, function(err,entity){
//                 assert.equal( destroyEvent.getCall(0).args[0].id, 101 );
//                 assert( Entity.isEntity(entity) );
//                 assert.equal( entity.id, 101 );
//                 Sinon.assert.calledOnce(storageStub);
//                 Sinon.assert.calledOnce(destroyEvent);
//                 done();
//             });
//         });


//         it('destroys an entity with a component', function(done){
//             var self = this;

//             async.waterfall([
//                 function createEntity(cb){
//                     self.registry.createEntityFromTemplate("/entity_template/simple",next);
//                 },
//                 function destroyEntity(pEntity, cb){
//                     self.registry.destroyEntity( entity, cb );
//                 }
//             ], function(err,results){
//                 done();
//             });
//         });
//     });//*/
// });

// function setupRegistry( self, doInitialize ){
//     var registry = self.registry = Registry.create();
//     if( doInitialize ){
//         return registry.initialize();
//     }
//     return Promise.resolve( registry );
// }