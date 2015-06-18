'use strict';

var _ = require('underscore');
var BitField = require('../bit_field');
var Utils = require('../utils');
var Query = require('../query');
var EntitySet = require('../entity_set');

_.extend( EntitySet.prototype, {
    query: function( query, options ){
        if( !query ){
            query = Query.root();
        }
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

    entitySet.query = Query.create( entitySet.getRegistry(), query );
    
    // printIns( entitySet.query, 6 );

    // check that entities are still allowed to belong to this set
    EntitySet.evaluateEntities( entitySet );
    // query.execute( entitySet, null );

    return entitySet.query;
};

EntitySet.isEntityOfInterest = function( entitySet, entity, options ){
    var tEntity;
    var query;

    query = entitySet.query;

    if( !query ){
        return true;
    }
    tEntity = query.execute( entity );

    if( !tEntity ){
        return false;
    }

    return true;
}

/**
*   Checks through all contained entities, ensuring that they
*   are still valid members of this entitySet
*/
EntitySet.evaluateEntities = function( entitySet, entityIdArray, options ){
    var ii,len,entity, query;
    var entities;
    var removed = [];

    query = entitySet.query;

    if( !query ){
        return removed;
    }

    if( entityIdArray ){
        for( ii=0,len=entityIdArray.length;ii<len;ii++ ){
            entity = entitySet.get( entityIdArray[ii] );
            if( entity && !query.execute( entity ) ){
                removed.push( entity );
            }
        }
    } else {
        entities = entitySet.entities || entitySet;

        for( ii=entities.length-1; ii>=0; ii-- ){
            entity = entities.at(ii);
            if( entity && !query.execute( entity ) ){
                removed.push( entity );
            }
        }
    }

    if( removed.length > 0 ){
        return entitySet.removeEntity( removed, options );
    }
    return removed;
};


module.exports = {
    EntitySet: EntitySet,
    Query: Query
}

