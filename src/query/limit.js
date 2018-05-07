import { register } from './register';
import { ENTITY_FILTER,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE } from './constants';

import { isEntitySet, isMemoryEntitySet } from '../util/is';

export const LIMIT = 'LM';

function dslLimit(count, offset) {
    const context = this.readContext(this);

    context.pushOp(LIMIT);
    context.pushVal(LEFT_PAREN);
    context.pushVal(count, true);
    if (offset) {
        context.pushVal(offset, true);
    }
    context.pushVal(RIGHT_PAREN);

    return context;
}

function commandLimit(context, count, offset) {
    const {registry} = context;

    count = context.valueOf(count, true) || 0;
    offset = context.valueOf(offset, true) || 0;

    const entitySet = context.resolveEntitySet();
    //     // entitySet = Q.valueOf( context, context.last || context.entitySet, true );

    if (!isEntitySet(entitySet)) {
        throw new Error('invalid entityset');
    }

    if (!isMemoryEntitySet(entitySet)) {
        throw new Error('invalid entityset');
    }

    const result = registry.createEntitySet({ register: false });

    // console.log('limit: ', offset, count, entitySet.size() );

    if (count > 0) {
        const entities = entitySet.getEntities().slice(offset, offset + count);
        // console.log('limit: got ', entities.length);
        result.addEntity(entities);
    }

    return context.last = [VALUE, result];
}

/**
 * Compilation involves altering the previous entityfilter so that it receives the
 * limit arguments
 */
function compile(context, commands) {
    let ii, cmd, limitOptions;

    // log.debug('limit: in-compile cmds:', commands);

    // look for the limit commands within the commands
    for (ii = commands.length - 1; ii >= 0; ii--) {
        cmd = commands[ii];
        if (cmd[0] === LIMIT) {
            // cmdLimit = cmd;
            limitOptions = {
                offset: context.valueOf(cmd[2]),
                limit: context.valueOf(cmd[1])
            };
            commands.splice(ii, 1);
        } else if (limitOptions && cmd[0] === ENTITY_FILTER) {
            // set the options object of the entityFilter command
            if (limitOptions) {
                cmd[3] = { ...cmd[3], ...limitOptions };
            }
            limitOptions = null;
        }
    }

    // if we still have an open limit and no entity filter was found, add one
    if (limitOptions) {
        commands.unshift([ENTITY_FILTER, null, null, limitOptions]);
    }

    return commands;
}

register(LIMIT, commandLimit, { limit: dslLimit }, { compile });
