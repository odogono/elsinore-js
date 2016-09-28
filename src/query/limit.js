import _ from 'underscore';
import {registerCommand} from './index';
import Q from './index';
import EntitySet from '../entity_set';
import * as Utils from '../util'

export const LIMIT = 105;



function dslLimit( count, offset ){
    // var lastCommand;
    var context = Q.readContext( this );

    context.pushOp( LIMIT );
    context.pushVal( Q.LEFT_PAREN );
    context.pushVal( count, true );
    if( offset ){
        context.pushVal( offset, true );
    }
    context.pushVal( Q.RIGHT_PAREN );
    
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


function compile( context, commands ){
    var ii, cmd, limitOptions;

    log.debug('in-compile cmds:', commands);

    // look for the limit commands within the commands
    for( ii=commands.length-1;ii>=0;ii-- ){
        cmd = commands[ii];
        if( cmd[0] === LIMIT ){
            // cmdLimit = cmd;
            limitOptions = { offset: Q.valueOf(context, cmd[2]), limit: Q.valueOf(context, cmd[1]) };
            commands.splice( ii, 1 );
        }
        else if( limitOptions && cmd[0] === Q.ENTITY_FILTER ){
            // set the options object of the entityFilter command
            cmd[3] = _.extend( {}, cmd[3], limitOptions );
            limitOptions = null;
        }
    }

    // if we still have an open limit and no entity filter was found, add one
    if( limitOptions ){
        commands.unshift( [ Q.ENTITY_FILTER, null, null, limitOptions] );
    }

    // log.debug('compile cmds:'); printIns( commands );

    return commands;
}


registerCommand(  {
            name: 'LIMIT',
            id: LIMIT,
            argCount: 1,
            // command: commandLimit,
            compileHook: compile,
            dsl:{
                limit: dslLimit   
            }
} );

module.exports = Q;