require('./common');
var odgn = require('../index')();
var Schema = odgn.entity.Schema;

describe('Schema', function(){
    beforeEach( function(){

    });

    it('should return properties sorted', function(){
        var schema = {
            "id":"/schema/sorted",
            "type":"object",
            "properties":{
                "status":{ "type":"integer" },
                "name":{ "type": "string" },
                "id":{ "type": "integer" },
                "count":{ "type": "integer" }
            },
            "propertyPriorities":{
                "status":-1,
                "name":2,
                "id":3
            }
        };

        Schema.addSchema( schema );

        assert.deepEqual( 
            _.pluck(Schema.getProperties(schema.id),'name'), 
            ['id', 'name', 'count', 'status']);
    });

    it('should merge two schemas properties together', function(){
        var schemaA = {
            "id":"/schema/merge_a", "type":"object",
            "properties":{
                "count":{ "type":"integer" },
                "name":{ "type":"string" }
            },
            "propertyPriorities":{
                "count":-4,
                "name":4
            }
        };
        var schemaB = {
            "id":"/schema/merge_b", "type":"object",
            "allOf":[ {"$ref":"/schema/merge_a"} ],
            "properties":{
                "status":{ "type":"integer" }
            }
        };

        Schema.addSchema( schemaA );
        Schema.addSchema( schemaB );

        // getting just the properties of A
        assert.deepEqual( 
           _.pluck(Schema.getProperties(schemaA.id),'name'), 
           ['name', 'count']);
       
        // because B has an allOf, A's properties will be added
        assert.deepEqual(
           _.pluck(Schema.getProperties(schemaB.id),'name'), 
           ['name', 'status', 'count']);

        // specifying two schemas will join them
        assert.deepEqual( 
           _.pluck(Schema.getProperties([schemaA.id, schemaB.id]),'name'), 
           ['name', 'status', 'count']);
    });


    it('should return default properties', function(){
        var schemaA = {
            "id":"/schema/def_a", "type":"object",
            "properties":{
                "count":{ "type":"integer", "default":1 },
                "name":{ "type":"string", "default":"unknown" }
            }
        };

        Schema.addSchema( schemaA );
        assert.deepEqual(
            Schema.getDefaultValues( schemaA.id ),
            {count:1, name:'unknown'} );
    });

    it('should return no default properties if not defined', function(){
        var schemaA = {
            "id":"/schema/def_a", "type":"object",
            "properties":{
                "count":{ "type":"integer" },
                "name":{ "type":"string", "default":"unknown" }
            }
        };

        Schema.addSchema( schemaA );
        assert.deepEqual(
            Schema.getDefaultValues( schemaA.id ),
            {count:null, name:'unknown'} );
    });
});