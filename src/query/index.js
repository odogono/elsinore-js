import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import Entity from '../entity';
import EntitySet from '../entity_set';
import EntityFilter from '../entity_filter';
import * as Utils from '../util';
import {printIns} from '../util';
import QueryBuilder from './dsl';
import {DslContext} from './dsl';


// _.extend( Query, {
export const ALL = 0; // entities must have all the specified components
export const ANY = 1; // entities must have one or any of the specified components
export const SOME = 2; // entities must have at least one of the specified component
export const NONE = 3; // entities should not have any of the specified components
export const INCLUDE = 4; // the filter will only include specified components
export const EXCLUDE = 5; // the filter will exclude specified components
export const ROOT = 6; // select the root entity set
export const EQUALS = 7; // == 
export const NOT_EQUAL = 8; // !=
export const LESS_THAN = 9; // <
export const LESS_THAN_OR_EQUAL = 10;
export const GREATER_THAN = 11; // >
export const GREATER_THAN_OR_EQUAL = 12;
export const AND = 13;
export const OR = 14;
export const NOT = 15;
export const VALUE = 16; // a value
// export const FILTER = 17;
// export const ADD_ENTITIES = 18;
export const ATTR = 19;
// export const PLUCK = 20;
// export const ALIAS = 21;
// export const DEBUG = 22;
// export const PRINT = 23;
// export const WITHOUT = 25;
// export const NOOP = 26;
export const LEFT_PAREN = 27;
export const RIGHT_PAREN = 28;
// export const MEMBER_OF = 29;
export const ENTITY_FILTER = 30;
// export const ALIAS_GET = 31;
// export const PIPE = 32;
// export const SELECT_BY_ID = 33;
export const ALL_FILTER = 34;
export const NONE_FILTER = 35;
export const FILTER_FUNC = 36;
export const ANY_FILTER = 37;
export const INCLUDE_FILTER = 38
// });




export default class Query {
    // type: 'Query',
    // isQuery: true,
    // cidPrefix: 'q',

    constructor( commands, options={} ){
        this.cid = _.uniqueId('q');
        this.commands = commands;

        if( _.isFunction(commands) ){
            // console.log('compiling a command builder');
            const builder = new QueryBuilder(this);
            const built = commands(builder);
            if( _.isArray(built) ){
                this.commands = _.map( built, dsl => dsl.toArray(true)[0] );
            } else {
                this.commands = built.toArray(true);
            }
            // console.log('query builder result', built);
            // commands = commands(builder).toArray(true);
            // console.log('query builder result', commands);
        } else if( commands instanceof Query ){
            this.commands = commands.toJSON();
        } else if( _.isArray(commands) ){
            if( _.isFunction(commands[0]) ){
                const builder = new QueryBuilder(this);
                this.commands = _.map(commands, cmd => {
                    return cmd(builder).toArray(true)[0];
                });
            }
        }
    }

    isEmpty(){
        return !this.commands || this.commands.length == 0;
    }

    toArray(){
        return this.compiled;
    }

    toJSON(){
        const rep = (( this.compiled ) ? this.compiled : this.commands);
        return rep;
    }

    hash(){
        const rep = this.toJSON();// (( this.isCompiled ) ? this.src : this.toArray(true));
        return Utils.hash( Utils.stringify(rep), true );
    }

    /**
     * 
     */
    execute( entity, options={} ){
        let ii, len, command, context, result;
    
        // build the initial context object from the incoming arguments
        context = this.buildEntityContext( entity, options);

        this.compile( context, this.commands, options );
        // query = Query.compile( context, query, options );

        // if( context.debug ){console.log('commands:'); printIns( query,1 ); }

        // console.log('execute', this.commands);
        // console.log('compiled', this.compiled );

        for( ii=0,len=this.compiled.length;ii<len;ii++ ){
            command = this.compiled[ii];
            // console.log('go ' + Utils.stringify(command) );

            // the actual result will usually be [VALUE,...]
            result = executeCommand( context, command )[1];
        }

        // console.log('execute result was', JSON.stringify(result));
        return result;
        // return true;
    }


