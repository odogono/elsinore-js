require('./common');
var odgn = require('../index')();


var createEntityAndEntitySet = function(options, callback){
    var registry = options.registry;
    var host = options.host || {};
    async.waterfall([
        function createEntitySet(cb){
            // create an entity set for all entities
            registry.createEntitySet( null, cb );
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



describe('EntitySet', function(){
    beforeEach( function(done){
        var self = this;
        async.waterfall([
            function createRegistry(cb){
                odgn.entity.Registry.create({initialise:true}, cb);
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
                self.registry.registerEntityTemplate( entityTemplates, cb );
            }
        ], function(err){
            if( err ) throw err;
            return done();
        });
    });


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
                self.registry.createEntitySet( {componentDefs:'/component/es_a'}, cb );
            }
        ], function(err,pEntitySet){
            assert( pEntitySet.hasEntity( entityId ) );
            done(); 
        });
    });

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

    it('should keep updated with existing components', function(done){
        var self = this;
        var entitySet, entityId;
        async.waterfall([
            function(cb){
                self.registry.createEntitySet( {componentDefs:'/component/es_a'}, cb );
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

    it('should allow a subclass to decide component membership', function(done){
        var self = this, entity, entitySet;
        var MyEntitySet = odgn.entity.EntitySet.Model.extend({
            isComponentOfInterest: function( component ){
                return component.schemaId == '/component/es_b';
            }
        });

        async.waterfall([
            function createEntitySet(cb){
                self.registry.createEntitySet( {Model:MyEntitySet}, cb );
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
    
});