'use strict';

var _ = require('underscore');

/**
*   Returns an array of properties for the given schema
*   each item will have a name, type, and optionally a default
*   { name:'name', type:'string', default:'empty' }
*/
function getProperties( schemaRegistry, schemaUri, options ){
    var i;
    var len;
    var priorities;
    var allOf;
    var self = this;
    var result;
    var prop;
    var properties;
    var schema;
    var name;
    options || (options = {});
    
    if( _.isArray(schemaUri) ){
        return Array.prototype.concat.apply( [], schemaUri.map( function(s){
            return getProperties(schemaRegistry, s);
        }));
    }

    schema = schemaRegistry.get( schemaUri, null, {resolve:false} );

    if( !schema ){
        return null;
    }

    result = [];
    properties = schema.properties;
    if( !properties ){
        return result;
    }


    priorities = schema.propertyPriorities;

    // convert from property object into an array
    var keys = _.keys(properties);

    for (i = 0, len = keys.length; i !== len; ++i) {
        name = keys[i];
        
        prop = resolveProperty( schemaRegistry, schema, properties[ name ] );
        
        prop = _.extend({name:name}, prop);
        
        if( priorities && priorities[name] ){
            prop.priority = priorities[name];
        }
        result[i] = prop;
    }
    
    // process the allOf property if it exists - combine
    // the properties of referenced schemas into the result
    if( _.isArray(schema.allOf) ){

        allOf = _.pluck( schema.allOf, '$ref' );
        // printVar( schema );
        properties = getProperties( schemaRegistry, allOf, {raw:true} );
        
        result = result.concat( properties );
        
        priorities = true;
    }

    if( priorities ){
        result = result.sort( propertySort );
    }

    return result;
}

/**
*   Returns an object from the specified schema
*/
function getPropertiesObject( schemaRegistry, schemaUri, options ){
    var i;
    var property;
    var def
    var properties;
    var includeNullProperties;
    var result = {};

    options || (options={});

    includeNullProperties = options.includeNull;
    properties = getProperties( schemaRegistry, schemaUri, options );

    for( i in properties ){
        property = properties[i];
        def = property['default'];
        if( !_.isUndefined( def ) ){
            result[ property.name ] = def;
        } else if( includeNullProperties ){
            result[ property.name ] = null; 
        }
    }

    return result;
}

/**
*   resolves a specified schema property using $ref
*/
function resolveProperty( schemaRegistry, schema, property, options ){
    var propertySchema;
    var ref;

    if( !property ){
        return property;
    }

    if( ref = property['$ref'] ){
        propertySchema = schemaRegistry.get( schema.id + ref );
        if( propertySchema ){
            property = _.extend( {}, _.omit(property,'$ref'), propertySchema );
        }
    }

    return property;
}



/**
 * Determines the sort order of two properties
 * 
 * @param  {[type]} a [description]
 * @param  {[type]} b [description]
 * @return {[type]}   [description]
 */
function propertySort(a,b){
    var ap = a.priority || 0;
    var bp = b.priority || 0;
    if( ap < bp ){ return 1; }
    if( ap > bp ){ return -1; }
    return 0;
}

module.exports = {
    getProperties: getProperties,
    getPropertiesObject: getPropertiesObject
};