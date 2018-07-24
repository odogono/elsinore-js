import { register } from './dsl';
import { ENTITY_FILTER,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE } from './constants';

import { Query } from './index';
import { EntitySet } from '../entity_set';
import { arrayUnique } from '../util/array/unique';

const PLUCK = 'PL';

import {ENTITY_ID} from '../constants';

/**
 * Adds pluck functionality directory to entityset
 */
EntitySet.prototype.pluck = function(componentIDs, attr) {
    const query = new Query(Q => Q.pluck(componentIDs, attr));
    return query.execute(this);
};

function dslPluck(componentIDs, property, options) {
    const context = this.readContext(this);

    context.pushOp(PLUCK);

    context.pushVal(LEFT_PAREN);

    context.pushVal(componentIDs, true);

    context.pushVal(property, true);

    if (options) {
        // log.debug('adding options ' + options);
        context.pushVal(options, true);
    }

    context.pushVal(RIGHT_PAREN);

    return context;
}

/**
*   Returns the attribute values of specified components in the specified
*   entitySet 
*/
function commandPluck(context, componentIDs, attributes, options) {
    // resolve the components to ids
    let result;
    let entitySet;

    // if( true ){ log.debug('pluck> ' + stringify(_.rest(arguments))); }

    attributes = context.valueOf(attributes, true);
    attributes = Array.isArray(attributes) ? attributes : [attributes];
    options = context.valueOf(options, true);

    entitySet = context.resolveEntitySet();

    // resolve the component ids
    // componentIDs = context.valueOf(componentIDs,true);
    // if( componentIDs ){
    //     componentIDs = context.registry.getIID( componentIDs, true );
    // }

    result = pluckEntitySet(
        context.registry,
        entitySet,
        componentIDs,
        attributes
    );

    if (options && options.unique) {
        result = arrayUnique(result);
    }

    return context.last = [VALUE, result];
}

function pluckEntitySet(registry, entitySet, componentIDs, attributes) {
    let result;

    // iterate through each of the entityset models and select the components
    // specified - if they exist, select the attributes required.
    result = entitySet.getEntities().reduce(
        (values, entity) => {
            // log.debug('inCOMing ' + stringify(entity), attributes, componentIDs );
            if (!componentIDs) {
                // if there are no componentIDs, then the type of attribute we can pluck is limited...
                attributes.forEach( attr => {
                    if (attr == ENTITY_ID) {
                        values.push(entity.getEntityID());
                    }
                });
            } else {
                // const components = entity.getComponents(componentIDs);
                const components = entity.getComponents(componentIDs);

                components.forEach( component => {
                    // log.debug('inCOMing ' + stringify(component) );
                    attributes.forEach( attr => {
                        if (attr == ENTITY_ID) {
                            values.push(entity.getEntityID());
                        } else {
                            let val = component.get.call(component, attr);
                            if (val) {
                                values.push(val);
                            }
                        }
                    });
                });
            }

            return values;
        },
        []
    );

    return result;
}

/**
 * 
 */
function compile(context, command) {
    if (command[1]) {
        const resolved = context.valueOf(command[1], true);
        if (resolved) {
            command[1] = context.registry.getIID(resolved, true);
        } else {
            command[1] = null;
        }

        // command[1] = context.resolveComponentIIDs( command[1] );
        // console.log('pluck> resolve', command, resolved);
    }

    return command;
}

register(PLUCK, commandPluck, { pluck: dslPluck }, { compile });
