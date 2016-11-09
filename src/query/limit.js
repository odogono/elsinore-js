import _ from 'underscore';
import {register,
    ENTITY_FILTER,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE} from './index';
import Query from './index';
import EntitySet from '../entity_set';

export const LIMIT = 'LM';



function dslLimit( count, offset ){
    const context = this.readContext(this);

    context.pushOp( LIMIT );
    context.pushVal( LEFT_PAREN );
    context.pushVal( count, true );
    if( offset ){
        context.pushVal( offset, true );
    }
    context.pushVal( RIGHT_PAREN );
    
    return context;
}


function commandLimit( context, count, offset ){
//     var result, entitySet, entities;

    count = context.valueOf(count, true) || 0;
    offset = context.valueOf(offset, true ) || 0;
    const entitySet = context.resolveEntitySet();
//     // entitySet = Q.valueOf( context, context.last || context.entitySet, true );

    if( !EntitySet.isEntitySet(entitySet) ){
        throw new Error('invalid entityset');        
    }

    if( !entitySet.isMemoryEntitySet ){
        throw new Error('invalid entityset');
    }

    const result = context.registry.createEntitySet( {register:false} );
    
    // console.log('limit: ', offset, count, entitySet.models.length );

    if( count > 0 ){
        const entities = entitySet.models.slice( offset, offset+count );
        // console.log('limit: got ', entities.length);
        result.addEntity( entities );
    }
    
    return (context.last = [ VALUE, result ]);
}


/**
 * Compilation involves altering the previous entityfilter so that it receives the
 * limit arguments
 */
function compile( context, commands ){
    var ii, cmd, limitOptions;

    // log.debug('limit: in-compile cmds:', commands);

    // look for the limit commands within the commands
    for( ii=commands.length-1;ii>=0;ii-- ){
        cmd = commands[ii];
        if( cmd[0] === LIMIT ){
            // cmdLimit = cmd;
            limitOptions = { offset: context.valueOf(cmd[2]), limit: context.valueOf(cmd[1]) };
            commands.splice( ii, 1 );
        }
        else if( limitOptions && cmd[0] === ENTITY_FILTER ){
            // set the options object of the entityFilter command
            cmd[3] = _.extend( {}, cmd[3], limitOptions );
            limitOptions = null;
        }
    }

    // if we still have an open limit and no entity filter was found, add one
    if( limitOptions ){
        commands.unshift( [ ENTITY_FILTER, null, null, limitOptions] );
    }

    return commands;
}


register(LIMIT, commandLimit, {limit:dslLimit}, {compile} );