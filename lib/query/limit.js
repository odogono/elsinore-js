var _ = require('underscore');
var Q = require('./index');
var EntitySet = require('../entity_set');
var Utils = require('../utils');

var LIMIT = 105;



function dslLimit( count, offset ){
    // var lastCommand;
    var context = Q.readContext( this );

    context.pushOp( LIMIT );
    context.pushVal( Q.LEFT_PAREN );
    context.pushVal( count, true );
    if( offset ){
        context.pushVal( offset, true );
    }
    context.pushVal( Q.RIGHT_PAREN );
    
    return context;
}


function commandLimit( context, count, offset ){
    var result, entitySet, entities;

    count = Q.valueOf( context, count, true ) || 0;
    offset = Q.valueOf( context, offset, true ) || 0;
    entitySet = Q.resolveEntitySet( context );
    // entitySet = Q.valueOf( context, context.last || context.entitySet, true );

    if( !EntitySet.isEntitySet(entitySet) ){
        throw new Error('invalid es');
        // return (context.last = [ Q.VALUE, result ]);        
    }

    result = context.registry.createEntitySet( null, {register:false} );
    
    if( count > 0 ){
        entities = entitySet.models.slice( offset, offset+count );
        result.addEntity( entities );
    }
    
    return (context.last = [ Q.VALUE, result ]);
}


Q.registerCommand(  {
    commands:[
        {
            name: 'LIMIT',
            id: LIMIT,
            argCount: 1,
            command: commandLimit,
            // compile: compile,
            dsl:{
                limit: dslLimit   
            }
        }
    ]
} );

module.exports = Q;