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

var propertySort = function(a,b){
    // var ap = a.orderPriority === undefined ? 0 : a.orderPriority;
    // var bp = b.orderPriority === undefined ? 0 : b.orderPriority;
    var ap = a.orderPriority || 0;
    var bp = b.orderPriority || 0;
    if( ap < bp )
        return 1;
    if( ap > bp )
        return -1;
    return 0;
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
    var result = [],prop;

    for( var key in schema.properties ){
        prop = schema.properties[key];
        result.push( _.extend({name:key}, prop) );
    }

    if( _.isArray(schema.allOf) ){
        _.each( schema.allOf, function(os){
            if( os['$ref'] ){
                
            }
        });
    }

    result = result.sort( propertySort );

    if( !keys ){
        return result;//schema.properties;
    }
    return _.pick( result, keys );
}


exports.titleFromSchema = function(schema){
    schema = exports.getSchema(schema);
    if( schema.title )
        return schema.title;

    // log.debug( 'splitting ' + JSON.stringify(schema) ); // process.exit();
    var title = schema.id.split('/').pop();
    return title;
}

