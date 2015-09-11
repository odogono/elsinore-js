import Q from './index';
import EntitySet from '../entity_set';
import * as Utils from '../util';

const ALIAS = 101;
const ALIAS_GET = 102;

function alias( name ){
    var context = Q.readContext( this );
    context.pushOp( Q.ALIAS_GET );
    context.pushVal( name, true );
    return context;
}

function aliasAs( name ) {
    // return QFunctions.alias.call( this, name );
    var context = Q.readContext( this );
    // console.log('valStack is: ' + JSON.stringify(this.valStack) );
    context.pushOp( Q.ALIAS );
    // console.log('valStack is: ' + JSON.stringify(this.valStack) );
    context.pushVal( name, true );

    return context;
}

/**
*   Stores or retrieves a value with the given name in the context
*/
function commandAlias( context, name ){
    var value;
    context.alias = (context.alias || {});

    value = context.last;

    name = Q.valueOf( context, name, true );
    value = Q.valueOf( context, value, true );
    

    if( context.debug ){ log.debug('cmd alias ' + Utils.stringify(name) + ' ' + Utils.stringify(value)); } 
    context.alias[ name ] = value;

    return (context.last = [ Q.VALUE, value ] );
}


function commandAliasGet( context, name ){
    var value;
    if( context.debug ){ log.debug('aliasGet>');printIns( context.alias ); }
    // log.debug('aliasGet> ' + name);
    context.alias = (context.alias || {});
    name = Q.valueOf( context, name, true );
    value = context.alias[ name ];
    if( !value ){
        throw new Error('no value found for alias ' + name );
    }
    if(  context.debug ){ log.debug('cmd aliasGet ' + Utils.stringify(name) + ' ' + Utils.stringify(value)); } 
    return (context.last = [ Q.VALUE, value ] );
}


Q.registerCommand(  {
    commands:[
        {
            name: 'ALIAS',
            id: ALIAS,
            argCount: 1,
            command: commandAlias,
            dsl:{
                alias: alias   
            }
        },
        {
            name: 'ALIAS_GET',
            id: ALIAS_GET,
            argCount: 1,
            command: commandAliasGet,
            dsl:{
                aliasAs: aliasAs   
            }
        }
    ]
} );

module.exports = Q;
