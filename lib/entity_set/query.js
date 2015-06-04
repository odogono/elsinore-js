'use strict';

var _ = require('underscore');
var BitField = require('../bit_field');
var Utils = require('../utils');
var Query = require('../query');
var EntitySet = require('../entity_set');

/**
*   Query functions for the memory based entity set.   
*
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/

_.extend( Query, {
    SELECT_BY_ID: 100,
});

var prevCommandFunction = Query.commandFunction;

// Query.commandFunction = function commandFunction( op ){
//     var result;

//     switch( op ){
//         case Query.SELECT_BY_ID:
//             result = commandSelectEntityById;
//             break;
//         default:
//             result = prevCommandFunction( op );
//             break;
//     }
//     return result;
// }




// /**
// *
// */
// function commandSelectEntityById( context, entitySet, entityIds ){
//     var entities, value;
//     if( context.debug ){ log.debug('commandSelectEntityById ' + Utils.stringify(entityIds)); }
//     entitySet = Query.resolveEntitySet( context, entitySet );

//     entityIds = Query.valueOf( context, entityIds, true );

//     entities = _.reduce( entityIds, function( result,id){
//         var entity = entitySet.get( id );
//         if( entity ){
//             result.push( entity );
//         }
//         return result;
//     }, []);

//     value = context.registry.createEntitySet( null, {register:false} );
//     value.addEntity( entities );

//     return (context.last = [ Query.VALUE, value ]);
// }


_.extend( EntitySet.prototype, {
    query: function( commands, options ){
        return Query.execute( this, commands, options );
    },
});



EntitySet.setEntityFilter = function( entitySet, query, options ){
    var filterType;
    var componentIds;
    var args;
    var registry;

    // var args = Array.prototype.slice.call(arguments, 1);

    // registry = entitySet.getRegistry();

    // entityFilter = registry.createEntityFilter.apply( registry, args );

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

