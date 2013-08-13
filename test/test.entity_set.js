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
        "id":"/component_es_b"
    }
];

describe('EntitySet', function(){
    beforeEach( function(done){
        var self = this;
        odgn.entity.Registry.create({initialise:true}, function(err,registry){
            self.registry = registry;
            self.registry.registerComponent( components, done ); 
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

});