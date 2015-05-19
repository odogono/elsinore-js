'use strict';

var _ = require('underscore');
var Q = require('./query');


function precendence( operator ){
    switch( operator ){
        case Q.AND: return 1;
        case Q.OR: return 2;
        case Q.ALL: return 1;
        case Q.NOT: return 1;
        case Q.EQUALS: return 1;
        case Q.VALUE: return 2;
    }
    return -1;
}

var FilterFunctions = {
    all: function( val ){
        var context = readContext( this );
        context.isArguments = true;
        context.pushVal( [Q.ALL, Q.ROOT, val] );
        return filterFunctionContext( context );
    },

    none: function( val ){
        var context = readContext( this );
        context.isArguments = true;
        context.pushVal( [Q.NONE, Q.ROOT, val] );
        return filterFunctionContext( context );
    },
};

function filterFunctionContext( context ){
    return _.extend( contextData(context), StackFunctions, {
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
                context.pushVal( entitySet );
            }
        }
        if( filterFn ){
            context.pushVal( filterFn );
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

    toArray: function(){
        var op,val,result,vals;
        result = [];
        var count = 0;

        // move reminaing ops
        while( this.opStack.length > 0 ){
            this.pushVal( this.popOp() );
        }

        return this.valStack;
        return result;
    }
};

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
    pushOp: function( op, ifNotAlreadyLast ){
        var lastOp = this.lastOp();
        if( ifNotAlreadyLast ){
            if( op === lastOp ){
                return this;
            }
        }
        // if( lastOp )
        // console.log('precendence ' + op + ':' + precendence(op) + ' ' + lastOp + ':' + precendence(lastOp) );
        while( this.opStack.length > 0 && (precendence( op ) <= precendence( lastOp )) ){
            this.pushVal( this.popOp() );
        }
        this.opStack.push( op );
    },
    pushVal: function(val){
        var out;
        if( val && val.isQueryContext ){
            out = val.toArray();
            // if( val.isArguments ){
            //     out.unshift( Q.LEFT_PAREN );
            //     out.push( Q.RIGHT_PAREN );
            // }
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