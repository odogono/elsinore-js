// import Q from './index';
import {register,VALUE} from './index';
import EntitySet from '../entity_set';
import {stringify} from '../util';


const ALIAS = 'AL';
const ALIAS_GET = 'ALG';

function alias( name ){
    const context = this.readContext(this);
    context.pushOp( ALIAS_GET );
    context.pushVal( name, true );
    return context;
}

function aliasAs( name ) {
    // return QFunctions.alias.call( this, name );
    const context = this.readContext(this);
    // console.log('valStack is: ' + JSON.stringify(this.valStack) );
    context.pushOp( ALIAS );
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
    
    name = context.valueOf( name, true );
    value = context.valueOf( value, true );
    

    if( context.debug ){ log.debug('cmd alias ' + stringify(name) + ' ' + stringify(value)); } 
    context.alias[ name ] = value;

    return (context.last = [ VALUE, value ] );
}


function commandAliasGet( context, name ){
    var value;
    // if( context.debug ){ log.debug('aliasGet>'); }
    // log.debug('aliasGet> ' + name);
    context.alias = (context.alias || {});
    name = context.valueOf( name, true );
    value = context.alias[ name ];
    if( !value ){
        throw new Error('no value found for alias ' + name );
    }
    if(  context.debug ){ log.debug('cmd aliasGet ' + stringify(name) + ' ' + stringify(value)); } 
    return (context.last = [ VALUE, value ] );
}


// the additional commands are added to Query as soon as this module is imported
register(ALIAS, commandAlias, {alias});
register(ALIAS_GET, commandAliasGet, {aliasAs});