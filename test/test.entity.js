require('./common');
require('../index');


var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;

var PositionComponent = {
    id: 'position',
    properties:{
        x: { type:'number' },
        y: { type:'number' }
    }
};

var ScoreComponent = {
    id: 'score',
    properties: {
        score: { type:'integer' },
        lives: { type:'integer', 'default': 3 }
    }
}


describe('Entity', function(){

    describe('create an entity with components', function(){

        beforeEach( function(){
            var self = this;
            return Registry.create().initialize()
                .then( function(registry){
                    self.registry = registry;
                    return registry.registerComponent( [ PositionComponent, ScoreComponent ] );
                });
        });

        it('should emit events for the new position component', function(){
            var self = this;
            var eventSpy = sinon.spy();
            this.registry.on('component:create', eventSpy);
            var PositionComDef = this.registry.ComponentDef.Position;
            return this.registry.createEntity( 'position' )
                .then( function(entity){
                    eventSpy.getCall(0).args[0].ComponentDef.id.should.equal( PositionComDef );
                });
        });

        it('should have properties for each component', function(){
            return this.registry.createEntity( ['position', 'score'] )
                .then( function(entity){
                    // log.debug('created entity ' + entity.id);
                    expect( entity.Position ).to.not.be.undefined;
                    expect( entity.Score ).to.not.be.undefined;
                });
        });

        it('should have a lives default of 3', function(){
            return this.registry.createEntity( ['position', 'score'] )
                .then( function(entity){
                    expect( entity.Score.get('lives') ).to.equal(3);
                });
        });

    });
});



describe.skip('Entity.old', function(){
    beforeEach( function(done){
        var self = this;
        // passing a callback to create will initialise
        this.registry = odgnEntity.Registry.create({initialize:true}, function(err,registry){
            self.registry = registry;
            // self.registry.on('component:register', function(componentDef){
            //     log.debug('registry registered component: ' + componentDef.schema.id + '(' + componentDef.id + ')');
            // });
            var components = JSON.parse( fs.readFileSync( Common.pathFixture('components.json') ) );
            self.registry.registerComponent( components, null, function(){
                done();
            });
        });
    });

    describe('Entity', function(){
        it('should create a new entity with an id', function(done){
            var self = this;
            self.registry.createEntity(function(err,entity){
                assert( entity.id );
                done();
            });
        });


        it('should retrieve an existing entity', function(done){
            var self = this, registry = self.registry, eid;
            
            registry.createEntity( function(err, entity){
                registry.hasEntity( entity.id, function(err,entityId){
                    assert.equal( entity.id, entityId );
                    done();
                });
            });
        });

        it('should not retrieve a non-existent entity');
    });


    describe('Entity Components', function(){
        it('should add a component to an entity', function(done){
            var self = this, entity;
            async.waterfall([
                function(cb){
                    self.registry.createEntity(cb);
                },
                function(pEntity,cb){
                    entity = pEntity;
                    entity.addComponent("/component/test/b", cb);
                },
                function(pComponent,pEntity,cb){
                    assert( odgnEntity.Component.isComponent(pComponent) );
                    // note - getting a component direct from the entity is
                    // not a great way to do it. better from an entityset
                    pEntity.getComponent('/component/test/b', cb);
                }
            ], function(err, pComponent,pEntity){
                assert( pComponent );
                done();
            });
        });
    });

    /**
     * Entity Templates are recipes for creating
     * an entity with components
     */
    describe("Entity Templates", function(){

        it('create an entity from a template', function(done){
            var self = this;
            var entityTemplate = {
                "id":"/entity/template/example",
                "type":"object",
                "properties":{
                    "a":{ "$ref":"/component/tmpl/a" },
                    "c":{ "$ref":"/component/tmpl/c" },
                }
            };
            var entity;

            async.waterfall([
                function(cb){
                    self.registry.registerComponent([ "/component/tmpl/a", "/component/tmpl/b", "/component/tmpl/c" ], null, cb);
                },
                function(components, cb){
                    self.registry.registerEntityTemplate( entityTemplate, null, cb);
                },
                function( defs, cb ){
                    self.registry.createEntityFromTemplate( '/entity/template/example', cb );
                },
                function(result, cb){
                    entity = result;
                    self.registry.getEntitiesWithComponents('/component/tmpl/c', cb);
                },
                function( pEntities,pComponentDefs, cb){
                    assert.equal( pEntities.length, 1 );
                    assert.equal( pEntities[0].id, entity.id );
                    // retrieve all the components for this entity
                    self.registry.getEntityComponents( entity, {}, cb );
                },
            ], function(err, components){
                assert.equal( components[0].schemaId, '/component/tmpl/a' );
                assert.equal( components[1].schemaId, '/component/tmpl/c' );
                done();  
            });
        });
    });

    describe("Events", function(){
        it('should forward an event to the registry', function(done){
            var self = this, entityId;
            self.registry.on( 'test_event', function(entity, number){
                assert.equal( entity.id, entityId );
                assert.equal( number, 66 );
                done();
            });

            self.registry.createEntity(function(err,entity){
                entityId = entity.id;
                entity.trigger('test_event', 66 );
            });        
        });
    });
});