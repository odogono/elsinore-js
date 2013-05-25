var tv4 = require('tv4').tv4;


exports.addSchema = function( schemaId, schema ){
    tv4.addSchema( schema.id, schema );
};


exports.getProperties = function( schema, keys ){
    if( !keys )
        return schema.properties;
    return _.pick( schema.properties, keys );
}