    /**
     * compiles the instances commands into an optimised form
     */
    compile( context, commands, options ){
        let result, ii, len, entityFilter;

        this.compiled = [];

        // sanitise the query commands

        // if( _.isFunction(commands) ){
        //     // console.log('compiling a command builder');
        //     const builder = new QueryBuilder(this);
        //     const built = commands(builder);
        //     if( _.isArray(built) ){
        //         commands = _.map( built, dsl => dsl.toArray(true)[0] );
        //     } else {
        //         commands = built.toArray(true);
        //     }
        //     // console.log('query builder result', built);
        //     // commands = commands(builder).toArray(true);
        //     console.log('query builder result', commands);
        // }
        if( Query.isQuery( commands ) ){
            if( commands.isCompiled ){
                return commands;
            }
            commands = (commands.src || commands.toArray( true ));
        } else if( _.isArray(commands) ){
            // if( _.isFunction(commands[0]) ){
            //     const builder = new QueryBuilder(this);
            //     commands = _.map(commands, cmd => {
            //         return cmd(builder).toArray(true)[0];
            //     });
            // }
            if( !_.isArray(commands[0]) && !Query.isQuery(commands[0])){
                commands = [commands];
            }else{
                commands = _.map( commands, command => {
                    if( Query.isQuery(command) ){
                        if( !command.isCompiled ){
                            command = command.toArray(true)[0];
                        }
                    }
                    return command;
                });
            }
            // console.log('compile> ' + Utils.stringify(commands));
        }

        
        // result = new Query();
        // result.isCompiled = true;
        // this.src = Utils.deepClone(commands);

        // printIns( this.src, 6 );
        // commands = _.reduce( commands, function(result,command){

        let firstStageCompiled = _.reduce( commands, (result,command) => {
            let op, entityFilter, compileResult, hash;
            op = command[0];

            // check for registered command compile function
            if( (compileResult = compileCommands[ op ]) !== undefined ){
                if( (compileResult = compileResult( context, command )) ){
                    result.push( compileResult );
                }
                return result;
            }

            switch( op ){
                case NONE_FILTER:
                case ALL_FILTER:
                case ANY_FILTER:
                case INCLUDE_FILTER:
                    entityFilter = gatherEntityFilters( context, command );
                    // insert a basic entity_filter command here
                    // result.push( [ Query.ENTITY_FILTER, entityFilter ] ); // NOTE: why was this here??
                    // result.push( [ command[0], entityFilter, command[2] ] );
                    result.push( [ ENTITY_FILTER, entityFilter, command[2] ] );
                    // console.log('gathering ' + JSON.stringify(entityFilter) );
                    break;
                case AND:
                    result.push( (context.resolveEntitySet(command, true ) || command) );
                    break;
                default:
                    result.push( command );
                    break;
            }

            return result;
        },[]);

        // console.log('A compiledCommands here', firstStageCompiled);

        // result.compiled = [];
        entityFilter = null;

        // combine contiguous entity filters
        // console.log('');
        for( ii=0,len=firstStageCompiled.length;ii<len;ii++ ){
            // console.log('>combine', firstStageCompiled[ii] );
            while( ii < len && firstStageCompiled[ii][0] === ENTITY_FILTER && !firstStageCompiled[ii][2] ){
                if( !entityFilter ){
                    entityFilter = new EntityFilter( firstStageCompiled[ii][1] );
                } else {
                    entityFilter.add( firstStageCompiled[ii][1] );
                }
                ii += 1;
            }
            if( entityFilter ){
                // console.log('>combine adding', entityFilter );
                this.compiled.push( [ ENTITY_FILTER, entityFilter ] );
                entityFilter = null;
            }
            if( ii < len ){
                this.compiled.push( firstStageCompiled[ii] );
            }
        }

        // console.log('B compiledCommands here', this.compiled);
        // process.exit();

        // allow hooks to further process commands
        _.each( compileHooks, hook => this.compiled = hook(context, this.compiled, this) );

        // console.log('C compiledCommands here', this.compiled);

        // this.commands = commands;
        if( context.debug ) { printIns( this, 6 ); }
        return this;
    }


