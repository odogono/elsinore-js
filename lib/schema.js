var tv4 = require('tv4').tv4;


/**
 * Registers a new schema
 * 
 * @param  {[type]} schemaId [description]
 * @param  {[type]} schema   [description]
 * @return {[type]}          [description]
 */
exports.addSchema = function( schemaId, schema ){
    if( _.isObject(schemaId) ){
        schema = schemaId;
        schemaId = schema.id;
    }
    var result = tv4.addSchema( schemaId, schema );
    return schemaId;
};


/**
 * [ description]
 * @param  {[type]} schema [description]
 * @return {[type]}        [description]
 */
exports.getSchema = function( schema ){
    if( !schema ){
        return null;
    }
    if( _.isString(schema) )
        return tv4.getSchema(schema);
    if( schema.schema ){
        return tv4.getSchema(schema.schema);
    }
    if( !schema.id ){
        return schema;
    }
    return tv4.getSchema(schema.id);
}

/**
 * Returns an array of properties for the specified
 * schema
 * 
 * @param  {[type]} schema [description]
 * @param  {[type]} keys   a white list of keys to include
 * @return {Array}        [description]
 */
exports.getProperties = function( schema, keys ){
    schema = exports.getSchema(schema);
    if( !keys )
        return schema.properties;
    return _.pick( schema.properties, keys );
}


exports.titleFromSchema = function(schema){
    schema = exports.getSchema(schema);
    if( schema.title )
        return schema.title;

    // log.debug( 'splitting ' + JSON.stringify(schema) ); // process.exit();
    var title = schema.id.split('/').pop();
    return title;
}

