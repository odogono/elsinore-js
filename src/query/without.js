
import { register, VALUE } from './index';
import arrayWithout from '../util/array/without';

const WITHOUT = 'WO';

/**
*   Returns a value with componentsIds with all of values excluded
*/
function without(componentIds) {
    const context = this.readContext(this);

    context.pushOp(WITHOUT);
    // the preceeding command is used as the first argument
    context.pushVal(componentIds, true);

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

    return context.last = [VALUE, value];
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