    /**
     * 
     */
    buildEntityContext( entity, options={} ){
        let context, rootObject;

        context = QueryContext.create( this, {}, options );

        if( EntitySet.isEntitySet( entity ) ){
            context.entitySet = entity;
        } else if( Entity.isEntity( entity ) ){
            context.entity = entity;
        } else {
            context.entitySet = null;
        }

        context.root = rootObject = (context.entity || context.entitySet);
        context.registry = options.registry || (rootObject ? rootObject.getRegistry() : null);
        context.last = [VALUE, rootObject];

        if( options.debug ){
            context.debug = true;
        }
        
        if( options.alias ){
            context.alias = _.extend({},options.alias);
        }

        return context;
    }
}


class QueryContext {
    constructor(query){
        this.query = query;
    }

    /**
    *   Returns the referenced value of the passed value providing it is a Query.VALUE
    */
    valueOf( value, shouldReturnValue ){
        let command;
        if( !value ){ return value; }
        // if( this.debug ){ console.log('valueOf: ' + Utils.stringify(value) ); }
        // console.log('valueOf: ' + Utils.stringify(value) );
        if( _.isArray(value) ){
            command = value[0];
            // if( !_.isArray(value[1]) ){
                // console.log('argle ' + JSON.stringify(value))
                // just a plain array
                // return value;
            // }

            if( command === VALUE ){
                if( value[1] === ROOT ){
                    return this.root;
                }
                // console.log('return val[1] ' + value[1] );
                return value[1];
            } else if( command === ROOT ){
                return this.root;
            }
            
            // if( this.debug ){ console.log('valueOf: cmd ' + command + ' ' + Utils.stringify(value) )}
            value = executeCommand( this, value );

            // if( this.debug ){ console.log('valueOf exec: ' + Utils.stringify(value) )}

            if( value[0] === VALUE ){
                return value[1];
            }
        }
        if( shouldReturnValue ){
            return value;
        }
        return null;
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
    resolveEntitySet(entitySet, compileOnly ){
        let op, result;
        if( !entitySet ){
            entitySet = this.last;
        }

        if( entitySet === ROOT ){
            return this.entitySet;
        }

        if( _.isArray(entitySet) ){
            if( compileOnly ){
                return entitySet;
            }
            entitySet = this.valueOf(entitySet );
        }

        if( EntitySet.isEntitySet(entitySet) ){
            return entitySet;
        }

        return null;
    }


    /**
     * Resolve a value of component ids
     */
    // resolveComponentIIds(components ){
    //     const resolved = this.valueOf( components, true );
    //     return resolved ? this.registry.getIId( resolved, true ) : null;
    // }

// Query.resolveComponentIIds = resolveComponentIIds;

    /**
     * 
     */
    componentsToBitfield( context, components ){
        let componentIds, result;
        componentIds = context.registry.getIId( components, {forceArray:true, debug:true} );
        // console.log('lookup ', components, componentIds );
        result = BitField.create();
        result.setValues( componentIds, true );
        return result;
    }


    /**
    *   Takes an entityset and applies the filter to it resulting
    *   in a new entityset which is returned as a value.
    */
    commandFilter( context, entityFilter, filterFunction, options={} ){
        let entities, entityContext, value;
        let entity, entitySet;
        let debug = context.debug;
        let limit, offset;
        let esCount;

        limit = _.isUndefined(options.limit) ? 0 : options.limit;
        offset = _.isUndefined(options.offset) ? 0 : options.offset;

        if( debug ){ console.log('commandFilter >'); printIns( _.rest(arguments), 5); console.log('<'); } 

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
            entityContext = QueryContext.create( this.query, context );// _.extend( {}, context );

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
                // console.log('^QueryContext.commandFilter: ', entityFilter);
                value = entityFilter.accept(value, context);
                // console.log('yep? ' + JSON.stringify(value) );
                // console.log('so got back', value, entityFilter);
            } 

            if( value && filterFunction ){
                entityContext.entity = value;
                value = executeCommand( entityContext, filterFunction );
                if( value[0] === VALUE ){
                    value = value[1] ? context.entity : null;
                }
            }

        } else {
            value = context.registry.createEntitySet( {register:false} );
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
                    
                        cmdResult = executeCommand( entityContext, filterFunction );

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

        return (context.last = [ VALUE, value ]);
    }
}


