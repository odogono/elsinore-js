'use strict';

var _ = require('underscore');

var BitField = require('../bit_field');
var Entity = require('../entity');
var EntitySet = require('../entity_set');
var EntityFilter = require('../entity_filter');
var Utils = require('../utils');

function Query(){}


_.extend(Query.prototype, {
    type: 'Query',
    isQuery: true,
});

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
    WITHOUT: 25,
    NOOP: 26,
    LEFT_PAREN: 27,
    RIGHT_PAREN: 28,
    MEMBER_OF: 29,
    ENTITY_FILTER: 30,
    ALIAS_GET: 31,
});



/**
*   Query functions for the memory based entity set.   
*
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/



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
Query.resolveEntitySet = function resolveEntitySet( context, entitySet, compileOnly ){
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

            // log.debug('we now have a filter ' + Utils.stringify(entitySet) );
        }

        if( compileOnly ){
            return entitySet;
        }

        return Query.valueOf( context, entitySet );
    }

    if( EntitySet.isEntitySet(entitySet) ){
        return entitySet;
    }

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
    if( context.debug ){ log.debug('commandEntityFilter'); }

    filters = _.isArray(filters) ? filters : [filters];
    filtersLength = filters.length;

    if( context.entity ){
        // filter the entity using the component filters - returns a boolean
        ebf = context.entity.getComponentBitfield();
        for( i=0;i<filtersLength;i++ ){
            filter = filters[i];
            if( !EntityFilter.accept( filter.type, ebf, filter.bitField, false ) ){
                return (context.last = [ Query.VALUE, null ]);
            }
        }
        return (context.last = [ Query.VALUE, context.entity ]);
    }
    else {
        // filter the entitySet using the component filters
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

    entitySet = Query.resolveEntitySet( context, entitySet );

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

function resolveComponentIIds( context, components ){
    componentIds = context.registry.getIId( components, true );
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
Query.valueOf = function valueOf( context, value, shouldReturnValue ){
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
        return Query.valueOf( context, arg, true );
    }).join(' ');

    log.debug( 'PRINT ' + result );

    return (context.last = [Query.VALUE], result );
}

/**
*   Compares the two operands for equality and returns 
*   a VALUE with the boolean result of that comparison
*/
function commandEquals( context, op1, op2, op ){
    var result;
    var value1;
    var value2;
    var isValue1Array, isValue2Array;
    result = false;

    if( context.debug ){ log.debug('EQUALS op1: ' + Utils.stringify(op1) ); }
    if( context.debug ){ log.debug('EQUALS op2: ' + Utils.stringify(op2) ); }

    value1 = Query.valueOf( context, op1, true );
    value2 = Query.valueOf( context, op2, true );
    isValue1Array = _.isArray(value1);
    isValue2Array = _.isArray(value2);

    if( context.debug ){ log.debug('EQUALS cmd equals ' + JSON.stringify(value1) + ' === ' + JSON.stringify(value2) ); }

    if( !isValue1Array && !isValue2Array ){
        switch( op ){
            case Query.LESS_THAN:
                result = (value1 < value2);
                break;
            case Query.LESS_THAN_OR_EQUAL:
                result = (value1 <= value2);
                break;
            case Query.GREATER_THAN:
                result = (value1 > value2);
                break;
            case Query.GREATER_THAN_OR_EQUAL:
                result = (value1 >= value2);
                break;
            default:
                result = (value1 === value2);
                break;
        }
    } else {
        switch( op ){
            case Query.LESS_THAN:
            case Query.LESS_THAN_OR_EQUAL:
            case Query.GREATER_THAN:
            case Query.GREATER_THAN_OR_EQUAL:
                result = false;
                break;
            default:
                // log.debug('hmm ok ' + JSON.stringify(value2) );
                if( isValue2Array && !isValue1Array ){
                    result = (_.indexOf(value2,value1) !== -1);
                } else {
                    result = Utils.deepEqual( value1, value2 );
                }
                break;
        }
    }
    return (context.last = [ Query.VALUE, result ]);
}

