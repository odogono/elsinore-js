import _ from 'underscore';
import {register, VALUE} from './index';
import Query from './index';
import EntitySet from '../entity_set';
import * as Utils from '../util'

const WITHOUT = 'WO';

/**
*   Returns a value with componentsIds with all of values excluded
*/
function without( componentIds ){
    const context = this.readContext(this);

    context.pushOp( WITHOUT );
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
    // if( context.debug ){ log.debug('cmd without ' + Utils.stringify(array)); }

    value = array = context.valueOf(array, true );
    values = context.valueOf(values, true );

    if( _.isArray(array) && values ){
        value = _.without( array, values );
    }

    return (context.last = [VALUE, value]);
}



// registerCommand(  {
//     commands:[
//         {
//             name: 'WITHOUT',
//             id: WITHOUT,
//             argCount: 1,
//             command: commandWithout,
//             dsl:{
//                 without: without   
//             }
//         }
//     ]
// } );

// module.exports = Q;
register(WITHOUT, commandWithout, {without});