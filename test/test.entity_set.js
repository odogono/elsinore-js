var Common = require('./common');

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;
var EntitySet = Elsinore.EntitySet;

var FixtureComponents = Common.fixtures.components;

describe('EntitySet', function(){

    beforeEach( function(){
        var self = this;
        return Registry.create().initialize()
            .then( function(registry){
                self.registry = registry;
                return registry.registerComponent( FixtureComponents );
            })
    });

    beforeEach( function(){
        var self = this;

        self.entities = [
            [{schema:'position', x:10, y:-10}, {schema:'nickname', nick:'john'} ],
            [{schema:'score', score:3}, {schema:'nickname', nick:'peter'}],
            [{schema:'position', x:-32, y:10}, {schema:'score', score:10}]
        ];

        var current = Promise.resolve();
        return Promise.map( self.entities, function(entitySpec){
            current = current.then( function(){
                return self.registry.createEntity( entitySpec );
            });
            return current;
        })
        .then( function(entities){
            self.entities = entities;
        });
    });

    it('should return the number of entities contained', function(){
        var es = EntitySet.create();
        var entity = this.entities[0];
        es.addComponent( entity.Position );
        es.length.should.equal(1);
        es.addComponent( entity.Nickname );
        es.length.should.equal(1);
    });

    it('should return an added entity', function(){
        var es = EntitySet.create();
        var entity = this.entities[0];
        es.addComponent( entity.Position );
        es.at(0).id.should.equal( entity.id );
    });


});