function commandAnd( context, ops ){
    var i,len,value;
    var ops;

    ops = _.rest( arguments );

    for( i=0,len=ops.length;i<len;i++ ){
        value = Query.valueOf( context, ops[i], true );
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
        value = Query.valueOf( context, ops[i], true );
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

    
    name = Query.valueOf( context, name, true );
    value = Query.valueOf( context, value, true );
    
    if( !value ){
        if( context.debug ){ log.debug('cmd alias ' + Utils.stringify(name)); } 
        value = context.alias[ name ];
    } else {
        if( context.debug ){ log.debug('cmd alias ' + Utils.stringify(name) + ' ' + Utils.stringify(value)); } 

        context.alias[ name ] = value;
    }

    return (context.last = [ Query.VALUE, value ] );
}


function commandWithout( context, array, values ){
    var value;
    if( context.debug ){ log.debug('cmd without ' + Utils.stringify(array)); }
    
    value = array = Query.valueOf( context, array, true );
    values = Query.valueOf( context, values, true );

    if( _.isArray(array) && values ){
        value = _.without( array, values );
    }

    return (context.last = [Query.VALUE, value]);
}


/**
*   Takes an entityset and applies the filter to it resulting
*   in a new entityset which is returned as a value.
*/
function commandFilter( context, entitySet, filterFunction, options ){
    var entities, entityContext, value;
    if( context.debug ){ log.debug('cmd filter >'); printIns( _.rest(arguments)); log.debug('<'); } 

    // printIns( entitySet );
    // log.debug('is entityset ' + EntitySet.isEntitySet(entitySet) );

    // resolve the entitySet argument into an entitySet or an entity
    // the argument will either be ROOT - in which case the context entityset or entity is returned,
    // otherwise it will be some kind of entity filter
    entitySet = Query.resolveEntitySet( context, entitySet );

    // log.debug('>resolved entitySet ' ); printIns( entitySet ); log.debug('<resolved entitySet');

    entityContext = _.extend( {}, context );
    entityContext.entitySet = entitySet;
    
    if( filterFunction ){
        var fn = filterFunction;
        
        if( context.debug ){ log.debug('eval function ' + Utils.stringify(fn)); }

        if( context.entity ){
            value = executeCommand( context, filterFunction );
            if( value[0] === Query.VALUE ){
                value = value[1] ? context.entity : null;
            }
            // log.debug("FILTER ENTITY " );printIns( value );
        } else {
            entities = _.reduce( entitySet.models, function(result, entity){
                var cmdResult;

                entityContext.entity = entity;
                entityContext.debug = false;

                cmdResult = executeCommand( entityContext, filterFunction );

                if( context.debug ){ log.debug('eval function ' + Utils.stringify(filterFunction) + ' ' + Utils.stringify(cmdResult) ); }

                if( Query.valueOf( context, cmdResult ) === true ){
                    result.push( entity );
                }
                return result;
            }, []);

            if( context.debug ){ log.debug('cmd filter result length ' + entities.length ); }

            value = context.registry.createEntitySet( null, {register:false} );
            value.addEntity( entities );
        }

    } else {
        if( context.entity ){
            value = entitySet ? context.entity : null;
        } else {
            value = context.registry.createEntitySet( null, {register:false} );
            value.addEntity( entitySet );    
        }
    }

    return (context.last = [ Query.VALUE, value ]);
}



Query.commandFunction = function commandFunction( op ){
    var result;

    switch( op ){
        case Query.ATTR:
            result = commandComponentAttribute;
            break;
        case Query.EQUALS:
            result = commandEquals;
            break;
        case Query.AND:
            result = commandAnd;
            break;
        case Query.OR:
            result = commandOr;
            break;
        case Query.PLUCK:
            result = commandPluck;
            break;
        case Query.ENTITY_FILTER:
            result = commandEntityFilter;
            break;
        case Query.FILTER:
            result = commandFilter;
            break;
        case Query.ALIAS:
            result = commandAlias;
            break;
        case Query.WITHOUT:
            result = commandWithout;
            break;
        default:
            break;
    }
    return result;
}


function executeCommand( context, op, args ){
    var result, op, cmdFunction;

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
        case Query.EQUALS:
        case Query.LESS_THAN:
        case Query.LESS_THAN_OR_EQUAL:
        case Query.GREATER_THAN:
        case Query.GREATER_THAN_OR_EQUAL:
            result = commandEquals.apply( context, args.concat(op) );
            break;
        default:
            cmdFunction = Query.commandFunction( op );
            if( !cmdFunction ){
                log.debug('unknown cmd ' + op);
                printIns( _.rest(arguments), 1 );
                throw new Error('unknown cmd ' + op + ' ' + Utils.stringify(_.rest(arguments)) );
            }
            result = cmdFunction.apply( context, args );  
            break;
    }

    // if( op === Query.VALUE ){
    //     result = command;
    // // } else if( op === Query.GREATER_THAN || op === Query.LESS_THAN )
    // } else {
    //     cmdFunction = Query.commandFunction( op );
    //     if( !cmdFunction ){
    //         log.debug('unknown cmd ' + op);
    //         printIns( _.rest(arguments), 1 );
    //         throw new Error('unknown cmd ' + op + ' ' + Utils.stringify(_.rest(arguments)) );
    //     }
    //     result = cmdFunction.apply( context, args );    
    // }
    return result;
}


