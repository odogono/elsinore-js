'use strict';

var _ = require('underscore');
var Q = require('./index');


function precendence( operator ){
    switch( operator ){
        case Q.AND:
        case Q.ALL:
        case Q.NOT:
        case Q.OR:
            return 1;
        case Q.VALUE:
            return 2;
        case Q.EQUALS:
        // case Q.PLUCK:
        // case Q.FILTER:
        default:
            return -1;
    }
    return -1;
}

function argCount( operator ){
    switch( operator ){
        case Q.FILTER:
        case Q.PLUCK:
        // case Q.ALIAS:
        case Q.ALIAS_GET:
        case Q.ALL:
        case Q.NONE:
        case Q.ATTR:
            return 1;
        default:
            return 2;
    }
}

var FilterFunctions = {
    all: function (val){
        var context = readContext( this );
        context.pushVal( [Q.ALL, Q.ROOT, val] );
        if( context.isFilterFunctionContext ){
            context.pushOp( Q.AND );
        }
        return filterFunctionContext( context );
    },
    none: function (val){
        var context = readContext( this );
        context.pushVal( [Q.NONE, Q.ROOT, val] );
        if( context.isFilterFunctionContext ){
            context.pushOp( Q.AND );
        }
        return filterFunctionContext( context );
    },
};


// this special context limits component filters
//
function filterFunctionContext( context ){
    var result;
    result = new Q();
    result.valStack = context.valStack;
    result.opStack = context.opStack;

    // return _.extend( result, StackFunctions, FilterFunctions, QueryFunctions );

    return _.extend( result, StackFunctions, {
        isFilterFunctionContext: true,
        all: context.all,
        none: context.none,
        toArray: context.toArray
    });
}

function isFilterOp( op ){
    if( !op ){ return false; }
    return (op[0] === Q.ALL || op[0] === Q.NONE);
}

var QueryFunctions = {

    and: function( val ){
        var context = readContext( this );
        context.pushVal( val, true );
        context.pushOp( Q.AND );
        return context;
    },

    or: function ( val ){
        this.pushVal( val, true );
        this.pushOp( Q.OR );
        return this;
    },

    equals: function( val ){
        this.pushVal( val, true );
        this.pushOp( Q.EQUALS );
        return this;
    },

    lessThan: function( val ){
        this.pushVal( val, true );
        this.pushOp( Q.LESS_THAN );
        return this;  
    },
    lessThanOrEqual: function( val ){
        this.pushVal( val, true );
        this.pushOp( Q.LESS_THAN_OR_EQUAL );
        return this;  
    },

    greaterThan: function( val ){
        this.pushVal( val, true );
        this.pushOp( Q.GREATER_THAN );
        return this;  
    },

    greaterThanOrEqual: function( val ){
        this.pushVal( val, true );
        this.pushOp( Q.GREATER_THAN_OR_EQUAL );
        return this;  
    },

    alias: function( name, value ){
        var context = readContext( this );
        // value = value || Q.NONE;

        if( value ){
            context.pushOp( Q.ALIAS );
        } else {
            context.pushOp( Q.ALIAS_GET );
        }
        context.pushVal( name, true );
        if( value ){
            context.pushVal( value, true );
        }

        return context;
    },

    /**
    *   Returns a value with componentsIds with all of values excluded
    */
    without: function( componentIds ){
        var context = readContext( this );

        context.pushOp( Q.WITHOUT );
        // the preceeding command is used as the first argument
        context.pushVal( componentIds, true );

        return context;
    },

    as: function( name ) {
        // return QueryFunctions.alias.call( this, name );
        var context = readContext( this );
        
        // console.log('valStack is: ' + JSON.stringify(this.valStack) );
        context.pushOp( Q.ALIAS );
        // console.log('valStack is: ' + JSON.stringify(this.valStack) );
        context.pushVal( name, true );
        return context;
    },

    pluck: function( componentIds, property, options ){
        var lastCommand;
        var context = readContext( this );

        context.pushOp( Q.PLUCK );

        // log.debug('pluck command with current context: ' + JSON.stringify(context.valStack) + ' ' + JSON.stringify(context.opStack));
        // log.debug( JSON.stringify(this) );

        // gather the previous command from the stack and
        // add as an argument to the function
        lastCommand = popLastCommand( context.valStack );
        
        // if( !lastCommand ){
        //     throw new Error('pluck arg error: no previous command');
        // }

        context.valStack = lastCommand[1];

        context.pushVal( Q.LEFT_PAREN );

        // log.debug('extracted last command ' + JSON.stringify(lastCommand) );
        context.pushValArray( lastCommand[0] );

        context.pushVal( componentIds, true );
        if( property ){ 
            context.pushVal( property, true );
        }
        if( options ){
            // log.debug('adding options ' + options);
            context.pushVal( options, true );
        }

        context.pushVal( Q.RIGHT_PAREN );
        

        return context;
    },

    selectById: function( entitySet, entityIds ){
        var context = readContext( this, false );

        context.pushVal( Q.LEFT_PAREN );
        if( !entitySet || entitySet === Q.ROOT ){
            context.pushVal( Q.ROOT, true );
        }
        context.pushVal( Q.RIGHT_PAREN );

        context.pushOp( Q.SELECT_BY_ID );

        return context;
    },

    filter: function( entitySet, filterFn ){
        var context = readContext( this, false );
        
        // because FILTER is a function, parens must be used to enclose
        // arguments
        context.pushVal( Q.LEFT_PAREN );
        if( !entitySet || entitySet === Q.ROOT ){
            context.pushVal( Q.ROOT, true );
        } else {
            // shortcut - specifying a single string is the same as Q.ALL
            if( _.isString(entitySet) ){
                context.pushVal( [Q.ALL, Q.ROOT, entitySet] );
            } else {
                context.pushVal( entitySet );
            }
        }
        if( filterFn ){
            // log.debug('haz ES ' + JSON.stringify(entitySet) );
            // log.debug('haz filterFn ' + JSON.stringify(filterFn) );
            context.pushVal( filterFn );
        }
        context.pushVal( Q.RIGHT_PAREN );
        context.pushOp( Q.FILTER );

        return context;
    },

    attr: function( componentIds, attrs ){
        var context = readContext( this );
        if( !attrs ){
            attrs = componentIds; componentIds = null;
        }
        context.pushVal( [Q.ATTR, componentIds, attrs] );
        return context;
    },

    value: function( val ){
        var context = readContext( this );
        context.pushVal( val, true );
        return context;
    },

    toArray: function( toTree ){
        var count = 0;
        var op,val,result,vals;
        var ii,len;

        // move reminaing ops
        while( this.opStack.length > 0 ){
            this.pushVal( this.popOp() );
        }

        result = this.valStack;//[];

        // for( ii=0,len=this.valStack.length;ii<len;ii++ ){
        //     op = this.valStack[ii];
        //     if( op[0] === Q.VALUE && Q.isQuery(op[1]) ){
        //         op[1] = op[1].toArray( toTree );
        //     }
        //     result.push( op );
        // }

        if( toTree ){
            return this.commands = rpnToTree( result );
        }



        return result;
    },

};


