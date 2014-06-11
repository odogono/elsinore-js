var Common = require('./common');

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;
var EntitySet = Elsinore.EntitySet;
// var BitArray = require('bit-array');
// var BitField = require('bit_field');

var FixtureComponents = Common.fixtures.components;

describe('EntitySet', function(){

    beforeEach( function initializeRegistry(){
        var self = this;

        this.entitySet = EntitySet.create();

        return Registry.create().initialize()
            .then( function(registry){
                self.registry = registry;
                return registry.registerComponent( FixtureComponents );
            })
    });

    beforeEach( function initializeEntities(){
        var self = this;

        self.entities = [
            [{schema:'position', x:10, y:-10}, {schema:'nickname', nick:'john'}, {schema:'realname', realname:'John Smith'} ],
            [{schema:'score', score:3}, {schema:'nickname', nick:'peter'}],
            [{schema:'position', x:-32, y:10}, {schema:'score', score:10}],
            [{schema:'realname', name:'susan mayall'}],
        ];

        return this.registry.createEntities( self.entities )
            .then( function(entities){
                self.entities = entities;
                self.ComponentDefs = self.registry.ComponentDef;
            });
    });

    

    it('should return the number of entities contained', function(){
        var entity = this.entities[0];
        this.entitySet.addComponent( entity.Position );
        this.entitySet.length.should.equal(1);
        this.entitySet.addComponent( entity.Nickname );
        this.entitySet.length.should.equal(1);
    });

    it('should return an added entity', function(){
        var entity = this.entities[0];
        this.entitySet.addComponent( entity.Position );
        var addedEntity = this.entitySet.at(0);
        addedEntity.id.should.equal( entity.id );
        addedEntity.Position.id.should.equal( entity.Position.id );
    });

    it('should remove the entity belonging to a component', function(){
        var entity = this.entities[0];
        this.entitySet.addComponent( entity.Position );
        this.entitySet.removeComponent( entity.Position );
        this.entitySet.length.should.equal(0);
    });

    it('should remove a component reference from an entity', function(){
        var entity = this.entities[0];
        this.entitySet.addComponent( [entity.Position, entity.Nickname, entity.Realname] );
        var addedEntity = this.entitySet.at(0);
        expect( addedEntity.Realname ).to.not.be.undefined;
        this.entitySet.removeComponent( entity.Realname );
        addedEntity = this.entitySet.at(0);
        expect( addedEntity.Realname ).to.be.undefined;
    });

    it('should add an entity', function(){
        var entity = this.entities[0];
        this.entitySet.addEntity( entity );
        this.entitySet.length.should.equal(1);
        this.entitySet.addEntity( entity );
        this.entitySet.length.should.equal(1);
    });

    it('should remove an entity', function(){
        var entity = this.entities[0];
        this.entitySet.addEntity( entity );
        this.entitySet.length.should.equal(1);
        this.entitySet.removeEntity( entity );
        this.entitySet.length.should.equal(0);
    });

    it('should add the components of an entity', function(){
        this.entitySet.addEntity( this.entities[0] );
        var addedEntity = this.entitySet.at(0);
        expect( addedEntity.Realname ).to.not.be.undefined;
    });

    it('should emit an event when an entity is added', function(){
        var spy = Sinon.spy();
        
        this.entitySet.on('add:entity', spy );
        this.entitySet.addEntity( this.entities[0] );
        
        expect( spy.called ).to.be.true;
    });

    it('should emit an event when an entity is removed', function(){
        var spy = Sinon.spy();
        var entity = this.entities[0];
        
        this.entitySet.on('remove:entity', spy );
        this.entitySet.addEntity( entity );
        this.entitySet.removeEntity( entity );
        
        expect( spy.called ).to.be.true; 
    });

    it('should emit an event when a component is added');
    it('should emit an event when a component is removed');

    it('should only add an entity with components', function(){
        this.entitySet.addEntity( 345 );
        this.entitySet.length.should.equal(0);
    });

    it('should only add a component of an accepted type', function(){
        this.entitySet.setComponentMask( EntitySet.INCLUDE, this.ComponentDefs.Position );

        this.entitySet.addEntity( this.entities[1] );
        this.entitySet.length.should.equal(0);
        this.entitySet.addEntity( this.entities[0] );
        this.entitySet.length.should.equal(1);
    });

    it('should only retain the included component on entity', function(){
        this.entitySet.setComponentMask( EntitySet.INCLUDE, this.ComponentDefs.Nickname );
        this.entitySet.addEntity( this.entities[0] );
        // the entity won't have any of the other components
        expect( this.entitySet.at(0).getComponentCount() ).to.equal(1);
    });

    it('should not add entities that have excluded components', function(){
        this.entitySet.setComponentMask( EntitySet.EXCLUDE, this.ComponentDefs.Score );
        this.entitySet.addEntity( this.entities[1] );
        this.entitySet.length.should.equal(0);
        this.entitySet.addEntity( this.entities[0] );
        this.entitySet.length.should.equal(1);
    });

    it('should not add entities that have excluded components', function(){
        this.entitySet.setComponentMask( EntitySet.EXCLUDE, [this.ComponentDefs.Score, this.ComponentDefs.Nickname] );
        this.entitySet.addEntity( this.entities );
        this.entitySet.length.should.equal(1);
    });

    it('should only add entities that are included', function(){
        // this means that any entity MUST have a Position and Nickname
        this.entitySet.setComponentMask( EntitySet.INCLUDE, [this.ComponentDefs.Position, this.ComponentDefs.Nickname] );
        this.entitySet.addEntity( this.entities );
        this.entitySet.length.should.equal(1);
    });

    it('should only add entities that are optional', function(){
        // this means that the entity MAY have Position and/or Nickname
        this.entitySet.setComponentMask( EntitySet.OPTIONAL, [this.ComponentDefs.Position, this.ComponentDefs.Nickname] );
        this.entitySet.addEntity( this.entities );
        this.entitySet.length.should.equal(3);
    });

    it('should filter', function(){
        var self = this;
        // this.entitySet.on('all', function(evt){
        //     log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        // });
        this.entitySet.addEntity( this.entities );

        var selected = this.entitySet.filter( function(e){
            return e.hasComponent( self.ComponentDefs.Position );
        });

        selected.length.should.equal(2);
    });

    it('should remove components for an entity', function(){
        var entity = this.entities[0];

        this.entitySet.addEntity( entity );

        this.entitySet.removeEntity( entity );
    });

    // NOTE - don't think this is needed? 
    it.skip('should emit events when components change', function(){
        var entity = this.entities[0];
        var spy = Sinon.spy();

        this.entitySet.on('change:component', spy);
        
        this.entitySet.addEntity( entity );
        entity.Position.set('x',100);

        expect( spy.called ).to.be.true;
    });


    it('should clear all contained entities by calling reset', function(){
        var spy = Sinon.spy();
        // this.entitySet.on('all', function(evt){
        //     log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        // });
        this.entitySet.on('reset', spy);
        this.entitySet.addEntity( this.entities );
        this.entitySet.length.should.equal( this.entities.length );

        this.entitySet.reset();
        this.entitySet.length.should.equal(0);
        expect( spy.called ).to.be.true;
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