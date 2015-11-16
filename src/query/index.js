import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import Entity from '../entity';
import EntitySet from '../entity_set';
import * as EntityFilter from '../entity_filter';
import * as Utils from '../util';

import {printIns} from '../util';

export default function Query(){}
function QueryContext(){}

Query.argCounts = {};
Query.precendenceValues = {};
Query.compileCommands = {};
Query.commandFunctions = {};
Query.compileHooks = [];

_.extend(Query.prototype, {
    type: 'Query',
    isQuery: true,
});



_.extend( Query, {
    ALL: 0, // entities must have all the specified components
    ANY: 1, // entities must have one or any of the specified components
    SOME: 2, // entities must have at least one of the specified component
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
    // PIPE: 32,
    // SELECT_BY_ID: 33,
    ALL_FILTER: 34,
    NONE_FILTER: 35,
    FILTER_FUNC: 36,
    ANY_FILTER: 37,
    INCLUDE_FILTER: 38
});



/**
*   Query functions for the memory based entity set.   
*
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/

function gatherEntityFilters( context, expression ){
    let ii,len,bf,result, obj;
    
    let filter = expression[0];
    result = EntityFilter.create();
    
    switch( filter ){
        case Query.ANY:
        case Query.ANY_FILTER:
        case Query.ALL:
        case Query.ALL_FILTER:
        case Query.NONE:
        case Query.NONE_FILTER:
        case Query.INCLUDE:
        case Query.INCLUDE_FILTER:
            if( expression[1] === Query.ROOT ){
                result.add( Query.ROOT );
            } else {
                obj = Query.valueOf( context, expression[1], true );
                
                if( !obj ){
                    if( filter == Query.ALL_FILTER ){
                        result.add( Query.ROOT );
                        return;
                    }
                    return null;
                }
                bf = context.componentsToBitfield( context, obj );
                
                // filter = expression[0];
                switch( filter ){
                    case Query.ALL_FILTER: filter = Query.ALL; break;
                    case Query.ANY_FILTER: filter = Query.ANY; break;
                    case Query.NONE_FILTER: filter = Query.NONE; break;
                    case Query.INCLUDE_FILTER: filter = Query.INCLUDE; break;
                }
                result.add( filter, bf );
            }
            break;
        case Query.AND:
            expression = _.rest(expression);

            for( ii=0,len=expression.length;ii<len;ii++ ){
                obj = gatherEntityFilters(context,expression[ii]);
                if( !obj ){
                    return null;
                }
                result.filters = result.filters.concat( obj.filters );
            }
            break;
        default:
            return null;
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
    let op, result;
    if( !entitySet ){
        entitySet = context.last;
    }

    if( entitySet === Query.ROOT ){
        return context.entitySet;
    }

    if( _.isArray(entitySet) ){
        if( compileOnly ){
            return entitySet;
        }
        entitySet = Query.valueOf( context, entitySet );
    }

    if( EntitySet.isEntitySet(entitySet) ){
        return entitySet;
    }

    return null;
}


QueryContext.prototype.componentsToBitfield = function( context, components ){
    let componentIds, result;
    // console.log('lookup ' + Utils.stringify(components) );
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
    return components ? context.registry.getIId( components, true ) : null;
}

Query.resolveComponentIIds = resolveComponentIIds;


/**
*   Returns the referenced value of the passed value providing it is a Query.VALUE
*/
Query.valueOf = function valueOf( context, value, shouldReturnValue ){
    let command;
    if( !value ){ return value; }
    // if( context.debug ){ console.log('valueOf: ' + Utils.stringify(value) ); }
    // console.log('valueOf: ' + Utils.stringify(value) );
    if( _.isArray(value) ){
        command = value[0];
        // if( !_.isArray(value[1]) ){
            // console.log('argle ' + JSON.stringify(value))
            // just a plain array
            // return value;
        // }

        if( command === Query.VALUE ){
            if( value[1] === Query.ROOT ){
                return context.root;
            }
            // console.log('return val[1] ' + value[1] );
            return value[1];
        } else if( command === Query.ROOT ){
            return context.root;
        }
        
        // if( context.debug ){ console.log('valueOf: cmd ' + command + ' ' + Utils.stringify(value) )}
        value = Query.executeCommand( context, value );

        // if( context.debug ){ console.log('valueOf exec: ' + Utils.stringify(value) )}

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
    let result;
    let value1;
    let value2;
    let isValue1Array, isValue2Array;
    result = false;

    if( context.debug ){ console.log('EQUALS op1: ' + Utils.stringify(op1) ); }
    if( context.debug ){ console.log('EQUALS op2: ' + Utils.stringify(op2) ); }

    value1 = Query.valueOf( context, op1, true );
    value2 = Query.valueOf( context, op2, true );
    isValue1Array = _.isArray(value1);
    isValue2Array = _.isArray(value2);

    if( context.debug ){ console.log('EQUALS cmd equals ' + JSON.stringify(value1) + ' === ' + JSON.stringify(value2) ); }

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
                if( isValue2Array && !isValue1Array ){
                    // console.log('index of ' + value1 + _.indexOf(value2,value1) );
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
    let ii,len,value;
    
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
    let ii,len,value;
    
    ops = _.rest( arguments );

    for( ii=0,len=ops.length;ii<len;ii++ ){
        value = Query.valueOf( context, ops[ii], true );
        if( value ){
            break;
        }
    }
    
    return (context.last = [ Query.VALUE, value ]);
}



/**
*   Takes an entityset and applies the filter to it resulting
*   in a new entityset which is returned as a value.
*/
QueryContext.prototype.commandFilter = function( context, entityFilter, filterFunction, options={} ){
    let entities, entityContext, value;
    let entity, entitySet;
    let debug = context.debug;
    let limit, offset;
    let esCount;

    limit = _.isUndefined(options.limit) ? 0 : options.limit;
    offset = _.isUndefined(options.offset) ? 0 : options.offset;

    if( debug ){ console.log('commandFilter >'); printIns( _.rest(arguments), 2); console.log('<'); } 

    // console.log('commandFilter> ' + offset + ' ' + limit );
    // resolve the entitySet argument into an entitySet or an entity
    // the argument will either be ROOT - in which case the context entityset or entity is returned,
    // otherwise it will be some kind of entity filter
    // entitySet = Query.resolveEntitySet( context, entitySet );
    entitySet = Query.valueOf( context, context.last || context.entitySet, true );

    if( Entity.isEntity(entitySet) ){
        entity = entitySet;
        // console.log('commandFilter> ' + entitySet.cid );
    }


    if( filterFunction ){
        entityContext = Query.createContext( context );// _.extend( {}, context );

        if( Entity.isEntity(entitySet) ){
            entityContext.entity = entity = entitySet;
            entityContext.entitySet = entitySet = null;
        }

        entityContext.entityFilter = entityFilter;
        entityContext.componentIds = entityFilter.getValues(0);
    }

    if( entity ){
        value = entity;
        if( entityFilter ){
            value = entityFilter.accept(value, context);
            // console.log('yep? ' + JSON.stringify(entity) );
        } 

        if( value && filterFunction ){
            entityContext.entity = value;
            value = Query.executeCommand( entityContext, filterFunction );
            if( value[0] === Query.VALUE ){
                value = value[1] ? context.entity : null;
            }
        }

    } else {
        value = context.registry.createEntitySet( null, {register:false} );
        esCount = 0;

        if( !entityFilter && offset === 0 && limit === 0 ){
            entities = entitySet.models;
        } else {
            // select the subset of the entities which pass through the filter
            entities = _.reduce( entitySet.models, (result, entity) => {
                let cmdResult;

                // TODO: still not great that we are iterating over models
                // is there a way of exiting once limit has been reached?
                if( limit !== 0 && result.length >= limit ){
                    return result;
                }

                if( entityFilter ){            
                    entity = entityFilter.accept(entity, context);
                }
                
                if(!entity){
                    return result;
                }

                if( filterFunction ){
                    entityContext.entity = entity;
                    entityContext.debug = false;
                
                    cmdResult = Query.executeCommand( entityContext, filterFunction );

                    // if( true ){ console.log('eval function ' + Utils.stringify(filterFunction) + ' ' + Utils.stringify(cmdResult) ); }

                    if( Query.valueOf( context, cmdResult ) !== true ){
                        entity = null; //result.push( entity );
                    }
                }


                if( (esCount >= offset) && entity ){
                    result.push( entity );
                }

                esCount++;

                return result;
            }, []);
        }

        
        if( debug ){ console.log('cmd filter result length ' + entities.length ); }   
        value.addEntity( entities );
    }

    // console.log('well final value was ' + JSON.stringify(value) );
    // printE( value );

    return (context.last = [ Query.VALUE, value ]);
}


/**
*   Takes the attribute value of the given component and returns it
*
*   This command operates on the single entity within context.
*/
function commandComponentAttribute( context, attributes ){
    let componentIds, components, result;
    let entity = context.entity;
    let debug = context.debug;
    componentIds = context.componentIds;

    // printIns( context,1 );
    if( debug ){ console.log('ATTR> ' + Utils.stringify(componentIds) + ' ' + Utils.stringify( _.rest(arguments))  ); } 

    if( !componentIds ){
        throw new Error('no componentIds in context');
    }
    
    if( !entity ){
        console.log('ATTR> no entity');
        return (context.last = [ Query.VALUE, null ] );
    }

    attributes = _.isArray( attributes ) ? attributes : [attributes];

    components = entity.components;
    result = [];

    // if( debug ){
    //     console.log('ATTR> e');
    //     printE( entity );
    // }
        
    _.each( componentIds, id => {
        let component = components[ id ];
        if( !component ){ return; }
        _.each( attributes, attr => result.push(component.get.call(component, attr)) );    
    });

    if( result.length === 0 ){
        result = null;
    } else if( result.length === 1 ){
        result = result[0];
    }

    return (context.last = [ Query.VALUE, result ] );
}


// function EntityFilterTransform( type, registry, entity, entityBitField, filterBitField ){
//     let ii, len, defId, bf, ebf, vals, isInclude, isExclude, result;
//     isInclude = (type == EntityFilter.INCLUDE);
//     isExclude = (type == EntityFilter.EXCLUDE);

//     result = registry.cloneEntity( entity );

//     // console.log('EFT ' + type + ' ' + isInclude + ' ' + entityBitField.toJSON() + ' ' + filterBitField.toJSON() );
//     if( isInclude ){
//         // iterate through each of the entities components (as c IIDs)
//         vals = entityBitField.toValues();
//         // console.log('EFT include ' + vals );
//         for( ii=0,len=vals.length;ii<len;ii++ ){
//             defId = vals[ii];

//             if( !filterBitField.get(defId) ){
//                 result.removeComponent( result.components[defId] );
//             }
//         }
//     // handle exclude filter, and also no filter specified
//     } else {
//         vals = entityBitField.toValues();
//         for( ii=0,len=vals.length;ii<len;ii++ ){
//             defId = vals[ii];
//             if( !isExclude || !bitField.get(defId) ){
//                 // printE( srcEntity.components[defId] );
//                 result.addComponent( entity.components[defId] );
//             }
//         }
//     }
    
//     return result;
// }



// /**
// *   filters the given entityset with the given entityfilter returning
// *   a new entityset
// */
// QueryContext.prototype.filterEntitySet = function( context, entitySet, entityFilter, options ){
//     let entities,result;

//     // filtersLength = entityFilter.filters.length;
//     // filter the entitySet using the component filters
//     entities = _.reduce( entitySet.models, function(result, entity){
//         if( !entityFilter.accept( entity, context ) ){
//             return result;
//         }
//         // let ii,len,filter;
//         // let ebf = entity.getComponentBitfield();
//         // for( ii=0;ii<filtersLength;ii++ ){
//         //     filter = filters.filters[ii];
//         //     if( !EntityFilter.accept( filter.type, ebf, filter.bitField, false ) ){
//         //         // console.log(entity.getEntityId() + ' accept with ' + Utils.stringify(filter) + ' FALSE');
//         //         return result;
//         //     }
//         // }
//         // console.log( entity.getEntityId() + ' accept with ' + Utils.stringify(filter) + ' TRUE');
//         result.push( entity );
//         return result;
//     }, []);

//     result = context.registry.createEntitySet( null, {register:false} );
//     result.addEntity( entities );

//     return result;
// }



// Query.commandEntityFilter = function( context, entityFilter, options ){
//     let entitySet, entity, entities, registry,result,ebf,filterType,filterBitField;
//     // if( context.debug ){ console.log('commandEntityFilter'); }

    
//     // filtersLength = entityFilter.filters.length;
//     entity = context.entity;
//     registry = context.registry;

//     if( entity ){
//         // printIns( context.entity );
//         // if( true || context.debug ){ console.log('commandEntityFilter> entity ' + context.entity.cid ); }
//         // filter the entity using the component filters - returns a boolean
        

//         if( !entityFilter.accept(entity, context) ){
//             // if( true || context.debug ){ console.log('commandEntityFilter> entity ' + context.entity.cid + ' rejected' ); }
//             return (context.last = [ Query.VALUE, null ]);
//         }

//         ebf = entity.getComponentBitfield();

//         for( filterType in entityFilter.filters ){
//             filterBitField = entityFilter.filters[filterType];
//             // printIns( filter );
//             // console.log('commandEntityFilter> filter ' + filterType + ' ' + JSON.stringify(filterBitField.toValues()) );
//             if( filterType == EntityFilter.INCLUDE ){
//                 entity = EntityFilterTransform( filterType, registry, entity, ebf, filterBitField );
//             }
//             else if( !EntityFilter.accept( filterType, ebf, filterBitField, false ) ){
//                 return (context.last = [ Query.VALUE, null ]);
//             }
//         }
//         if( context.debug ){ console.log('commandEntityFilter> entity ' + context.entity.cid + ' passed' ); }

//         return (context.last = [ Query.VALUE, entity ]);
//     } else {
//         // filter the entitySet using the component filters
//         // result = Query._filterEntitySet( context, context.entitySet, entityFilter, options );
//         result = context.filterEntitySet( context, context.entitySet, entityFilter, options );
//         return (context.last = [ Query.VALUE, result ]);
//     }
// }




Query.commandFunction = function commandFunction( op ){
    let result;

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
        default:
            break;
    }
    return result;
}


Query.executeCommand = function( context, op, args ){
    let result, cmdFunction, cmdArgs, value;

    if( context.debug ){ console.log('executing ' + Utils.stringify( _.rest(arguments)) ); }

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
            // console.log('query root', cmdArgs);
            result = (context.last = [ Query.VALUE, context.root ]);
            break;
        case Query.VALUE:
            value = args[0];
            if( value === Query.ROOT ){
                value = context.root;
            }
            result = (context.last = [ Query.VALUE, value ]);
            if(context.debug){ console.log('value> ' + Utils.stringify(context.last)) }
            break;
        case Query.EQUALS:
        case Query.LESS_THAN:
        case Query.LESS_THAN_OR_EQUAL:
        case Query.GREATER_THAN:
        case Query.GREATER_THAN_OR_EQUAL:
            result = commandEquals.apply( context, cmdArgs.concat(op) );
            break;
        case Query.ENTITY_FILTER:
            result = context.commandFilter.apply( context, cmdArgs );
            break;
        case Query.FILTER_FUNC:
        case Query.ALL_FILTER:
        case Query.INCLUDE_FILTER:
        case Query.ANY_FILTER:
        case Query.NONE_FILTER:
            result = context.commandFilter.apply( context, cmdArgs );
            break;
        default:
            cmdFunction = Query.commandFunction( op );
            if( !cmdFunction ){
                // console.log('unknown cmd ' + op);
                // printIns( _.rest(arguments), 1 );
                throw new Error('unknown cmd (' + Utils.stringify(op) + ') ' + Utils.stringify(_.rest(arguments)) );
            }
            result = cmdFunction.apply( context, cmdArgs );  
            break;
    }
    // console.log('done result ' + Utils.stringify( _.rest(arguments)) + ' ' + result );
    return result;
}