/**
*   Returns the next command and its arguments from the passed values starting from the right
*   Returns an array:
*   head - the extracted last command
*   tail - the remainder of the values
*/
function popLastCommand( values ){
    var ii,count, index, op, arg, cmd = [];
    
    index = values.length-1;

    while( index > 0 ){
        // pick off the cmd
        op = values[ index-- ];
        cmd.unshift( op );

        // figure out how many args to take from the stack
        count = argCount( op );

        ii = 0;
        while( ((ii++) < count) && index >= 0 ){
            arg = popLastArg( values, index );
            cmd = arg[0].concat(cmd);

            index = Math.max(0,arg[1].length-1);
        }
    }
    return [ cmd, values.slice(0,index) ];
}

/**
*   Pops the last 'argument' from the values starting at the index
*   Returns an array:
*        head - argument
*        tail - rest of values
*/
function popLastArg( values, index ){
    var parentCount, op, index, leftIndex;
    op = values[index];

    if( /*op === Q.LEFT_PAREN ||*/ op === Q.RIGHT_PAREN ){
        leftIndex = findMatchingLeftParen( values, index );
        return [ values.slice(leftIndex,index+1), leftIndex > 0 ? values.slice(0,leftIndex) : [] ];
    } else {
        return [ [op], values.slice(0,index) ];
    }
}

/**
*   Converts an RPN expression into an AST
*/
Q.rpnToTree = rpnToTree;
function rpnToTree( values ){
    var ii, len, op, stack, rightIndex, slice, result, count;

    stack = [];
    result = [];

    for( ii=0,len=values.length;ii<len;ii++ ){
        op = values[ii];

        if( op === Q.LEFT_PAREN ){
            // cut out this sub and convert it to a tree
            slice = findMatchingRightParam( values, ii );
            
            if( !slice || slice.length === 0 ){
                throw new Error('mismatch parentheses');
            }

            ii += (slice.length+1);

            // evaluate this sub command before pushing it to the stack
            slice = rpnToTree(slice);

            stack.push( slice );
        }
        else {
            if( _.isArray(op) ){
                // log.debug('pushing ' + JSON.stringify(op) );
                stack.push( op );
            } else {

                // figure out how many arguments to take from the stack
                count = argCount( op );
                slice = stack.splice( stack.length-count, count );

                if( _.isArray(slice) && slice.length === 1 ){
                    slice = _.flatten( slice, true );
                }

                // TODO: generalise this
                // it arises because aliasing value is read in
                if( op === Q.ALIAS ){
                    slice = slice.reverse();
                }

                // TODO: ugh, occasionally args will get flattened too much
                if( slice[0] === Q.VALUE ){
                    // note only happens with Q.ALIAS_GET
                    log.debug('overly flat ' + JSON.stringify([op].concat(slice)));
                    slice = [slice];
                }
                stack.push( [op].concat(slice) );
            }
        }
    }

    return stack;
}


