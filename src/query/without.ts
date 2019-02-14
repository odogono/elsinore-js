import { QueryOp } from '../types';
import { arrayWithout } from '../util/array/without';
import { register } from './dsl';

const WITHOUT = 'WO';

/**
*   Returns a value with componentsIDs with all of values excluded
*/
function without(componentIDs) {
    const context = this.readContext(this);

    context.pushOp(WITHOUT);
    // the preceeding command is used as the first argument
    context.pushVal(componentIDs, true);

    return context;
}

/**
*
*/
function commandWithout(context, values) {
    let value;
    let array = context.last;
    // if( context.debug ){ log.debug('cmd without ' + stringify(array)); }

    value = array = context.valueOf(array, true);
    values = context.valueOf(values, true);

    if (Array.isArray(array) && values) {
        value = arrayWithout(array, values);
    }

    return context.last = [QueryOp.Value, value];
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
register(WITHOUT, commandWithout, { without });