Query.compile = function compileQuery( context, commands, options ){
    let result, ii, len, entityFilter;

    if( Query.isQuery( commands ) ){
        if( commands.isCompiled ){
            return commands;
        }
        commands = (commands.src || commands.toArray( true ));
    } else if( _.isArray(commands) ){
        // console.log('compile> ' + Utils.stringify(commands));
        // we may have been passed a single command
        if( !_.isArray(commands[0]) && !Query.isQuery(commands[0])){
            commands = [commands];
        }  
        commands = _.map( commands, command => {
            if( Query.isQuery(command) ){
                if( !command.isCompiled ){
                    command = command.toArray(true)[0];
                }
                // command = command.isCompiled ? command || command.toArray(true)[0];
            }
            // console.log('compile> ' + Utils.stringify(command));
            return command;
        });
        // console.log('compile> ' + Utils.stringify(commands));
    }

    result = new Query();
    result.isCompiled = true;
    result.src = Utils.deepClone(commands);

    // printIns( result.src, 6 );
    // commands = _.reduce( commands, function(result,command){

    commands = _.reduce( commands, (result,command) => {
        let op, entityFilter, compileResult, hash;
        op = command[0];

        // check for registered command compile function
        if( (compileResult = Query.compileCommands[ op ]) !== undefined ){
            if( (compileResult = compileResult( context, command )) ){
                result.push( compileResult );
            }
            return result;
        }

        switch( op ){
            case Query.NONE_FILTER:
            case Query.ALL_FILTER:
            case Query.ANY_FILTER:
            case Query.INCLUDE_FILTER:
                entityFilter = gatherEntityFilters( context, command );
                // insert a basic entity_filter command here
                // result.push( [ Query.ENTITY_FILTER, entityFilter ] ); // NOTE: why was this here??
                // result.push( [ command[0], entityFilter, command[2] ] );
                result.push( [ Query.ENTITY_FILTER, entityFilter, command[2] ] );
                // console.log('gathering ' + JSON.stringify(entityFilter) );
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
    entityFilter = null;

    // combine contiguous entity filters
    for( ii=0,len=commands.length;ii<len;ii++ ){
        while( ii < len && commands[ii][0] === Query.ENTITY_FILTER && !commands[ii][2] ){
            if( !entityFilter ){
                entityFilter = EntityFilter.create( commands[ii][1] );
            } else {
                entityFilter.add( commands[ii][1] );
            }
            ii += 1;
        }
        if( entityFilter ){
            result.commands.push( [ Query.ENTITY_FILTER, entityFilter ] );
            entityFilter = null;
        }
        if( ii < len ){
            result.commands.push( commands[ii] );
        }
    }

    // allow hooks to further process commands
    _.each( Query.compileHooks, hook => result.commands = hook(context, result.commands, result) );

    // result.commands = commands;
    if( context.debug ) { printIns( result, 6 ); }
    return result;
}

/**
*
*/
Query.commands = function( commands ){
    let result;
    commands = _.toArray(arguments);

    result = new Query();
    result.src = _.map( commands, function(command){ return command.toArray(true)[0]; });

    return result;
}

Query.createContext = function( props={}, options={} ){
    let context;
    let type;
    type = options.context || props.type || QueryContext;
    context = new (type)();
    context.type = type;
    context = _.extend( context, props );
    return context;
}

Query.buildContext = function( entity, query, options={} ){
    let context, rootObject;

    context = Query.createContext( {}, options );

    if( EntitySet.isEntitySet( entity ) ){
        context.entitySet = entity;
    } else if( Entity.isEntity( entity ) ){
        context.entity = entity;
    } else {
        context.entitySet = null;
    }

    context.root = rootObject = (context.entity || context.entitySet);
    context.registry = options.registry || (rootObject ? rootObject.getRegistry() : null);
    context.last = [Query.VALUE, rootObject];

    if( options.debug ){
        context.debug = true;
    }
    
    if( options.alias ){
        context.alias = _.extend({},options.alias);
    }

    return context;
}


Query.execute = function executeQuery( entity, query, options={} ){
    let ii, len, command, context, result;
    
    // build the initial context object from the incoming arguments
    context = Query.buildContext( entity,query,options);

    query = Query.compile( context, query, options );

    // if( context.debug ){console.log('commands:'); printIns( query,1 ); }

    for( ii=0,len=query.commands.length;ii<len;ii++ ){
        command = query.commands[ii];
        // console.log('go ' + Utils.stringify(command) );

        // the actual result will usually be [VALUE,...]
        result = Query.executeCommand( context, command )[1];
    }

    return result;
}

Query.prototype.toArray = function(){
    return [];
}


Query.registerCommand = function( options ){
    if( options.commands ){
        return _.each( options.commands, c => Query.registerCommand(c) );
    }

    Query[ options.name ] = options.id;
    
    if( options.dsl ){
        _.each( options.dsl, (func,name) => Query[name] = func )
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
    if( options.compileHook ){
        Query.compileHooks.push( options.compileHook );
    }
    Query.commandFunctions[ options.id ] = options.command;
}

Query.prototype.toJSON = function(){
    let rep = (( this.isCompiled ) ? this.src : this.toArray(true));
    return rep;
}

Query.prototype.hash = function(){
    let rep = (( this.isCompiled ) ? this.src : this.toArray(true));
    return Utils.hash( JSON.stringify(rep), true );
}

Query.prototype.execute = function( context, options ){
    return Query.execute( context, this, options );
}

Query.isQuery = function( query ){
    return query && query instanceof Query;
}

Query.create = function( registry, commands, options ){
    let context;

    if( Query.isQuery(commands) && commands.isCompiled ){
        return commands;
    }

    context = Query.buildContext( null,null,_.extend({registry:registry},options));

    let result = Query.compile( context, commands, options );
    return result;
}

// module.exports = Query;