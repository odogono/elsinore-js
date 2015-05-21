'use strict';

var _ = require('underscore');
var BitField = require('../bit_field');
var Utils = require('../utils');

/**
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/
function Query(){}

_.extend( Query, {
    ALL: 0, // entities must have all the specified components
    ANY: 1, // entities must have one or any of the specified components
    SOME: 2, // entities must have at least one component
    NONE: 3, // entities should not have any of the specified components
    INCLUDE: 4, // the filter will only include specified components
    EXCLUDE: 5, // the filter will exclude specified components
    ROOT: 6, // select the root entity set
    EQUALS: 7, // == 
    NOT_EQUAL: 8, // !=
    LESS_THAN: 9, // <
    LESS_THAN_OR_EQUAL: 10,
    GREATER_THAN: 11, // >
    GREATER_THAN_OR_EQUAL: 12,
    AND: 13,
    OR: 14,
    NOT: 15,
    VALUE: 16, // a value
    FILTER: 17,
    ADD_ENTITIES: 18,
    ATTR: 19,
    PLUCK: 20,
    ALIAS: 21,
    DEBUG: 22,
    PRINT: 23,
    SELECT_BY_ID: 24,
    WITHOUT: 25,
    NOOP: 26,
    LEFT_PAREN: 27,
    RIGHT_PAREN: 28,
    MEMBER_OF: 29,
    ENTITY_FILTER: 30
});


function createEntityFilter( type, bitField ){
    return { isEntityFilter:true, type:type, bitField:bitField };
}

function gatherComponentFilters( context, expression ){
    var i,len,bf,result, obj;
    
    result = [];

    // log.debug('gatherComponentFilters ' + Utils.stringify(expression) );

    switch( expression[0] ){
        case Query.ALL:
        case Query.NONE:
            bf = componentsToBitfield( context, expression[2] );
            obj = createEntityFilter( expression[0], bf );
            // log.debug('converted ' + JSON.stringify( obj ) );
            result.push( obj );

            break;
        case Query.AND:
            // log.debug('AND ' + Utils.stringify(_.rest(expression)) );
            _.each( _.rest(expression), function(sub){
                // log.debug('sub ' + Utils.stringify(sub) );
                result = result.concat( gatherComponentFilters(context,sub) );
            });
            break;
    }

    return result;
}


/**
*   Resolves the given entitySet parameter into
*   an actual entityset value.
*
*   If Query.ROOT is passed, the current value of 
*   context.entitySet is returned.
*
*   If an (array) command is passed, it is executed
*   (via valueOf) and returned.
*/
function resolveEntitySet( context, entitySet ){
    var op;
    if( entitySet === Query.ROOT ){
        return context.entitySet;
    }

    if( _.isArray(entitySet) ){
        op = entitySet[0];
        if( context.debug ){ log.debug('resolving entityset ' + Utils.stringify(entitySet) ); }
        if( op === Query.AND || op === Query.ALL || op === Query.NONE ){
            // log.debug('composing filter from ' + Utils.stringify(entitySet) );

            // turn the expression into an array of entity filter objects
            entitySet = [ Query.ENTITY_FILTER, gatherComponentFilters( context, entitySet ) ];
        }

        return valueOf( context, entitySet );
    }

    // if( EntitySet.isEntitySet(entitySet) ){
    //     return entitySet;
    // }

    return null;
}


function componentsToBitfield( context, components ){
    var componentIds, result;
    // log.debug('getIID ' + JSON.stringify(components) );
    componentIds = context.registry.getIId( components, true );
    // log.debug('getIID ' + JSON.stringify(components) );
    result = BitField.create();
    result.setValues( componentIds, true );
    // log.debug(' getIID ' + result.toJSON() );
    // printIns( result );
    return result; //BitField.create().setValues( componentIds );
}


