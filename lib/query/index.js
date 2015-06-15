'use strict';

var _ = require('underscore');

var BitField = require('../bit_field');
var Entity = require('../entity');
var EntitySet = require('../entity_set');
var EntityFilter = require('../entity_filter');
var Utils = require('../utils');

function Query(){}

Query.argCounts = {};
Query.precendenceValues = {};
Query.compileCommands = {};
Query.commandFunctions = {};

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
    // FILTER: 17,
    // ADD_ENTITIES: 18,
    ATTR: 19,
    // PLUCK: 20,
    // ALIAS: 21,
    // DEBUG: 22,
    // PRINT: 23,
    // WITHOUT: 25,
    // NOOP: 26,
    LEFT_PAREN: 27,
    RIGHT_PAREN: 28,
    // MEMBER_OF: 29,
    ENTITY_FILTER: 30,
    // ALIAS_GET: 31,
    PIPE: 32,
    // SELECT_BY_ID: 33,
    ALL_FILTER: 34,
    NONE_FILTER: 35,
    FILTER_FUNC: 36,
    ANY_FILTER: 37,
});



/**
*   Query functions for the memory based entity set.   
*
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/



function createEntityFilter( type, bitField ){
    return { isEntityFilter:true, type:type, bitField:bitField };
}

function gatherComponentFilters( context, expression, single ){
    var ii,len,bf,result, obj,filter;
    
    result = [];

    // log.debug('gatherComponentFilters ' + Utils.stringify(expression) );

    switch( expression[0] ){
        case Query.ANY:
        case Query.ALL:
        case Query.ALL_FILTER:
        case Query.NONE:
        case Query.NONE_FILTER:
            // if( expression[0] === Query.VALUE ){
            //     obj = expression[1];
            // }
            // log.debug('gCF ' + Utils.stringify(expression) );
            if( expression[1] === Query.ROOT ){
                return [Query.VALUE, context.entitySet];
            }
            obj = Query.valueOf( context, expression[1], true );
            
            bf = componentsToBitfield( context, obj );
            // } catch( e ){
            //     throw new Error('could not get component ids for ' + Utils.stringify(expression) );
            // }
            filter = expression[0];
            if( filter === Query.ALL_FILTER ){
                filter = Query.ALL;
            } else if( filter === Query.NONE_FILTER ){
                filter = Query.NONE;
            }
            obj = createEntityFilter( filter, bf );
            // log.debug('converted ' + JSON.stringify( obj ) );
            result.push( obj );
            break;
        case Query.AND:
            // log.debug('AND ' + Utils.stringify(_.rest(expression)) );
            expression = _.rest(expression);

            for( ii=0,len=expression.length;ii<len;ii++ ){
                obj = gatherComponentFilters(context,expression[ii]);
                if( !obj ){
                    return null;
                }
                result = result.concat( obj );
            }
            break;
        default:
            return null;
    }
    if( single && result.length === 1 ){
        return result[0];
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
    var op, result;
    if( entitySet === Query.ROOT ){
        return context.entitySet;
    }

    if( _.isArray(entitySet) ){
        if( compileOnly ){
            return entitySet;
        }

        // log.debug('resolveEntitySet valueOf ' + entitySet );
        return Query.valueOf( context, entitySet );
    }

    if( EntitySet.isEntitySet(entitySet) ){
        return entitySet;
    }

    return null;
}


function componentsToBitfield( context, components ){
    var componentIds, result;
    // log.debug('lookup ' + Utils.stringify(components) );
    componentIds = context.registry.getIId( components, true );
    result = BitField.create();
    result.setValues( componentIds, true );
    return result;
}



function resolveComponentIIds( context, components ){
    if( _.isArray(components) && components[0] === Query.VALUE ){
        components = components[1];
    }
    components = Query.valueOf( context, components, true );
    return context.registry.getIId( components, true );
}

Query.resolveComponentIIds = resolveComponentIIds;


/**
*   Returns the referenced value of the passed value providing it is a Query.VALUE
*/
Query.valueOf = function valueOf( context, value, shouldReturnValue ){
    var command;
    // if( context.debug ){ log.debug('valueOf: ' + Utils.stringify(value) ); }
    if( _.isArray(value) ){
        command = value[0]; //value.shift();
        if( command === Query.VALUE ){
            if( value[1] === Query.ROOT ){
                return context.root;
            }
            return value[1];
        } else if( command === Query.ROOT ){
            return context.root;
        }
        
        // if( context.debug ){ log.debug('valueOf: cmd ' + command + ' ' + Utils.stringify(value) )}
        value = executeCommand( context, value );

        // if( context.debug ){ log.debug('valueOf exec: ' + Utils.stringify(value) )}

        if( value[0] === Query.VALUE ){
            return value[1];
        }
    }
    if( shouldReturnValue ){
        return value;
    }
    return null;
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
    var ii,len,value;
    var ops;

    ops = _.rest( arguments );

    for( ii=0,len=ops.length;ii<len;ii++ ){
        value = Query.valueOf( context, ops[ii], true );
        if( !value ){
            break;
        }
    }
    
    return (context.last = [ Query.VALUE, value ]);
}

