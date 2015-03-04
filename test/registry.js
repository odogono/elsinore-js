var _ = require('underscore');
var test = require('tape');


var Common = require('./common');
// var Es = require('event-stream');
var Sinon = require('sinon');

var Elsinore = require('../lib');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var ComponentDef = Elsinore.ComponentDef;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;

// compile a map of schema id(uri) to schema
var componentSchemas = require('./fixtures/components.json');
var componentByUri = _.reduce( componentSchemas, 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});

test('creating components', function(t){

    test('create from a schema', function(t){
        var registry = Registry.create();
        // Common.logEvents( registry );
        // passing a schema as the first argument will cause the component to be
        // registered at the same time
        var component = registry.createComponent( componentByUri['/component/position'], { x:200 } );

        t.equals( component.schemaUri, '/component/position' );
        t.equals( component.schemaHash, '9db8f95b' );
        t.equals( component.get('x'), 200 );

        t.end();
    });

    test('create from a schema hash', function(t){
        var registry = Registry.create();
        var def = registry.registerComponent( componentByUri['/component/score'] );
        var component = registry.createComponent( 'd3f0bf51', {score:200} );
        
        t.equals( component.get('score'), 200 );
        t.equals( component.get('lives'), 3 );

        t.end();
    });

    test('create from a pre-registered schema', function(t){
        var registry = Registry.create();

        registry.registerComponent( componentByUri['/component/nickname'] );

        var component = registry.createComponent( '/component/nickname', {nick:'peter'} );

        t.equals( component.get('nick'), 'peter' );

        t.end();
    });

    test('create from a pre-registered schema using data object', function(t){
        var registry = Registry.create();

        registry.registerComponent( componentByUri['/component/nickname'] );

        var component = registry.createComponent( {id:'/component/nickname', nick:'susan'} );

        t.equals( component.get('nick'), 'susan' );

        t.end();
    });

    test('create from an array of data', function(t){
        var registry = Registry.create();

        registry.registerComponent( componentByUri['/component/position'] );

        var components = registry.createComponent( '/component/position', [ {x:0,y:-1}, {x:10,y:0}, {x:15,y:-2} ] );

        t.equals( components.length, 3 );
        t.equals( components[1].get('x'), 10 );

        t.end();
    });

    t.end();
});





test( 'creating entity filters', function(t){

    test('create an entity filter', function(t){
        var registry = Registry.create();
        registry.registerComponent( componentSchemas );

        EntityFilter.create = function( entityFilter ){
            t.deepEqual( entityFilter, [EntityFilter.ALL,registry.getIId('/component/position')] );
        }

        registry.createEntityFilter( EntityFilter.ALL, '/component/position' );

        t.end();
    });

    test('create an entity filter with an array', function(t){
        var registry = Registry.create();
        registry.registerComponent( componentSchemas );

        EntityFilter.create = function( entityFilter ){
            t.deepEqual( entityFilter, 
                [EntityFilter.EXCLUDE, registry.getIId('/component/score'), registry.getIId('/component/nickname') ] );
        }
        // printIns( registry );
        registry.createEntityFilter( [EntityFilter.EXCLUDE, '/component/score', '/component/nickname'] );

        t.end();
    });

    test('create an entity filter with multiple arrays', function(t){
        var registry = Registry.create();
        registry.registerComponent( componentSchemas );

        EntityFilter.create = function( entityFilterA, entityFilterB ){
            t.deepEqual( entityFilterA, 
                [EntityFilter.ALL, registry.getIId('/component/realname') ] );
            t.deepEqual( entityFilterB, 
                [EntityFilter.NONE, registry.getIId('/component/position') ] );
        };

        registry.createEntityFilter( [EntityFilter.ALL, '/component/realname'], [EntityFilter.NONE, '/component/position'] );

        t.end();
    });

    test('create an entity filter with an array of arrays', function(t){
        var registry = Registry.create();
        registry.registerComponent( componentSchemas );

        EntityFilter.create = function( entityFilterA, entityFilterB ){
            t.deepEqual( entityFilterA, 
                [EntityFilter.SOME, registry.getIId('/component/realname') ] );
            t.deepEqual( entityFilterB, 
                [EntityFilter.ANY, registry.getIId('/component/position') ] );
        };
        
        registry.createEntityFilter( [[EntityFilter.SOME, '/component/realname'], [EntityFilter.ANY, '/component/position']] );

        t.end();
    });

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