function commandEntityFilter( context, filters ){
    var entitySet, entity, entities,filtersLength,result,i,ebf,filter;
    var EntityFilter = require('../entity_filter');

    filters = _.isArray(filters) ? filters : [filters];
    filtersLength = filters.length;

    if( !context.entity ){
        entitySet = context.entitySet;
        entities = _.reduce( context.entitySet.models, function(result, entity){
            var i,len,filter;
            var ebf = entity.getComponentBitfield();
            for( i=0;i<filtersLength;i++ ){
                filter = filters[i];
                if( !EntityFilter.accept( filter.type, ebf, filter.bitField, false ) ){
                    // log.debug(entity.getEntityId() + ' accept with ' + Utils.stringify(filter) + ' FALSE');
                    return result;
                }
            }
            // log.debug( entity.getEntityId() + ' accept with ' + Utils.stringify(filter) + ' TRUE');
            result.push( entity );
            return result;
        }, []);

        result = context.registry.createEntitySet( null, {register:false} );
        result.addEntity( entities );

        return (context.last = [ Query.VALUE, result ]);
    } else {
        // var i,len,filter;
        ebf = context.entity.getComponentBitfield();
        for( i=0;i<filtersLength;i++ ){
            filter = filters[i];
            if( !EntityFilter.accept( filter.type, ebf, filter.bitField, false ) ){
                return (context.last = [ Query.VALUE, false ]);
            }
        }
        return (context.last = [ Query.VALUE, true ]);
    }
}


/**
*   Returns the attribute values of specified components in the specified
*   entitySet 
*/
function commandPluck( context, entitySet, components, attributes, options ){
    // resolve the components to ids
    var bitField, componentIds, result;

    if( context.debug ){ log.debug('cmd pluck'); } 

    attributes = _.isArray( attributes ) ? attributes : [ attributes ];

    componentIds = context.registry.getIId( components, true );
    // bitField = BitField.create().setValues( componentIds );

    entitySet = resolveEntitySet( context, entitySet );

    // iterate through each of the entityset models and select the components
    // specified - if they exist, select the attributes required.
    result = _.reduce( entitySet.models, function(result, entity){
        _.each( componentIds, function(id){
            var component = entity.components[ id ];
            if( !component ){ return; }
            
            _.each( attributes, function(attr){
                result.push( component.get.call( component, attr ) );    
            });
        });

        return result;
    }, []);

    if( options && options.unique ){
        result = _.uniq( result );
    }

    // if( context.debug ){ log.debug('cmd pluck result ' + Utils.stringify([ Query.VALUE, result, 'array' ])); } 

    return (context.last = [ Query.VALUE, result ]);
}


/**
*   Takes the attribute value of the given component and returns it
*
*   This command operates on the single entity within context.
*/
function commandComponentAttribute( context, components, attributes ){
    var componentIds, components, result;
    if( context.debug ){ log.debug('ATTR> ' + Utils.stringify( _.rest(arguments))  ); } 
    
    if( !attributes ){
        attributes = components[1]; //_.rest(components);
        components = components[0];
    }

    if( !context.entity ){
        // if( context.debug ){ log.debug('  no entity ' + context  ); }
        return (context.last = [ Query.VALUE, null ] );
    }

    attributes = _.isArray( attributes ) ? attributes : [attributes];
    componentIds = context.registry.getIId( components, true );
    // components = context.entity.getComponentByIId( componentIds );
    components = context.entity.components;
    result = [];

    // if( context.debug ){ log.debug('  ' + JSON.stringify(componentIds) ); }
    _.each( componentIds, function(id){
        var component = components[ id ];
        if( !component ){ return; }
        
        _.each( attributes, function(attr){
            // if( context.debug ){ log.debug('  ' + attr + ' ' + component.get.call( component, attr ) ); }
            result.push( component.get.call( component, attr ) );    
        });
    });

    if( result.length === 0 ){
        result = null;
    } else if( result.length === 1 ){
        result = result[0];
    }

    return (context.last = [ Query.VALUE, result ] );
}


/**
*   Returns the referenced value of the passed value providing it is a Query.VALUE
*/
function valueOf( context, value, shouldReturnValue ){
    var command;
    if( context.debug ){ log.debug('valueOf: ' + Utils.stringify(value) ); }
    if( _.isArray(value) ){
        if( value[0] === Query.VALUE ){
            return value[1];
        }
        
        command = value[0]; //value.shift();
        // if( context.debug ){ log.debug('valueOf: cmd ' + command + ' ' + Utils.stringify(value) )}
        value = executeCommand( context, value );

        if( context.debug ){ log.debug('valueOf exec: ' + Utils.stringify(value) )}

        if( value[0] === Query.VALUE ){
            return value[1];
        }
    }
    if( shouldReturnValue ){
        return value;
    }
    return null;
}


