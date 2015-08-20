'use strict';

var _ = require('underscore');
var Q = require('./index');
var EntitySet = require('../entity_set');
var Utils = require('../utils');

var SELECT_BY_ID = 100;


_.extend( EntitySet.prototype, {
    selectById: function( entityIds, returnAsEntitySet ){
        var result;
        returnAsEntitySet = (returnAsEntitySet === undefined) ? true : returnAsEntitySet;
        result = selectById( this.getRegistry(), this, entityIds, returnAsEntitySet );
        return result;
    }
});


function dslSelectById( entityIds ){
    var context = Q.readContext( this, false );

    context.pushVal( Q.LEFT_PAREN );
    
    context.pushVal( entityIds, true );
    context.pushVal( Q.RIGHT_PAREN );

    context.pushOp( Q.SELECT_BY_ID );

    return context;
}


function commandSelectById( context, entityIds ) {
    var ii, len, value, entity, entities;
    var entitySet = context.last;

    entitySet = Q.resolveEntitySet( context, entitySet );
    // if( !EntitySet.isEntitySet(entitySet) ){
    //     throw new Error('invalid es passed to commandSelectById ' + entitySet );
    // }

    entityIds = Q.valueOf( context, entityIds );

    value = selectById( context.registry, entitySet, entityIds, true );


    return (context.last = [ Q.VALUE, value ]);
}

function selectById( registry, entitySet, entityIds, returnAsEntitySet ){
    var ii,len,entity,result, entities = [];

    entityIds = _.isArray(entityIds) ? entityIds : [entityIds];

    for( ii=0,len=entityIds.length;ii<len;ii++ ){
        entity = entitySet.getEntity( entityIds[ii] );
        if( entity ){ entities.push( entity ); }
    }

    if( returnAsEntitySet ){
        result = registry.createEntitySet( null, {register:false} );
        result.addEntity( entities );
        return result;
    }

    return entities;
}

var command = {
    commands:[
        {
            name: 'SELECT_BY_ID',
            id: SELECT_BY_ID,
            argCount: 1,
            command: commandSelectById,
            dsl:{
                selectById: dslSelectById   
            }
        }
    ]
};


Q.registerCommand( command );
module.exports = Q;