function compileCommand( context, command ){
    var op, args;

    op = command[0];
    args = _.rest(command);

    switch( op ){
        case Query.FILTER:
            command[1] = Query.resolveEntitySet( context, command[1], true );
            if( command.length === 2 ){
                command = command[1];
            }
            break;
        case Query.ALL:
        case Query.NONE:
            command = [ Query.ENTITY_FILTER, gatherComponentFilters( context, command ) ];
            break;
        default:
            log.debug('compile op ' + op );
            break;
    }
    
    return command;
}

Query.compile = function compileQuery( context, commands, options ){
    var result;

    if( Query.isQuery( commands ) ){
        if( commands.isCompiled ){
            return commands;
        }
        commands = commands.toArray( true );
    } else if( !_.isArray(commands[0]) ){
        commands = [ commands ];
    }

    result = new Query();
    result.isCompiled = true;
    result.src = Utils.deepClone(commands);

    result.commands = _.map( commands, function(command){
        return compileCommand( context, command );
    });

    return result;
}

Query.execute = function executeQuery( entity, commands, options ){
    var i,len, command, context, result, args, commandResult;
    var stack = [];
    var returnValue = true; //(options && options.value);
    var returnLast = true;

    if( options && options.value === false ){
        returnLast = false;
    }

    if( options && options.result === false ){
        returnValue = false;
    }

    result = returnLast ? null : [];

    if( EntitySet.isEntitySet( entity ) ){
        context = {
            entitySet: entity,
            registry: entity.getRegistry(),    
        }
    } else if( Entity.isEntity( entity ) ){
        context = {
            entity: entity,
            registry: entity.getRegistry()
        }
    } else {
        context = {}
    }

    if( Query.isQuery( commands ) && commands.isCompiled ){
        commands = commands.commands;
    } else {
        commands = Query.compile( context, commands ).commands;
    }

    // printIns( commands );

    // if( Query.isQuery( commands ) ){
    //     if( commands.isCompiled ){
    //         commands = commands.commands;
    //     } else {
    //         commands = Query.compile( context, commands ).commands;
    //         // commands = commands.toArray( true );
    //     }
    // }

    // if( !_.isArray(commands[0]) ){
    //     commands = [ commands ];
    // }

    

    context = _.extend(context, {
        batchComponentFilter: true, // component filters will be batched together into a single op
    },options);


    for( i=0,len=commands.length;i<len;i++ ){
        command = commands[i];
        commandResult = executeCommand( context, command );
        if( returnValue ){
            commandResult = commandResult[1];
        }
        if( returnLast ){
            result = commandResult;
        } else {
            result.push( commandResult );
        }
    }

    if( returnLast ){
        return result;//[ result.length -1 ];
    }

    return result.length === 1 ? result[0] : result;
}

Query.prototype.toArray = function(){
    return [];
}

Query.prototype.hash = function(){
    var rep = (( this.isCompiled ) ? this.src : this.toArray(true));
    log.debug('hashing ' + JSON.stringify(rep) );
    return Utils.hash( JSON.stringify(rep), true );
}

Query.prototype.compile = function( registry, options ){
    var context;
    if( !registry ){ throw new Error('registry required');}
    context = { registry: registry };
    return Query.compile( context, this, options );
}

Query.prototype.execute = function( context, options ){
    return Query.execute( context, this, options );
}

Query.isQuery = function( query ){
    return query && query instanceof Query;
}

module.exports = Query;