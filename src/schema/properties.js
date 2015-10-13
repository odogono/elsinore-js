import _ from 'underscore';

import {parseUri} from '../util';


/**
*   Returns an array of properties for the given schema
*   each item will have a name, type, and optionally a default
*   { name:'name', type:'string', default:'empty' }
*/
export function getProperties( schemaRegistry, schemaUri, options={} ){
    let ii,len;
    let priorities;
    let allOf;
    let self = this;
    let result;
    let prop;
    let properties;
    let schema;
    let name;
    let pickedProperty;

    if( _.isArray(schemaUri) ){
        return Array.prototype.concat.apply( [], 
            schemaUri.map( s => getProperties(schemaRegistry, s)) );
    }

    const parsed = parseUri( schemaUri );
    if( parsed ){
        console.log('parsed', schemaUri, parsed.baseUri );

        schemaUri = parsed.baseUri;
        pickedProperty = parsed.fragment;
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
    let keys = _.keys(properties);

    for (ii = 0, len = keys.length; ii !== len; ++ii) {
        name = keys[ii];
        
        prop = resolveProperty( schemaRegistry, schema, properties[ name ] );
        
        prop = _.extend({name:name}, prop);
        
        if( priorities && priorities[name] ){
            prop.priority = priorities[name];
        }
        result[ii] = prop;
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

    if( pickedProperty ){
        return _.find( result, (prop) => prop.name == pickedProperty );
    }

    return result;
}

/**
*   Returns an object from the specified schema
*/
export function getPropertiesObject( schemaRegistry, schemaUri, options={} ){
    let ii;
    let property;
    let def
    let properties;
    let includeNullProperties;
    let result = {};

    includeNullProperties = options.includeNull;
    properties = getProperties( schemaRegistry, schemaUri, options );

    for( ii in properties ){
        property = properties[ii];
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