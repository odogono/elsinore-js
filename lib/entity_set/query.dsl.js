'use strict';

var _ = require('underscore');
var Q = require('./query');


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
    return _.extend( contextData(context), StackFunctions, {
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
        this.pushVal( [Q.VALUE, val] );
        this.pushOp( Q.AND );
        return this;
    },

    or: function ( val ){
        this.pushVal( [Q.VALUE, val] );
        this.pushOp( Q.OR );
        return this;
    },

    equals: function( val ){
        this.pushVal( [Q.VALUE, val] );
        this.pushOp( Q.EQUALS );
        return this;
    },

    alias: function( name, value ){
        var context = readContext( this );
        context.pushOp( Q.FILTER );

        context.pushVal( [Q.VALUE], name );
        if( value ){
            context.pushVal( [Q.VALUE], value );
        } else {
            context.pushVal( [Q.VALUE], Q.NONE );
        }
        // this.pushOp( Q.ALIAS );
        return context;
    },

    filter: function( entitySet, filterFn ){
        var context = readContext( this );
        
        context.pushVal( Q.LEFT_PAREN );
        if( !entitySet ){
            context.pushVal( [Q.VALUE, Q.ROOT] );
        } else {
            // shortcut - specifying a single string is the same as Q.ALL
            if( _.isString(entitySet) ){
                context.pushVal( [Q.ALL, Q.ROOT, entitySet] );
            } else {
                context.pushVal( entitySet, true );
            }
        }
        if( filterFn ){
            context.pushVal( filterFn, true );
        }
        context.pushVal( Q.RIGHT_PAREN );

        context.pushOp( Q.FILTER );
        return context;
    },

    attr: function( componentIds, attrs ){
        var context = readContext( this );

        context.pushVal( [Q.ATTR, componentIds, attrs] );
        return context;
    },

    value: function( val ){
        var context = readContext( this );
        context.pushVal( [Q.VALUE, val] );
        return context;
    },

    toArray: function( toTree ){
        var op,val,result,vals;
        result = [];
        var count = 0;

        // move reminaing ops
        while( this.opStack.length > 0 ){
            this.pushVal( this.popOp() );
        }

        if( toTree ){
            return rpnToTree( this.valStack );
        }

        return this.valStack;
    },

    toGraphViz: function(){
        // TODO
    }
};

function rpnToTree( values ){
    var i, len, op, stack, rightIndex, slice, result, count;

    stack = [];
    result = [];

    for( i=0,len=values.length;i<len;i++ ){
        op = values[i];

        if( op === Q.LEFT_PAREN ){
            // cut out this sub and convert it to a tree
            slice = findMatchingRightParam( values, i );
            if( !slice || slice.length === 0 ){
                throw new Error('mismatch parentheses');
            }
            i += slice.length+1;

            // evaluate this sub command before pushing it to the stack
            slice = rpnToTree(slice);

            stack.push( slice );
        }
        else {
            if( _.isArray(op) ){
                stack.push( op );
            } else {
                // figure out how many arguments to take from the stack
                count = argCount( op );
                slice = stack.splice( stack.length-count, count );

                if( _.isArray(slice) && slice.length === 1 ){
                    slice = _.flatten( slice, true );
                }

                stack.push( [op].concat(slice) );
            }
        }
    }

    return stack;
}

function findMatchingRightParam( values, startIndex ){
    var i,len, parenCount = 0;
    var result = [];

    for( i=0,len=values.length;i<len;i++ ){
        if( values[i] === Q.LEFT_PAREN ){
            parenCount++;
        } else if( values[i] === Q.RIGHT_PAREN ){
            parenCount--;
            if( parenCount === 0 ){
                return result;
            }
        }
        if( i > 0 && parenCount > 0 ){
            result.push( values[i] );
        }
    }
    return result;
}

function popArgumentsFromStack( stack, count ){
    var i,len,result = [], parenCount = 0;
    count = count || 2;
    for( i= stack.length-1;i>=0;i-- ){
        if( stack[i] === Query.RIGHT_PAREN ){
            parenCount++;
        }
        else if( stack[i] === Query.LEFT_PAREN ){
            parenCount--;
            if( parenCount === 0 ){
                return result;
            }
        }
        else if( parenCount > 0 || result.length < count ){
            result.push( stack[i] );
        }
    }
    return result;
}

var StackFunctions = {
    popVal: function(){
        var val = this.valStack.shift();
        if( val && val.isQueryContext ){
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
    pushVal: function(val){
        var out;
        if( val && val.isQueryContext ){
            out = val.toArray();
            this.valStack = this.valStack.concat( out );
        } else {
            this.valStack.push( val );
        }
    },
}

function readContext( context ){
    if( context === Q ){
        return _.extend({},{
            isQueryContext: true,
            valStack: [],
            opStack: [],
        }, StackFunctions, FilterFunctions, QueryFunctions );
    }
    else if( context.isQueryContext ){
        return context;
    } else {
        throw new Error('invalid context');
    }
}

function contextData( context ){
    var result = {
        isQueryContext: true,
        valStack: context.valStack,
        opStack: context.opStack
    };
    if( context.isArguments ){
        result.isArguments = true;
    }
    return result;
}


_.extend( Q, {
    attr: QueryFunctions.attr,
    value: QueryFunctions.value,
    filter: QueryFunctions.filter,
}, FilterFunctions);

module.exports = Q;