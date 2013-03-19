require('../index');
var start = Date.now();
// var Entity = require('../lib/entity');
var assert = require('assert');
var schema = require('../lib/schema');

// var schemaEnv = schema.env; //JSV.createEnvironment();

log.debug('loaded ' + (Date.now()-start) );

describe('Schema', function(){
    beforeEach(function(){
        // reset schema
        schema.initialise();
    });

    it('should register an entity', function(){

        // initialise with a default namespace
        schema.initialise();

        schema.register({
            id:"http://entity.odogono.com",
            properties:{}
        });

        schema.register({
            id:"http://entity.odogono.com/entity",
            properties: {
                id: {type:"string", required:true }
            },
            additionalProperties:true
        });

        assert( schema.validate( {id:"test_id"}, "http://entity.odogono.com/entity" ) );
    });
});