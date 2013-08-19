require('./common');
var odgn = require('../index')();


var components = [
    {
        "id":"/component/es_a",
        "properties":{
            "name":{"type":"string"}
        }
    },
    {
        "id":"/component/es_b",
        "properties":{
            "is_active":{ "type":"boolean" }
        }
    },
    {
        "id":"/component/es_c",
        "properties":{
            "age":{ "type":"integer" }
        }
    }
];

var entityTemplate = {
    "id":"/entity_template/a",
    "type":"object",
    "properties":{
        "a":{ "$ref":"/component/es_a" },
        "c":{ "$ref":"/component/es_c" },
    }
};


describe('EntitySet', function(){
    beforeEach( function(done){
        var self = this;
        async.waterfall([
            function createRegistry(cb){
                odgn.entity.Registry.create({initialise:true}, cb);
            },
            function registerComponents(registry,cb){
                self.registry = registry;
                self.registry.registerComponent( components, cb ); 
            },
            function registerEntityTemplate(components, cb){
                self.registry.registerEntityTemplate( entityTemplate, cb );
            },
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
            function(entity,component,cb){
                entityId = entity.id;
                // create an entityset interested in a single component
                self.registry.createEntitySet( '/component/es_a', {}, cb );
            }
        ], function(err,entitySet){
            assert.equal( entitySet.length, 1 );
            assert.equal( entitySet.at(0).id, entityId );
            done(); 
        });
    });

    it('should keep updated with existing components', function(done){
        var self = this;
        var entitySet, entityId;
        async.waterfall([
            function(cb){
                self.registry.createEntitySet( '/component/es_a', {}, cb );
            },
            function(result,cb){
                entitySet = result;
                assert.equal( entitySet.length, 0 );
                self.registry.createEntity(cb);
            },
            function(entity,cb){
                entityId = entity.id;
                entity.addComponent('/component/es_a', cb);
            }
        ], function(err){
            assert.equal( entitySet.length, 1 );
            assert.equal( entitySet.at(0).id, entityId );
            done();
        });
    });

    it('should return a component for an entity', function(done){
        var self = this, entitySet, entityId;
        async.waterfall([
            function createEntitySet(cb){
                // create an entity set for all entities
                self.registry.createEntitySet( null, {}, cb );
            },
            function createEntity(result, cb){
                entitySet = result;
                self.registry.createEntity(cb);
            },
            function addComponentToEntity(entity,cb){
                entityId = entity.id;
                entity.addComponent('/component/es_c', cb);
            },
        ], function retrieveComponentFromEntity(err,component){
            if( err ) throw err;
            var component = entitySet.getComponent( "/component/es_c", entityId );
            // print_ins( component,1 );
            assert.equal( component.schemaId, '/component/es_c' );
            done();
        });
    });
});