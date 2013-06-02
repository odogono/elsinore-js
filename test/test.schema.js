require('./common');
var odgn = require('../index')();

describe('Schema', function(){
    beforeEach( function(){

    });

    it('should return properties sorted', function(){
        var schema = {
            "id":"/schema/sorted",
            "type":"object",
            "properties":{
                "status":{ "type":"integer", "orderPriority":-1 },
                "name":{ "type": "string", "orderPriority":2 },
                "id":{ "type": "integer", "orderPriority":3 },
                "count":{ "type": "integer" }
            }
        };

        odgn.entity.Schema.addSchema( schema );

        // var props = odgn.entity.Schema.getProperties( schema.id );
        assert.deepEqual( 
            _.pluck(odgn.entity.Schema.getProperties(schema.id),'name'), 
            ['id', 'name', 'count', 'status']);
    });

    it('should merge two schemas properties together', function(){
        var schemaA = {
            "id":"/schema/merge_a", "type":"object",
            "properties":{
                "count":{ "type":"integer", "orderPriority":-4 },
                "name":{ "type":"string", "orderPriority":4 }
            }
        };
        var schemaB = {
            "id":"/schema/merge_b", "type":"object",
            "allOf":[ {"$ref":"/schema/merge_a"} ],
            "properties":{
                "status":{ "type":"integer" }
            }
        };

        odgn.entity.Schema.addSchema( schemaA );
        odgn.entity.Schema.addSchema( schemaB );

       assert.deepEqual( 
           _.pluck(odgn.entity.Schema.getProperties(schemaA.id),'name'), 
           ['name', 'count']);
       
       assert.deepEqual( 
           _.pluck(odgn.entity.Schema.getProperties(schemaB.id),'name'), 
           ['name', 'status', 'count']);

    });
});