function commandPrint( context ){
    var result;
    var args = _.rest( arguments );

    result = _.map( args, function(arg){
        return valueOf( context, arg, true );
    }).join(' ');

    log.debug( 'PRINT ' + result );

    return (context.last = [Query.VALUE], result );
}

/**
*   Compares the two operands for equality and returns 
*   a VALUE with the boolean result of that comparison
*/
function commandEquals( context, op1, op2 ){
    var result;
    var value1;
    var value2;

    result = false;

    if( context.debug ){ log.debug('EQUALS op1: ' + Utils.stringify(op1) ); }
    if( context.debug ){ log.debug('EQUALS op2: ' + Utils.stringify(op2) ); }

    value1 = valueOf( context, op1, true );
    value2 = valueOf( context, op2, true );


    if( context.debug ){ log.debug('EQUALS cmd equals ' + JSON.stringify(value1) + ' === ' + JSON.stringify(value2) ); }

    if( value1 === value2 ){
        result = true;
    } else {
        // in the case that the 2nd value is an array, check whether
        // value1 exists within it
        if( _.isArray(value2) ){
            if( _.indexOf(value2, value1) !== -1 ){
                result = true;
            }
            else if( Utils.deepEqual( value1, value2 ) ){
                result = true;
            }
        }
    }

    // if( context.debug && !result ){ log.debug('no equality for ' + JSON.stringify(value1) + ' ' + JSON.stringify(value2) ) };

    return (context.last = [ Query.VALUE, result ]);
}

function commandAnd( context, ops ){
    var i,len,value;
    var ops;

    ops = _.rest( arguments );

    for( i=0,len=ops.length;i<len;i++ ){
        value = valueOf( context, ops[i], true );
        if( !value ){
            break;
        }
    }
    
    return (context.last = [ Query.VALUE, value ]);
}

function commandOr( context, ops ){
    var i,len,value;
    var ops;

    ops = _.rest( arguments );

    for( i=0,len=ops.length;i<len;i++ ){
        value = valueOf( context, ops[i], true );
        if( value ){
            break;
        }
    }
    
    return (context.last = [ Query.VALUE, value ]);
}

/**
*   Stores or retrieves a value with the given name in the context
*/
function commandAlias( context, name, value ){
    context.alias = (context.alias || {});

    
    name = valueOf( context, name, true );
    value = valueOf( context, value, true );
    
    if( !value ){
        if( context.debug ){ log.debug('cmd alias ' + Utils.stringify(name)); } 
        value = context.alias[ name ];
    } else {
        if( context.debug ){ log.debug('cmd alias ' + Utils.stringify(name) + ' ' + Utils.stringify(value)); } 

        context.alias[ name ] = value;
    }

    return (context.last = [ Query.VALUE, value ] );
}

/**
*
*/
function commandSelectEntityById( context, entitySet, entityIds ){
    var entities, value;

    entitySet = resolveEntitySet( context, entitySet );

    entityIds = valueOf( context, entityIds, true );

    entities = _.reduce( entityIds, function( result,id){
        var entity = entitySet.get( id );
        if( entity ){
            result.push( entity );
        }
        return result;
    }, []);

    value = context.registry.createEntitySet( null, {register:false} );
    value.addEntity( entities );

    return (context.last = [ Query.VALUE, value ]);
}

function commandWithout( context, array, values ){
    var value;
    if( context.debug ){ log.debug('cmd without ' + Utils.stringify(array)); }
    
    value = array = valueOf( context, array, true );
    values = valueOf( context, values, true );

    if( _.isArray(array) && values ){
        value = _.without( array, values );
    }

    return (context.last = [Query.VALUE, value]);
}

function commandNoOp( context, value ){

}

