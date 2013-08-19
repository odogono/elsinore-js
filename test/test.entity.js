require('./common');
var odgn = require('../index')();


describe('Entity', function(){
    beforeEach( function(done){
        var self = this;
        // passing a callback to create will initialise
        this.registry = odgn.entity.Registry.create({initialise:true}, function(err,registry){
            self.registry = registry;
            self.registry.registerComponent([ 
                "/component/test/a", "/component/test/b", "/component/test/c" 
            ], function(){
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
                var oentity = registry.getEntity( entity.id );
                assert.equal( oentity.id, entity.id );
                done();
            });
        });

        it('should not retrieve a non-existent entity');
    });


    describe('Entity Components', function(){
        it.only('should add a component to an entity', function(done){
            var self = this, entity;
            async.waterfall([
                function(cb){
                    self.registry.createEntity(cb);
                },
                function(pEntity,cb){
                    entity = pEntity;
                    entity.addComponent("/component/test/b", cb);
                }
            ], function(err, component,entity){
                assert( odgn.entity.Component.isComponent(component) );
                assert( entity.hasComponent('/component/test/b') );
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
                    self.registry.registerComponent([ "/component/tmpl/a", "/component/tmpl/b", "/component/tmpl/c" ], cb);
                },
                function(components, cb){
                    self.registry.registerEntityTemplate( entityTemplate, cb);
                },
                function( defs, cb ){
                    self.registry.createEntityFromTemplate( '/entity/template/example', cb );
                },
                function(result, cb){
                    entity = result;
                    self.registry.getEntitiesWithComponents('/component/tmpl/c', cb);
                },
                function(entities,cb){
                    assert.equal( entities.length, 1 );
                    assert.equal( entities[0].id, entity.id );
                    // retrieve all the components for this entity
                    self.registry.getEntityComponents( entity, cb );
                },
            ], function(err, components){
                assert.equal( components[0].schemaId, '/component/tmpl/a' );
                assert.equal( components[1].schemaId, '/component/tmpl/c' );
                done();  
            });
        });
    });
});