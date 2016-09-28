import _ from 'underscore';
import {register,
    ENTITY_FILTER,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE} from './index';
import Query from './index';
import EntitySet from '../entity_set';
import * as Utils from '../util'

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


// function commandLimit( context, count, offset ){
//     var result, entitySet, entities;

//     count = Q.valueOf( context, count, true ) || 0;
//     offset = Q.valueOf( context, offset, true ) || 0;
//     entitySet = Q.resolveEntitySet( context );
//     // entitySet = Q.valueOf( context, context.last || context.entitySet, true );

//     if( !EntitySet.isEntitySet(entitySet) ){
//         throw new Error('invalid es');
//         // return (context.last = [ Q.VALUE, result ]);        
//     }

//     result = context.registry.createEntitySet( null, {register:false} );
    
//     if( count > 0 ){
//         entities = entitySet.models.slice( offset, offset+count );
//         result.addEntity( entities );
//     }
    
//     return (context.last = [ Q.VALUE, result ]);
// }


/**
 * Compilation involves altering the previous entityfilter so that it receives the
 * limit arguments
 */
function compile( context, commands ){
    var ii, cmd, limitOptions;

    // log.debug('in-compile cmds:', commands);

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

    // log.debug('compile cmds:'); printIns( commands );

    return commands;
}


register(LIMIT, null, {limit:dslLimit}, {compile} );