QueryContext.create = function( query, props={}, options={} ){
    let context;
    let type;
    // console.log('QueryContext.create', Utils.stringify(props), options);
    type = options.context || props.type || QueryContext;
    context = new (type)(query);
    context.type = type;
    context = _.extend( context, props );
    return context;
}


export let argCounts = {};
export let precendenceValues = {};
export let compileCommands = {};
export let commandFunctions = {};
export let compileHooks = [];

// _.extend(Query.prototype, {
//     type: 'Query',
//     isQuery: true,
// });



/**
*   Query functions for the memory based entity set.   
*
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/

function gatherEntityFilters( context, expression ){
    let ii,len,bf,result, obj;
    
    let filter = expression[0];
    result = new EntityFilter();
    
    switch( filter ){
        case ANY:
        case ANY_FILTER:
        case ALL:
        case ALL_FILTER:
        case NONE:
        case NONE_FILTER:
        case INCLUDE:
        case INCLUDE_FILTER:
            if( expression[1] === ROOT ){
                result.add( ROOT );
            } else {
                obj = Query.valueOf( context, expression[1], true );
                
                if( !obj ){
                    if( filter == ALL_FILTER ){
                        result.add( ROOT );
                        return;
                    }
                    return null;
                }
                bf = context.componentsToBitfield( context, obj );
                // console.log('CONVERTED TO BF', bf.toString());
                // filter = expression[0];
                switch( filter ){
                    case ALL_FILTER: filter = ALL; break;
                    case ANY_FILTER: filter = ANY; break;
                    case NONE_FILTER: filter = NONE; break;
                    case INCLUDE_FILTER: filter = INCLUDE; break;
                }
                result.add( filter, bf );
            }
            break;
        case AND:
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

        if( command === VALUE ){
            if( value[1] === ROOT ){
                return context.root;
            }
            // console.log('return val[1] ' + value[1] );
            return value[1];
        } else if( command === ROOT ){
            return context.root;
        }
        
        // if( context.debug ){ console.log('valueOf: cmd ' + command + ' ' + Utils.stringify(value) )}
        value = executeCommand( context, value );

        // if( context.debug ){ console.log('valueOf exec: ' + Utils.stringify(value) )}

        if( value[0] === VALUE ){
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
            case LESS_THAN:
                result = (value1 < value2);
                break;
            case LESS_THAN_OR_EQUAL:
                result = (value1 <= value2);
                break;
            case GREATER_THAN:
                result = (value1 > value2);
                break;
            case GREATER_THAN_OR_EQUAL:
                result = (value1 >= value2);
                break;
            default:
                result = (value1 === value2);
                break;
        }
    } else {
        switch( op ){
            case LESS_THAN:
            case LESS_THAN_OR_EQUAL:
            case GREATER_THAN:
            case GREATER_THAN_OR_EQUAL:
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
    return (context.last = [ VALUE, result ]);
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
    
    return (context.last = [ VALUE, value ]);
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
    
    return (context.last = [ VALUE, value ]);
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
        return (context.last = [ VALUE, null ] );
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

    return (context.last = [ VALUE, result ] );
}




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
//             return (context.last = [ VALUE, null ]);
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
//                 return (context.last = [ VALUE, null ]);
//             }
//         }
//         if( context.debug ){ console.log('commandEntityFilter> entity ' + context.entity.cid + ' passed' ); }

//         return (context.last = [ VALUE, entity ]);
//     } else {
//         // filter the entitySet using the component filters
//         // result = Query._filterEntitySet( context, context.entitySet, entityFilter, options );
//         result = context.filterEntitySet( context, context.entitySet, entityFilter, options );
//         return (context.last = [ VALUE, result ]);
//     }
// }




 function commandFunction( op ){
    let result;

    result = commandFunctions[ op ];
    
    if( result !== undefined ){
        return result;
    }

    switch( op ){
        case ATTR:
            result = commandComponentAttribute;
            break;
        case EQUALS:
            result = commandEquals;
            break;
        case AND:
            result = commandAnd;
            break;
        case OR:
            result = commandOr;
            break;
        default:
            break;
    }
    return result;
}


function executeCommand( context, op, args ){
    let result, cmdFunction, cmdArgs, value;

    // if( context.debug ){ console.log('executing ' + Utils.stringify( _.rest(arguments)) ); }

    if( !args ){
        // assume the op and args are in the same array
        args = _.rest( op );
        op = op[0];
    }

    // prepend the context to the beginning of the arguments
    cmdArgs = [context].concat( args );

    context.op = op;
    
    switch( op ){
        case ROOT:
            // console.log('query root', cmdArgs);
            result = (context.last = [ VALUE, context.root ]);
            break;
        case VALUE:
            value = args[0];
            if( value === ROOT ){
                value = context.root;
            }
            result = (context.last = [ VALUE, value ]);
            // if(context.debug){ console.log('value> ' + Utils.stringify(context.last)) }
            break;
        case EQUALS:
        case LESS_THAN:
        case LESS_THAN_OR_EQUAL:
        case GREATER_THAN:
        case GREATER_THAN_OR_EQUAL:
            result = commandEquals.apply( context, cmdArgs.concat(op) );
            break;
        case ENTITY_FILTER:
            result = context.commandFilter.apply( context, cmdArgs );
            break;
        case FILTER_FUNC:
        case ALL_FILTER:
        case INCLUDE_FILTER:
        case ANY_FILTER:
        case NONE_FILTER:
            result = context.commandFilter.apply( context, cmdArgs );
            break;
        default:

            cmdFunction = commandFunction( op );
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

// Query.commandBuilder(query,options={}){

// }


/**
 * Registers a query command extension
 */
