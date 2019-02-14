import { Entity } from '../entity';
import { QueryOp } from '../types';
import { register } from './dsl';
export const ATTR = 'AT';

/**
 *
 */
function dslAttr(attr) {
    const context = this.readContext(this);
    context.pushVal([ATTR, attr]);
    return context;
}

/**
 *   Takes the attribute value of the given component and returns it
 *
 *   This command operates on the single entity within context.
 */
function commandAttr(context, attributes) {
    let ii, jj, len, jlen, result;
    let entity:Entity = context.entity;
    // let debug = context.debug;
    const componentIDs = context.componentIDs;

    // printIns( context,1 );
    // if( debug ){ console.log('ATTR> ' + stringify(componentIDs) + ' ' + stringify( _.rest(arguments))  ); }

    // if( !componentIDs ){
    //     throw new Error('no componentIDs in context');
    // }

    if (!entity) {
        // console.log('ATTR> no entity');
        return (context.last = [QueryOp.Value, null]);
    }

    attributes = Array.isArray(attributes) ? attributes : [attributes];
    // components = entity.components;
    result = [];

    const components = entity.getComponents(componentIDs);

    // console.log('commandComponentAttribute', attributes);
    for (ii = 0, len = components.length; ii < len; ii++) {
        const component = components[ii];
        for (jj = 0, jlen = attributes.length; jj < jlen; jj++) {
            const attr = attributes[jj];
            const val = component.get(attr);
            if (val !== undefined) {
                result.push(val);
            }
        }
    }

    if (result.length === 0) {
        result = null;
    } else if (result.length === 1) {
        result = result[0];
    }

    return (context.last = [QueryOp.Value, result]);
}

register(ATTR, commandAttr, { attr: dslAttr });


// interface CommandSpec {
//     token: string;
//     command( context:object, attributes:Array<string>|string ): any;
// }

/**
 * TODO : convert query commands to this single
 */
// export function command(){

//     return [ ATTR, commandAttr, { attr, dslAttr } ];

//     // return (context, attributes) => {

//     // }
// }