/**
*   Takes an entityset and applies the filter to it resulting
*   in a new entityset which is returned as a value.
*/
function commandFilter( context, entitySet, filterFunction ){
    var entities, entityContext, value;
    // if( context.debug ){ log.debug('cmd filter '); printIns( _.rest(arguments)); } 

    entitySet = resolveEntitySet( context, entitySet );

    entityContext = _.extend( {}, context );
    entityContext.entitySet = entitySet;
    
    if( filterFunction ){
        var fn = filterFunction;
        
        // if( context.debug ){ log.debug('eval function ' + Utils.stringify(fn)); }

        entities = _.reduce( entitySet.models, function(result, entity){
            var cmdResult;

            // if( context.debug ){ log.debug('eval function ' + Utils.stringify(fn)); }
            // if( context.debug ){ log.debug('eval function ' + Utils.stringify(filterFunction)); }

            entityContext.entity = entity;
            entityContext.debug = false;

            cmdResult = executeCommand( entityContext, filterFunction );

            if( context.debug ){ log.debug('eval function ' + Utils.stringify(filterFunction) + ' ' + Utils.stringify(cmdResult) ); }

            if( valueOf( context, cmdResult ) === true ){
                result.push( entity );
            }
            return result;
        }, []);

        if( context.debug ){ log.debug('cmd filter result length ' + entities.length ); }

        value = context.registry.createEntitySet( null, {register:false} );
        value.addEntity( entities );
    } else {
        // printIns( context, 1 );
        value = context.registry.createEntitySet( null, {register:false} );
        value.addEntity( entitySet );    
    }

    return (context.last = [ Query.VALUE, value ]);
}


function executeCommand( context, op, args ){
    var result, op;

    if( context.debug){ log.debug('executing ' + Utils.stringify( _.rest(arguments)) ); }

    if( !args ){
        // assume the op and args are in the same array
        args = _.rest( op );
        op = op[0];
    }

    // prepend the context to the beginning of the arguments
    args = [context].concat( args );

    context.op = op;

    switch( op ){
        case Query.VALUE:
            result = command;
            break;
        case Query.ATTR:
            result = commandComponentAttribute.apply( null, args );
            break;
        case Query.EQUALS:
            result = commandEquals.apply( null, args );
            break;
        case Query.AND:
            result = commandAnd.apply( null, args );
            break;
        case Query.OR:
            result = commandOr.apply( null, args );
            break;
        case Query.PLUCK:
            result = commandPluck.apply( null, args );
            break;
        case Query.ENTITY_FILTER:
            result = commandEntityFilter.apply( null, args );
            break;
        case Query.FILTER:
            result = commandFilter.apply( context, args );
            break;
        case Query.ALIAS:
            result = commandAlias.apply( null, args );
            break;
        case Query.DEBUG:
            // log.debug('debugging from here ');
            // printIns( args, 1 );
            context.debug = args[1];
            break;
        case Query.PRINT:
            result = commandPrint.apply( null, args );
            break;
        case Query.SELECT_BY_ID:
            result = commandSelectEntityById.apply( null, args );
            break;
        case Query.WITHOUT:
            result = commandWithout.apply( null, args );
            break;
        case Query.NOOP:
            result = commandNoOp.apply( null, args );
            break;
        default:
            log.debug('unknown cmd ' + op);
            printIns( _.rest(arguments), 1 );
            throw new Error('unknown cmd ' + op + ' ' + Utils.stringify(_.rest(arguments)) );
            break;
    }

    return result;
}


Query.execute = function executeQuery( entitySet, commands, options ){
    var i,len, command, context, result, args;
    var stack = [];
    if( !_.isArray(commands[0]) ){
        commands = [ commands ];
    }

    context = _.extend({
        entitySet: entitySet,
        registry: entitySet ? entitySet.getRegistry() : null,
        batchComponentFilter: true, // component filters will be batched together into a single op
    },options);

    // // log.debug('go with ' + Utils.stringify(commands) );
    // for( i=0,len=commands.length;i<len;i++ ){
    //     command = commands[i];

    //     // handle value
    //     if( _.isArray(command) || command === Query.LEFT_PAREN || command === Query.RIGHT_PAREN ){
    //         stack.push( command );
    //     } else {
    //         // operator
    //         // pull arguments from the stack
    //         args = popArgumentsFromStack( stack );
    //         log.debug('executing command ' + command + ' with stack ' + Utils.stringify( args ) );
    //         result = executeCommand( context, command, args );
    //     }
    // }

    for( i=0,len=commands.length;i<len;i++ ){
        command = commands[i];
        result = executeCommand( context, command );
    }

    return result;
}


module.exports = Query;