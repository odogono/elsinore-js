'use strict';

var _ = require('underscore');
var Q = require('./index');
var Utils = require('../utils');

function precendence( operator ){
    switch( operator ){
        case Q.AND:
        case Q.ALL:
        case Q.ANY:
        case Q.NOT:
        case Q.OR:
            return 1;
        case Q.VALUE:
        case Q.ALIAS_GET:
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
        case Q.ALIAS:
        case Q.ALIAS_GET:
        case Q.ALL:
        case Q.ANY:
        case Q.NONE:
        case Q.ATTR:
        case Q.WITHOUT:
        case Q.SELECT_BY_ID:
            return 1;
        case Q.ROOT:
        default:
            return 2;
    }
}

var FilterFunctions = {
    /**
    *   The entities must have ALL of the specified components
    */
    all: function (componentIds, filterFn){
        var context = readContext( this );
        context.pushOp( filterFn ? Q.ALL_FILTER : Q.ALL );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }

        return context;
    },

    /**
    *   Entities should have at least one of the specified components
    */
    any: function( componentIds, filterFn ){
        var context = readContext( this );
        context.pushOp( filterFn ? Q.ANY_FILTER : Q.ANY );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }
        return context;
    },

    /**
    *   entities will be excluded if the have any of the componentIds
    */
    none: function (componentIds, filterFn ){
        var context = readContext( this );
        context.pushOp( filterFn ? Q.NONE_FILTER : Q.NONE );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }
        return context;
    },
};


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

    pipe: function( commands ){
        var context = readContext(this);
        commands = _.toArray( arguments );
        context.pushOp( Q.PIPE );
        // printIns( commands );
        // log.debug('adding ' + commands.length + ' commands');

        context.pushVal( Q.LEFT_PAREN );
        _.each( commands, function(c){
            // log.debug('adding ' + JSON.stringify(c) );
            context.pushVal( c );
        });
        context.pushVal( Q.RIGHT_PAREN );
        // context.pushVal( commands );
        return context;
    },

    alias: function( name ){
        var context = readContext( this );
        // value = value || Q.NONE;

        // if( value ){
        // context.pushOp( Q.ALIAS );
        // } else {
        context.pushOp( Q.ALIAS_GET );
        // }
        context.pushVal( name, true );
        // if( value ){
        //     context.pushVal( value, true );
        // }

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

    aliasAs: function( name ) {
        // return QueryFunctions.alias.call( this, name );
        var context = readContext( this );
        
        // console.log('valStack is: ' + JSON.stringify(this.valStack) );
        context.pushOp( Q.ALIAS );
        // console.log('valStack is: ' + JSON.stringify(this.valStack) );
        context.pushVal( name, true );

        return context;
    },

    pluck: function( componentIds, property, options ){
        // var lastCommand;
        var context = readContext( this );

        context.pushOp( Q.PLUCK );

        context.pushVal( Q.LEFT_PAREN );

        context.pushVal( componentIds, true );
        
        context.pushVal( property, true );
        
        if( options ){
            // log.debug('adding options ' + options);
            context.pushVal( options, true );
        }

        context.pushVal( Q.RIGHT_PAREN );
        

        return context;
    },

    selectById: function( entityIds ){
        var context = readContext( this, false );

        context.pushVal( Q.LEFT_PAREN );
        
        context.pushVal( entityIds, true );
        context.pushVal( Q.RIGHT_PAREN );

        context.pushOp( Q.SELECT_BY_ID );

        return context;
    },

    /**
    *   Selects a component attribute
    */
    attr: function( attr ){
        var lastCommand, op, val;
        var context = readContext( this, false, true, true );

        context.pushVal( [Q.ATTR, attr] );

        return context;
    },

    value: function( val ){
        var context = readContext( this );
        context.pushVal( val, true );
        return context;
    },

    root: function(){
        var context = readContext(this);
        context.pushOp( Q.ROOT );
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

        result = this.valStack;
        if( toTree ){
            return this.commands = rpnToTree( result );
        }

        return result;
    },

};



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

                // TODO: ugh, occasionally args will get flattened too much
                if( slice[0] === Q.VALUE ){
                    // note only happens with Q.ALIAS_GET
                    // log.debug('overly flat ' + JSON.stringify([op].concat(slice)));
                    slice = [slice];
                }
                stack.push( [op].concat(slice) );
            }
        }
    }

    return stack;
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
        // log.debug('pushing val ' + JSON.stringify(val) + ' ' + isQuery + ' ' + isArray );
        
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
        }
        return result;
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
    root: QueryFunctions.root,
    // filter: QueryFunctions.filter,
    alias: QueryFunctions.alias,
    aliasAs: QueryFunctions.aliasAs,
    selectById: QueryFunctions.selectById,
    pipe: QueryFunctions.pipe,
    pluck: QueryFunctions.pluck,
    without: QueryFunctions.without,
}, FilterFunctions );

module.exports = Q;