/**
*   Returns the index of the matching left paren
*   starting from the right paren.
*/
function findMatchingLeftParen( values, index ){
    var parenCount = 0;
    while( index > 0 ){
        if( values[index] === Q.RIGHT_PAREN ){
            parenCount++;
        } else if( values[index] === Q.LEFT_PAREN ){
            parenCount--;
        }
        if( parenCount === 0 ){
            return index;
        }
        index = index - 1;
    }
    return index;
}


function findMatchingRightParam( values, startIndex ){
    var ii,len, parenCount = 0;
    var result = [];

    for( ii=0,len=values.length;ii<len;ii++ ){
        if( values[ii] === Q.LEFT_PAREN ){
            parenCount++;
        } else if( values[ii] === Q.RIGHT_PAREN ){
            parenCount--;
            if( parenCount === 0 ){
                return result;
            }
        }
        if( ii > 0 && parenCount > 0 ){
            result.push( values[ii] );
        }
    }
    return result;
}


var StackFunctions = {
    popVal: function(){
        var val = this.valStack.shift();
        if( val && val.isQuery ){
            return val.toArray();
        }
        return val;
    },
    peekVal: function(){
        return this.valStack[0];
    },
    lastOp: function(){
        return this.opStack[ this.opStack.length -1 ];
    },
    popOp: function(){
        return this.opStack.pop();
    },
    pushOp: function( op  ){
        var lastOp = this.lastOp();
        while( this.opStack.length > 0 && (precendence( op ) <= precendence( lastOp )) ){
            this.pushVal( this.popOp() );
        }
        this.opStack.push( op );
    },
    pushVal: function(val, wrapInValueTuple){
        var out;
        var concat;
        var isQuery, isArray;
        // log.debug('pushing val ' + JSON.stringify(val) + ' ' + typeof val + ' ' + Q.isQuery(val) );
        
        isQuery = Q.isQuery(val);
        isArray = _.isArray(val);

        if( wrapInValueTuple ){
            if( !isQuery && (!isArray || val[0] !== Q.VALUE) ){
                // log.debug('wrapping! ' + JSON.stringify(val) );
                val = [Q.VALUE,val];
            }  else {
                // log.debug('not wrapping! ' + JSON.stringify(val) );
            }
        }

        if( val && isQuery ){//Q.isQuery(val) ){
            out = val.toArray();
            this.valStack = this.valStack.concat( out );
        } else {
            this.valStack.push( val );
        }
        return this;
    },
    pushValArray: function(val){
        this.valStack = this.valStack.concat( val );
        return this;
    }
}


function readContext( context, addFilterFunctions, addStackFunctions, addQueryFunctions ){
    var result, functions;

    if( _.isUndefined(addStackFunctions) ){ addStackFunctions = true; }
    if( _.isUndefined(addFilterFunctions) ){ addFilterFunctions = true; }
    if( _.isUndefined(addQueryFunctions) ){ addQueryFunctions = true; }

    if( context === Q ){
        // create a new Query
        // return new Query();
        result = new Q();
        result.valStack = [];
        result.opStack = [];

        functions = [];
        if( addStackFunctions ){ functions.push( StackFunctions ); }
        if( addFilterFunctions ){ functions.push( FilterFunctions ); }
        if( addQueryFunctions ){ functions.push( QueryFunctions ); }

        if( functions.length > 0 ){
            return _.extend.apply( null, [result].concat(functions) );
            // return _.extend( result, StackFunctions, FilterFunctions, QueryFunctions );
        }
        return result;
        
        /*return _.extend({},{
            isQuery: true,
            valStack: [],
            opStack: [],
        }, StackFunctions, FilterFunctions, QueryFunctions );//*/
    }
    else if( Q.isQuery(context) ){ //context.isQuery ){
        return context;
    } else {
        // printIns( arguments );
        console.log('context ' + (typeof context) );
        throw new Error('invalid context' );
    }
}

function contextData( context ){
    var result = {
        isQuery: true,
        valStack: context.valStack,
        opStack: context.opStack
    };
    if( context.isArguments ){
        result.isArguments = true;
    }
    return result;
}

// these are the starting functions
_.extend( Q, {
    attr: QueryFunctions.attr,
    value: QueryFunctions.value,
    filter: QueryFunctions.filter,
    alias: QueryFunctions.alias,
    selectById: QueryFunctions.selectById,

    // for testing
    popLastCommand: popLastCommand,
    popLastArg: popLastArg
}, FilterFunctions );

module.exports = Q;