describe.skip('EntitySet.Old', function(){
    var createEntityAndEntitySet = function(options, callback){
        var registry = options.registry;
        var host = options.host || {};
        async.waterfall([
            function createEntitySet(cb){
                // create an entity set for all entities
                registry.createEntitySet( null, null, cb );
            },
            function createEntity(result, cb){
                host.entitySet = result;
                registry.createEntity(cb);
            }
        ], function(err,result){
            host.entity = result;
            return callback(err,host.entity,host.entitySet);
        });
    };


    beforeEach( function(done){
        var self = this;
        async.waterfall([
            function createRegistry(cb){
                odgnEntity.Registry.create({initialize:true}, cb);
            },
            function registerComponents(pRegistry,cb){
                self.registry = pRegistry;
                // self.registry.on('component:register', function(componentDef){
                //     log.debug('registry registered component: ' + componentDef.schema.id + '(' + componentDef.id + ')');
                // });
                var components = JSON.parse( fs.readFileSync( Common.pathFixture('components.json') ) );
                self.registry.registerComponent( components, null, cb ); 
            },
            function registerEntityTemplate(pComponents, cb){
                var entityTemplates = JSON.parse( fs.readFileSync(Common.pathFixture('entity_templates.json')) );
                self.registry.registerEntityTemplate( entityTemplates, null, cb );
            }
        ], function(err){
            if( err ) throw err;
            return done();
        });
    });

    // TODO: convert from integration test
    it('should populate with existing components', function(done){
        var self = this;
        var entityId;
        async.waterfall([
            function(cb){
                self.registry.createEntity(cb);
            },
            function(entity,cb){
                entity.addComponent('/component/es_a', cb);
            },
            function(pEntity,pComponent,cb){
                entityId = pEntity.id;
                // create an entityset interested in a single component
                self.registry.createEntitySet( null, {componentDefs:'/component/es_a'}, cb );
            }
        ], function(err,pEntitySet){
            assert( pEntitySet.hasEntity( entityId ) );
            done(); 
        });
    });

    // TODO: convert from integration test
    it('should by default contain all components', function(done){
        var self = this, entitySet, entityId;
        async.waterfall([
            function(cb){
                createEntityAndEntitySet({host:self, registry:self.registry}, cb);
            },
            function addComponentToEntity( pEntity, pEntitySet, cb ){
                pEntity.addComponent(['/component/es_a', '/component/es_b','/component/es_c'], cb);
            },
        ], function retrieveComponentFromEntity(err,pComponents, pEntity){
            assert( self.entitySet.getComponent( "/component/es_a", self.entity.id ) );
            assert( self.entitySet.getComponent( "/component/es_b", self.entity.id ) );
            assert( self.entitySet.getComponent( "/component/es_c", self.entity.id ) );
            done();
        });
    });

    // TODO: convert from integration test
    it('should keep updated with existing components', function(done){
        var self = this;
        var entitySet, entityId;
        async.waterfall([
            function(cb){
                self.registry.createEntitySet( null, {componentDefs:'/component/es_a'}, cb );
            },
            function(result,cb){
                entitySet = result;
                assert.equal( entitySet.length, 0 );
                self.registry.createEntity(cb);
            },
            function(entity,cb){
                entityId = entity.id;
                assert( !entitySet.hasEntity(entityId) );
                entity.addComponent('/component/es_a', cb);
            }
        ], function(err){
            assert( entitySet.hasEntity(entityId) );
            done();
        });
    });

    // TODO: convert from integration test
    it('should return a component for an entity', function(done){
        var self = this, entitySet, entityId;
        async.waterfall([
            function(cb){
                createEntityAndEntitySet({host:self, registry:self.registry}, cb);
            },
            function addComponentToEntity( pEntity, pEntitySet, cb ){
                entity = pEntity; entitySet = pEntitySet;
                entityId = entity.id;
                entity.addComponent('/component/es_c', cb);
            },
        ], function retrieveComponentFromEntity(err,component){
            var component = entitySet.getComponent( "/component/es_c", entityId );
            assert.equal( component.schemaId, '/component/es_c' );
            done();
        });
    });

    // TODO: convert from integration test
    it('should handle removed components correctly', function(done){
        var self = this, entitySet, entity, entityId;
        async.waterfall([
            function(cb){
                createEntityAndEntitySet({host:self,registry:self.registry}, cb);
            },
            function addComponentToEntity( pEntity, pEntitySet, cb ){
                entity = pEntity; entitySet = pEntitySet;
                entityId = entity.id;
                entity.addComponent('/component/es_c', cb);
            },
            function removeComponentFromEntity( pComponent, pEntity, cb ){
                // log.debug('getting component es_c for entity ' + entityId );
                var component = entitySet.getComponent( "/component/es_c", entityId );
                assert.equal( component.schemaId, '/component/es_c' );
                entity.removeComponent('/component/es_c', cb );
            },
        ], function retrieveComponentFromEntity(err,component){
            assert( !entitySet.getComponent( "/component/es_c", entityId ) );
            done();
        });
    });

    // TODO: convert from integration test
    it('should allow a subclass to decide component membership', function(done){
        var self = this, entity, entitySet;
        var MyEntitySet = odgnEntity.EntitySet.Model.extend({
            isComponentOfInterest: function( component ){
                return component.schemaId == '/component/es_b';
            }
        });

        async.waterfall([
            function createEntitySet(cb){
                self.registry.createEntitySet( null, {Model:MyEntitySet}, cb );
            },
            function createEntity(pEntitySet, cb){
                entitySet = pEntitySet;
                self.registry.createEntity(cb);
            },
            function( pEntity, cb ){
                entity = pEntity;
                entity.addComponent(['/component/es_a', '/component/es_b', '/component/es_c'], cb);
            }
        ], function(err, pComponents, pEntity){
            assert( !entitySet.getComponent( "/component/es_a", entity ) );
            assert( entitySet.getComponent( "/component/es_b", entity ) );
            assert( !entitySet.getComponent( "/component/es_c", entity ) );
            done();
        });
        
    });

    // TODO: convert from integration test
    it('should iterate over entities using forEach', function(done){
        var self = this, entity, entitySet;
        async.waterfall([
            function createEntitySet(cb){
                self.registry.createEntitySet( null, null, cb );
            },
            function createFiveEntities(pEntitySet, cb){
                entitySet = pEntitySet;
                async.times(5, function(n,next){
                    self.registry.createEntityFromTemplate("/entity_template/simple",next);
                }, cb);
            }
        ], function(err, pEntities){
            var last = -1;
            entitySet.forEach( function(entity){
                assert( entity.id > last );
                last = entity.id;
            });
            assert( last > -1 );
            done();
        });
    });

    it('should iterate over entities using forEach async', function(done){
        var self = this, entity, entitySet;
        async.waterfall([
            function createEntitySet(cb){
                self.registry.createEntitySet( null, null, cb );
            },
            function createFiveEntities(pEntitySet, cb){
                entitySet = pEntitySet;
                async.times(5, function(n,next){
                    self.registry.createEntityFromTemplate("/entity_template/simple",next);
                }, cb);
            }
        ], function(err, pEntities){
            var last = -1;
            entitySet.forEach( function(entity,entitySet,cb){
                assert( entity.id > last );
                last = entity.id;
                return cb();
            }, function(err){
                assert( last > -1 );
                done();    
            });
        });
    });


});