import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import Entity from '../entity';
import EntitySet from '../entity_set';
import EntityFilter from '../entity_filter';
import {deepEqual, hash, stringify} from '../util';
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
export const EQUALS = '=='; // == 
export const NOT_EQUAL = '!='; // !=
export const LESS_THAN = '<'; // <
export const LESS_THAN_OR_EQUAL = '<=';
export const GREATER_THAN = '>'; // >
export const GREATER_THAN_OR_EQUAL = '>=';
export const AND = 13;
export const OR = 14;
export const NOT = 15;
export const VALUE = 'VL'; // a value
// export const FILTER = 17;
// export const ADD_ENTITIES = 18;
// export const ATTR = 19;
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
export const ALL_FILTER = 'FA';
export const NONE_FILTER = 'FN';
export const FILTER_FUNC = 'FF';
export const ANY_FILTER = 'FY';
export const INCLUDE_FILTER = 'FI';
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
            if( Array.isArray(built) ){
                this.commands = _.map( built, dsl => dsl.toArray(true)[0] );
            } else {
                this.commands = built.toArray(true);
            }
            // console.log('query builder result', built);
            // commands = commands(builder).toArray(true);
            // console.log('query builder result', commands);
        } else if( commands instanceof Query ){
            this.commands = commands.toJSON();
        } else if( Array.isArray(commands) ){
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
        return hash( stringify(rep), true );
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
            // console.log('go ' + stringify(command) );

            // the actual result will usually be [VALUE,...]
            result = executeCommand( context, command )[1];
        }

        // console.log('execute result was', stringify(result));
        return result;
        // return true;
    }


    /**
     * compiles the instances commands into an optimised form
     */
    compile( context, commands, options ){
        let result, ii, len, entityFilter;

        this.compiled = [];

        if( Query.isQuery( commands ) ){
            if( commands.isCompiled ){
                return commands;
            }
            commands = (commands.src || commands.toArray( true ));
        } else if( Array.isArray(commands) ){
            
            if( !Array.isArray(commands[0]) && !Query.isQuery(commands[0])){
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
            // console.log('compile> ' + stringify(commands));
        }

        // _.each(commands, f => console.log('pre',f));

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
                    // console.log('gathering', command, 'to', entityFilter.toJSON());
                    // insert a basic entity_filter command here
                    result.push( [ ENTITY_FILTER, entityFilter, command[2] ] );
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

        // _.each(firstStageCompiled, f => console.log('1st',stringify(f)));

        entityFilter = null;

        // combine contiguous entity filters
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
        // allow hooks to further process commands
        _.each( compileHooks, hook => this.compiled = hook(context, this.compiled, this) );

        // console.log('compiled', this.compiled);
        // this.commands = commands;
        // if( context.debug ) { console.log(this); }
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
        // if(true ){ console.log('valueOf: ' + stringify(value) ); }
        // console.log('valueOf: ' + stringify(value) );
        if( Array.isArray(value) ){
            command = value[0];
            if( command === VALUE ){
                if( value[1] === ROOT ){
                    return this.root;
                }
                return value[1];
            } else if( command === ROOT ){
                return this.root;
            }
            // if( true ){ console.log('valueOf: cmd ' + command + ' ' + stringify(value) )}
            value = executeCommand( this, value );

            // if( this.debug ){ console.log('valueOf exec: ' + stringify(value) )}

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

        if( Array.isArray(entitySet) ){
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
        let esCount;

        const limit = _.isUndefined(options.limit) ? 0 : options.limit;
        const offset = _.isUndefined(options.offset) ? 0 : options.offset;

        // console.log('context is', context);
        // console.log('entityfilter is', entityFilter);
        // if( true ){ console.log('commandFilter >'); console.log( _.rest(arguments) ); console.log('<'); } 

        // console.log('commandFilter> ' + offset + ' ' + limit );
        // resolve the entitySet argument into an entitySet or an entity
        // the argument will either be ROOT - in which case the context entityset or entity is returned,
        // otherwise it will be some kind of entity filter
        // entitySet = Query.resolveEntitySet( context, entitySet );
        
        entitySet = context.valueOf( context.last || context.entitySet, true );

        if( Entity.isEntity(entitySet) ){
            entity = entitySet;
        } else {
            // console.log('commandFilter no entityset', entitySet);
        }

        if( filterFunction ){
            entityContext = QueryContext.create( this.query, context );

            if( Entity.isEntity(entitySet) ){
                entityContext.entity = entity = entitySet;
                entityContext.entitySet = entitySet = null;
            }

            entityContext.entityFilter = entityFilter;
            
            if( entityFilter ){
                entityContext.componentIds = entityFilter.getValues(0);
            }
        }

        if( entity ){
            
            value = entity;
            if( entityFilter ){
                
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

            if( !filterFunction && !entityFilter && offset === 0 && limit === 0 ){
                entities = entitySet.models;
                
            } else {
                
                // console.log('g', entitySet );
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

                        // if( true ){ console.log('eval function ' + stringify(filterFunction) + ' ' + stringify(cmdResult), stringify(entity) ); }

                        if( context.valueOf(cmdResult) !== true ){
                            entity = null;
                        }
                    }


                    if( (esCount >= offset) && entity ){
                        result.push( entity );
                    }

                    esCount++;

                    return result;
                }, []);
            }

            
            // if( true ){ console.log('cmd filter result length ' + entities.length ); }   
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
    // console.log('QueryContext.create', stringify(props), options);
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
                obj = context.valueOf( expression[1], true );
                
                if( !obj ){
                    if( filter == ALL_FILTER ){
                        result.add( ROOT );
                        return;
                    }
                    return null;
                }
                bf = context.componentsToBitfield( context, obj );
                // console.log('CONVERTED TO BF', bf.toString(), bf.toJSON() );
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



function commandAnd( context, ops ){
    let ii,len,value;
    
    ops = _.rest( arguments );

    for( ii=0,len=ops.length;ii<len;ii++ ){
        value = context.valueOf(ops[ii], true );
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
        value = context.valueOf(ops[ii], true );
        if( value ){
            break;
        }
    }
    
    return (context.last = [ VALUE, value ]);
}



 function commandFunction( op ){
    let result;

    result = commandFunctions[ op ];
    
    if( result !== undefined ){
        return result;
    }

    switch( op ){
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

    // if( context.debug ){ console.log('executing ' + stringify( _.rest(arguments)) ); }

    if( !args ){
        // assume the op and args are in the same array
        args = _.rest( op );
        op = op[0];
    }

    // prepend the context to the beginning of the arguments
    cmdArgs = [context].concat( args );
    // cmdArgs.push(op);
    // console.log('executeCommand args', op, args);

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
            // if(true){ console.log('value> ' + stringify(context.last)) }
            break;
        case ENTITY_FILTER:
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
                throw new Error('unknown cmd (' + stringify(op) + ') ' + stringify(_.rest(arguments)) );
            }
            // console.log('running CmdFunction for op', op);
            result = cmdFunction.apply( context, cmdArgs );
            break;
    }
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
export function register( token, command, dslObj, options={} ){
    
    // if( commandFunctions[ name ] !== undefined ){
    //     throw new Error('already registered cmd ' + name );
    // }

    if( dslObj ){
        _.each( dslObj, (fn,name) => {
            DslContext.prototype[name] = fn;
        })
    }

    const argCount = _.isUndefined(options.argCount) ? 1 : options.argCount;

    if( !Array.isArray(token) ){
        token = [token];
    }

    _.each( token, name => {
        if( commandFunctions[ name ] !== undefined ){
            throw new Error('already registered cmd ' + name );
        }
        
        // if( options.debug ){ console.log('registering', name); }
        
        argCounts[name] = argCount;

        if( command ){
            commandFunctions[name] = command;
        }

        if( options.compile ){
            compileCommands[name] = options.compile;
        }
    })
    
    return Query;
}

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


Query.toQuery = function( query ){
    if( Query.isQuery(query) ){
        return query;
    }
    if( _.isFunction(query) ){
        return new Query(query);
    }
    return null;
}