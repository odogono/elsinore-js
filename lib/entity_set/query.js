'use strict';

var _ = require('underscore');
var BitField = require('../bit_field');
var Utils = require('../utils');
var Query = require('../query');
var EntitySet = require('../entity_set');

_.extend( EntitySet.prototype, {
    query: function( query, options ){
        return Query.execute( this, query, options );
    },
});



EntitySet.setEntityFilter = function( entitySet, query, options ){
    var filterType;
    var componentIds;
    var args;
    var registry;

    if( !query ){//|| !Query.isFilterQuery(query) ){
        throw new Error('invalid filter passed');
    }

    entitySet.entityFilter = query.compile( entitySet.getRegistry() );
    
    printIns( entitySet.entityFilter, 6 );

    // check that entities are still allowed to belong to this set
    EntitySet.evaluateEntities( entitySet );
    // query.execute( entitySet, null );

    return entitySet.entityFilter;
};

/**
*   Checks through all contained entities, ensuring that they
*   are still valid members of this entitySet
*/
EntitySet.evaluateEntities = function( entitySet, options ){
    var ii,len,entity, query;
    var entities;
    var removed = [];

    entities = entitySet.entities || entitySet;
    query = entitySet.entityFilter;

    for( ii=entities.length-1; ii>=0; ii-- ){
        entity = entities.at(ii);
        if( entity && !query.execute( entity) ){
            removed.push( entity );
        }
    }
    if( removed.length > 0 ){
        return entitySet.removeEntity( removed );
    }
    return false;
};


module.exports = {
    EntitySet: EntitySet,
    Query: Query
}