function commandOr( context, ops ){
    var ii,len,value;
    var ops;

    ops = _.rest( arguments );

    for( ii=0,len=ops.length;ii<len;ii++ ){
        value = Query.valueOf( context, ops[ii], true );
        if( value ){
            break;
        }
    }
    
    return (context.last = [ Query.VALUE, value ]);
}



// /**
// *   Takes an entityset and applies the filter to it resulting
// *   in a new entityset which is returned as a value.
// */
function commandFilter( context, entityFilter, filterFunction, options ){
    var entities, entityContext, value;
    var entity, entitySet;
    var debug = context.debug;
    if( debug ){ log.debug('cmd filter >'); printIns( _.rest(arguments)); log.debug('<'); } 

    // resolve the entitySet argument into an entitySet or an entity
    // the argument will either be ROOT - in which case the context entityset or entity is returned,
    // otherwise it will be some kind of entity filter
    // entitySet = Query.resolveEntitySet( context, entitySet );
    entitySet = Query.valueOf( context, context.last || context.entitySet, true );

    entityContext = _.extend( {}, context );

    if( Entity.isEntity(entitySet) ){
        entityContext.entity = entity = entitySet;
        entityContext.entitySet = entitySet = null;
    }

    entityContext.entityFilter = entityFilter;
    entityContext.componentIds = entityFilter.bitField.toValues();

    if( filterFunction ){
        var fn = filterFunction;
        
        // if( debug ){ log.debug('eval function ' + Utils.stringify(fn)); }

        if( entity ){
            value = executeCommand( entityContext, filterFunction );
            if( value[0] === Query.VALUE ){
                value = value[1] ? context.entity : null;
            }
            // log.debug("FILTER ENTITY " );printIns( value );
        } else {
            // select the subset of the entities which pass through the filter
            entities = _.reduce( entitySet.models, function(result, entity){
                var cmdResult;

                entityContext.entity = entity;
                entityContext.debug = false;
                // ebf = entity.getComponentBitfield();

                cmdResult = executeCommand( entityContext, filterFunction );

                // if( debug ){ log.debug('eval function ' + Utils.stringify(filterFunction) + ' ' + Utils.stringify(cmdResult) ); }

                if( Query.valueOf( context, cmdResult ) === true ){
                    result.push( entity );
                }
                return result;
            }, []);

            if( debug ){ log.debug('cmd filter result length ' + entities.length ); }

            value = context.registry.createEntitySet( null, {register:false} );
            value.addEntity( entities );
        }

    } else {
        if( entity ){
            value = entitySet ? entity : null;
        } else {
            value = context.registry.createEntitySet( null, {register:false} );
            value.addEntity( entitySet );    
        }
    }

    return (context.last = [ Query.VALUE, value ]);
}


