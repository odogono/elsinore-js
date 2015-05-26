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

Query.commandFunction = function commandFunction( op ){
    var result;

    switch( op ){
        case Query.SELECT_BY_ID:
            result = commandSelectEntityById;
            break;
        default:
            result = prevCommandFunction( op );
            break;
    }
    return result;
}




/**
*
*/
function commandSelectEntityById( context, entitySet, entityIds ){
    var entities, value;
    if( context.debug ){ log.debug('commandSelectEntityById ' + Utils.stringify(entityIds)); }
    entitySet = Query.resolveEntitySet( context, entitySet );

    entityIds = Query.valueOf( context, entityIds, true );

    entities = _.reduce( entityIds, function( result,id){
        var entity = entitySet.get( id );
        if( entity ){
            result.push( entity );
        }
        return result;
    }, []);

    value = context.registry.createEntitySet( null, {register:false} );
    value.addEntity( entities );

    return (context.last = [ Query.VALUE, value ]);
}


_.extend( EntitySet.prototype, {
    query: function( commands, options ){
        return Query.execute( this, commands, options );
    },
});

module.exports = {
    EntitySet: EntitySet,
    Query: Query
}

