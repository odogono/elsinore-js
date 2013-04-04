require('../index');
// var start = Date.now();
// var Entity = require('../lib/entity');
var assert = require('assert');
var schema = require('../lib/schema');

// var schemaEnv = schema.env; //JSV.createEnvironment();

// log.debug('loaded ' + (Date.now()-start) );

describe('Schema', function(){
    beforeEach(function(){
        // reset schema
        schema.initialise();
    });

    it('should register an entity', function(){

        // initialise with a default namespace
        schema.initialise();

        // schema.register({
        //     id:"http://entity.odogono.com",
        //     properties:{}
        // });

        schema.register({
            id:"http://entity.odogono.com/entity",
            properties: {
                id: {type:"string", required:true }
            },
            additionalProperties:true
        });

        assert( schema.validate( {id:"test_id"}, "http://entity.odogono.com/entity" ) );
    });


    it('should return a list of defined fields', function(){
        
        schema.register({
            id:"http://entity.odogono.com/entity",
            properties: {
                id: {type:"string", required:true },
                name: {type:"string", required:true },
                status: {type:"integer", required:true },
                type: {type:"integer", required:true },
                created_at: {type:"string", required:true },
                updated_at: {type:"string", required:true }
            },
            additionalProperties:true
        });

        assert.deepEqual(
            schema.propertyNames("http://entity.odogono.com/entity"),
            ["id", "name", "status", "type", "created_at", "updated_at"]
        );
        
    });

    it('should return a list of defined fields from a child', function(){
        schema.register({
            id:"http://entity.odogono.com/entity",
            properties: {
                id: {type:"string", required:true },
                status: {type:"integer", required:true },
            },
            additionalProperties:true
        });
        schema.register({
            id:"http://entity.odogono.com/company",
            extends:{"$ref":"http://entity.odogono.com/entity"},
            properties:{
                company_id: {type:"integer", required:true }
            }
        });

        assert( !schema.validate( {id:"test_id", status:3}, "http://entity.odogono.com/company" ) );
        // console.log( schema.errors );
        assert.deepEqual(
            schema.propertyNames("http://entity.odogono.com/company"),
            ["id", "status", "company_id"]
        );
    });
});