import _ from 'underscore';
var Q = require('./index');
var EntitySet = require('../entity_set');
import * as Utils from '../util'

var WITHOUT = 104;

/**
*   Returns a value with componentsIds with all of values excluded
*/
function without( componentIds ){
    var context = Q.readContext( this );

    context.pushOp( Q.WITHOUT );
    // the preceeding command is used as the first argument
    context.pushVal( componentIds, true );

    return context;
}


/**
*
*/
function commandWithout( context, values ){
    var value;
    var array = context.last;
    if( context.debug ){ log.debug('cmd without ' + Utils.stringify(array)); }

    value = array = Q.valueOf( context, array, true );
    values = Q.valueOf( context, values, true );

    if( _.isArray(array) && values ){
        value = _.without( array, values );
    }

    return (context.last = [Q.VALUE, value]);
}



Q.registerCommand(  {
    commands:[
        {
            name: 'WITHOUT',
            id: WITHOUT,
            argCount: 1,
            command: commandWithout,
            dsl:{
                without: without   
            }
        }
    ]
} );

module.exports = Q;
