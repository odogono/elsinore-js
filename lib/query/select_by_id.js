'use strict';

var Q = require('./index');
var EntitySet = require('../entity_set');
var Utils = require('../utils');

var SELECT_BY_ID = 100;


function selectById( entityIds ){
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
    // log.debug('SELECT_BY_ID> select from ES size ' + entitySet.size() );
    // printIns( entityIds,2 );
    entityIds = Q.valueOf( context, entityIds );

    entities = [];

    for( ii=0,len=entityIds.length;ii<len;ii++ ){
        entity = entitySet.getEntity( entityIds[ii] );
        if( entity ){ entities.push( entity ); }
    }

    if( context.debug ){ log.debug('cmd filter result length ' + entities.length ); }

    value = context.registry.createEntitySet( null, {register:false} );
    value.addEntity( entities );

    return (context.last = [ Q.VALUE, value ]);
}

var command = {
    commands:[
        {
            name: 'SELECT_BY_ID',
            id: SELECT_BY_ID,
            argCount: 1,
            command: commandSelectById,
            dsl:{
                selectById: selectById   
            }
        }
    ]
};


Q.registerCommand( command );
module.exports = Q;