require('./common');
require('../index');
var assert = require('assert');
var schema = require('../lib/schema.pg');


describe('Schema.pg', function(){
    beforeEach(function(){
        // reset schema
        schema.initialize();
    });


    it('should', function(){
        
        schema.register("entity://odgn/parent", {
            properties: {
                id: {type:"string", required:true },
                status: {type:"integer", required:true },
                type: {type:"integer", required:true },
                created_at: {type:"string", required:true },
                updated_at: {type:"string", required:true }
            },
            additionalProperties:true
        });

        // console.log( schema );
        // console.log( schema.toSql("entity://odgn/parent") );

        var schemaData = Common.readFixture( 'basic.json', true );
        schema.register("entity://odgn/child", schemaData );
        // console.log( schema );
        // var expected = "CREATE TABLE tbl_basic
        // (
        //     id                      SERIAL PRIMARY KEY,
        //     name                    VARCHAR,
        //     doc                     HSTORE,
        //     status                  INTEGER,
        //     type                    INTEGER,
        //     created_at              TIMESTAMP NOT NULL DEFAULT (NOW() at time zone 'UTC'),
        //     updated_at              TIMESTAMP NOT NULL DEFAULT (NOW() at time zone 'UTC')
        // );";

        console.log( schema.toSql("entity://odgn/child") );
        // console.log( schema.toSql("entity://entity/basic") );
        // 
    });


});