/**
*   Takes the attribute value of the given component and returns it
*
*   This command operates on the single entity within context.
*/
function commandComponentAttribute( context, attributes ){
    var componentIds, components, result;
    var entity = context.entity;
    componentIds = context.componentIds;

    // printIns( context,1 );
    if( context.debug ){ log.debug('ATTR> ' + Utils.stringify(componentIds) + ' ' + Utils.stringify( _.rest(arguments))  ); } 

    if( !componentIds ){
        throw new Error('no componentIds in context');
    }
    
    if( !entity ){
        log.debug('ATTR> no entity');
        return (context.last = [ Query.VALUE, null ] );
    }

    attributes = _.isArray( attributes ) ? attributes : [attributes];

    components = entity.components;
    result = [];

    if( context.debug ){log.debug('ATTR> e' 
        + entity.getEntityId() 
        + ' coms: ' + Utils.stringify(_.map( _.compact(entity.components), function(c){ return c.schemaIId; }))); }

    _.each( componentIds, function(id){
        var component = components[ id ];
        if( !component ){ return; }
        
        _.each( attributes, function(attr){
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


function commandEntityFilter( context, filters ){
    var entitySet, entity, entities,filtersLength,result,ii,ebf,filter;
    if( context.debug ){ log.debug('commandEntityFilter'); }

    filters = _.isArray(filters) ? filters : [filters];
    filtersLength = filters.length;

    if( context.entity ){
        // printIns( context.entity );
        // if( context.debug ){ log.debug('commandEntityFilter> entity ' + context.entity.getEntityId() ); }
        // filter the entity using the component filters - returns a boolean
        ebf = context.entity.getComponentBitfield();
        for( ii=0;ii<filtersLength;ii++ ){
            filter = filters[ii];
            if( !EntityFilter.accept( filter.type, ebf, filter.bitField, false ) ){
                return (context.last = [ Query.VALUE, null ]);
            }
        }
        // if( context.debug ){ log.debug('commandEntityFilter> entity ' + context.entity.cid + ' passed' ); }
        return (context.last = [ Query.VALUE, context.entity ]);
    }
    else {
        // filter the entitySet using the component filters
        entitySet = context.entitySet;
        entities = _.reduce( context.entitySet.models, function(result, entity){
            var ii,len,filter;
            var ebf = entity.getComponentBitfield();
            for( ii=0;ii<filtersLength;ii++ ){
                filter = filters[ii];
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




Query.commandFunction = function commandFunction( op ){
    var result;

    result = Query.commandFunctions[ op ];
    if( result !== undefined ){
        return result;
    }

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
        case Query.ENTITY_FILTER:
            result = commandEntityFilter;
            break;
        case Query.FILTER_FUNC:
        case Query.ALL_FILTER:
            result = commandFilter;
            break;
        default:
            log.debug('no cmd func found for ' + op + ' ' + typeof op );
            // log.debug('nothing found for ' + op );
            printIns( Query.commandFunctions );
            break;
    }
    return result;
}


function executeCommand( context, op, args ){
    var result, op, cmdFunction, cmdArgs, value;

    if( context.debug){ log.debug('executing ' + Utils.stringify( _.rest(arguments)) ); }

    if( !args ){
        // assume the op and args are in the same array
        args = _.rest( op );
        op = op[0];
    }

    // prepend the context to the beginning of the arguments
    cmdArgs = [context].concat( args );

    context.op = op;

    switch( op ){
        case Query.ROOT:
            result = (context.last = [ Query.VALUE, context.root ]);
            break;
        case Query.VALUE:
            value = args[0];
            if( value === Query.ROOT ){
                value = context.root;
            }
            result = (context.last = [ Query.VALUE, value ]);
            if(context.debug){ log.debug('value> ' + Utils.stringify(context.last)) }
            break;
        case Query.EQUALS:
        case Query.LESS_THAN:
        case Query.LESS_THAN_OR_EQUAL:
        case Query.GREATER_THAN:
        case Query.GREATER_THAN_OR_EQUAL:
            result = commandEquals.apply( context, cmdArgs.concat(op) );
            break;
        default:
            cmdFunction = Query.commandFunction( op );
            if( !cmdFunction ){
                log.debug('unknown cmd ' + op);
                printIns( _.rest(arguments), 1 );
                throw new Error('unknown cmd (' + op + ') ' + Utils.stringify(_.rest(arguments)) );
            }
            result = cmdFunction.apply( context, cmdArgs );  
            break;
    }
    return result;
}


Query.compile = function compileQuery( context, commands, options ){
    var result, ii, len, entityFilters;

    
    if( Query.isQuery( commands ) ){
        if( commands.isCompiled ){
            return commands;
        }
        commands = (commands.src || commands.toArray( true ));
    } else if( _.isArray(commands) ){
        // log.debug('compile> ' + Utils.stringify(commands));
        // we may have been passed a single command
        if( !_.isArray(commands[0]) && !Query.isQuery(commands[0])){
            commands = [commands];
        }
        commands = _.map( commands, function(command){
            if( Query.isQuery(command) ){
                if( !command.isCompiled ){
                    command = command.toArray(true)[0];
                }
                // command = command.isCompiled ? command || command.toArray(true)[0];
            }
            // log.debug('compile> ' + Utils.stringify(command));
            return command;
        });
        // log.debug('compile> ' + Utils.stringify(commands));
    }

    result = new Query();
    result.isCompiled = true;
    result.src = Utils.deepClone(commands);

    // printIns( result.src, 6 );

    commands = _.reduce( commands, function(result,command){
        var op, filters, compileResult;
        op = command[0];

        // check for registered command compile function
        if( (compileResult = Query.compileCommands[ op ]) !== undefined ){
            if( (compileResult = compileResult( context, command )) ){
                result.push( compileResult );
            }
            return result;
        }

        switch( op ){
            case Query.ALL:
            case Query.NONE:
            case Query.ANY:
                filters = gatherComponentFilters( context, command );
                result.push( [ Query.ENTITY_FILTER, filters ] );
                break;
            case Query.NONE_FILTER:
            case Query.ALL_FILTER:
                filters = gatherComponentFilters( context, command, true );
                result.push( [ Query.ENTITY_FILTER, filters ] );
                result.push( [ command[0], filters, command[2] ] );
                break;
            case Query.AND:
                result.push( (Query.resolveEntitySet( context, command, true ) || command) );
                break;
            default:
                result.push( command );
                break;
        }

        return result;
    },[]);

    

    result.commands = [];
    entityFilters = [];

    // combine contiguous entity filters
    for( ii=0,len=commands.length;ii<len;ii++ ){
        while( ii<len && commands[ii][0] === Query.ENTITY_FILTER ){
            entityFilters.push( commands[ii][1] );
            ii += 1;
        }
        if( entityFilters.length > 0 ){
            result.commands.push( [ Query.ENTITY_FILTER, _.flatten(entityFilters) ] );
            entityFilters = [];
        }
        if( ii < len ){
            result.commands.push( commands[ii] );
        }
    }
    // result.commands = commands;
    if( context.debug ) { printIns( result, 6 ); }
    return result;
}

/**
*
*/
Query.commands = function( commands ){
    var result;
    commands = _.toArray(arguments);

    result = new Query();
    result.src = _.map( commands, function(command){ return command.toArray(true)[0]; });

    return result;
}

Query.execute = function executeQuery( entity, query, options ){
    var ii,len, command, context, result, args, commandResult;
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
        context = { entitySet: entity }
    } else if( Entity.isEntity( entity ) ){
        context = { entity: entity }
    } else {
        context = {entitySet:null};
    }

    context.root = (context.entity || context.entitySet);
    context.registry = context.root ? context.root.getRegistry() : null;
    context.last = [Query.VALUE, context.root];
    context.debug = options ? options.debug : false;

    query = Query.compile( context, query, options );

    if( context.debug ){log.debug('commands:'); printIns( query,1 ); }

    for( ii=0,len=query.commands.length;ii<len;ii++ ){
        command = query.commands[ii];
        // log.debug('go ' + Utils.stringify(command) );
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




Query.registerCommand = function( options ){
    if( options.commands ){
        return _.each( options.commands, function(c){ return Query.registerCommand(c); } );
    }

    Query[ options.name ] = options.id;
    // console.log( options );
    if( options.dsl ){
        _.each( options.dsl, function(func,name){
            // console.log('adding dsl ' + name + ' as ' + func);
            Query[name] = func;
        })
    }
    if( options.argCount ){
        Query.argCounts[ options.id ] = options.argCount;
    }
    if( Query.commandFunctions[ options.id ] !== undefined ){
        throw new Error('already registered cmd ' + options.id );
    }
    if( options.compile ){
        Query.compileCommands[ options.id ] = options.compile;
    }
    Query.commandFunctions[ options.id ] = options.command;
}


Query.prototype.hash = function(){
    var rep = (( this.isCompiled ) ? this.src : this.toArray(true));
    log.debug('hashing ' + JSON.stringify(rep) );
    return Utils.hash( JSON.stringify(rep), true );
}

Query.prototype.compile = function( registry, options ){
    return Query.create( registry, this, options );
}

Query.prototype.execute = function( context, options ){
    return Query.execute( context, this, options );
}

Query.isQuery = function( query ){
    return query && query instanceof Query;
}

Query.create = function( registry, commands, options ){
    var context = _.extend({
        registry: registry
    }, options);

    var result = Query.compile( context, commands, options );
    return result;
}

module.exports = Query;