export function register( name, command, dslObj, options={} ){
    // console.log('register command', name);
    if( commandFunctions[ name ] !== undefined ){
        throw new Error('already registered cmd ' + name );
    }

    if( dslObj ){
        _.each( dslObj, (fn,name) => {
            DslContext.prototype[name] = fn;
            // console.log('register dsl', name);
        })
    }
    const argCount = _.isUndefined(options.argCount) ? 1 : options.argCount;
    argCounts[name] = argCount;

    if( command ){
        commandFunctions[name] = command;
    }

    if( options.compile ){
        compileCommands[name] = options.compile;
    }
    

    // console.log('adding to', DslContext);
    return Query;
}

// export function registerCommand( options ){
//     if( options.commands ){
//         return _.each( options.commands, c => registerCommand(c) );
//     }
//     // console.log('Query registerCommand', options);
//     Query[ options.name ] = options.id;
    
//     if( options.dsl ){
//         _.each( options.dsl, (func,name) => Query[name] = func )
//     }
//     if( options.argCount ){
//         argCounts[ options.id ] = options.argCount;
//     }
//     if( commandFunctions[ options.id ] !== undefined ){
//         throw new Error('already registered cmd ' + options.id );
//     }
//     if( options.compile ){
//         compileCommands[ options.id ] = options.compile;
//     }
//     if( options.compileHook ){
//         compileHooks.push( options.compileHook );
//     }
//     commandFunctions[ options.id ] = options.command;
// }

Query.isQuery = function( query ){
    return query && query instanceof Query;
}

/**
 * Adhoc execution of a query
 */
Query.exec = function( query, entity, options ){
    const q = new Query(query);
    return q.execute(entity,options);
}