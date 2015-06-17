var _ = require('underscore');
var Q = require('./index');
var EntitySet = require('../entity_set');
var Utils = require('../utils');

var PLUCK = 103;

function pluck( componentIds, property, options ){
    // var lastCommand;
    var context = Q.readContext( this );

    context.pushOp( Q.PLUCK );

    context.pushVal( Q.LEFT_PAREN );

    context.pushVal( componentIds, true );
    
    context.pushVal( property, true );
    
    if( options ){
        // log.debug('adding options ' + options);
        context.pushVal( options, true );
    }

    context.pushVal( Q.RIGHT_PAREN );
    
    return context;
}

/**
*   Returns the attribute values of specified components in the specified
*   entitySet 
*/
function commandPluck( context, componentIds, attributes, options ){
    // resolve the components to ids
    var bitField, result;
    var entitySet;// = context.last;

    if( context.debug ){ log.debug('pluck> ' + Utils.stringify(_.rest(arguments))); } 

    attributes = Q.valueOf( context, attributes, true );
    attributes = _.isArray( attributes ) ? attributes : [ attributes ];
    options = Q.valueOf( context, options, true );
    
    // entitySet = Q.resolveEntitySet( context, entitySet );
    entitySet = Q.resolveEntitySet( context );


    // iterate through each of the entityset models and select the components
    // specified - if they exist, select the attributes required.
    result = _.reduce( entitySet.models, function(result, entity){
        
        _.each( entity.getComponents( componentIds ), function(component){
            // log.debug('inCOMing ' + Utils.stringify(component) );
            _.each( attributes, function(attr){
                if( attr == 'eid' ){
                    result.push( entity.getEntityId() );
                } else {
                    var val = component.get.call( component, attr );
                    if( val ) { result.push( val ); }
                }
            });
        });

        return result;
    }, []);

    if( options && options.unique ){
        result = _.uniq( result );
    }



    return (context.last = [ Q.VALUE, result ]);
}

function compile( context, command ){
    // var value = Q.valueOf( context, command[1], true );
    // log.debug('well resolving ' + JSON.stringify(command) );
    if( command[1] ){
        command[1] = Q.resolveComponentIIds( context, command[1] ); 
    }
    return command;
}


Q.registerCommand(  {
    commands:[
        {
            name: 'PLUCK',
            id: PLUCK,
            argCount: 1,
            command: commandPluck,
            compile: compile,
            dsl:{
                pluck: pluck   
            }
        }
    ]
} );

module.exports = Q;
