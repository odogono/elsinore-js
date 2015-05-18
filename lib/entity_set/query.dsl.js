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
        context.pushVal( [Q.ALL, Q.ROOT, val] );
        context.pushOp( Q.AND_FILTER, true );
        return filterFunctionContext( context );
    },

    none: function( val ){
        var context = readContext( this );
        context.pushVal( [Q.NONE, Q.ROOT, val] );
        context.pushOp( Q.AND_FILTER, true );
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

    filter: function( entitySet, filterFn ){
        var context = readContext( this );
        context.pushOp( Q.FILTER );
        if( !entitySet ){
            context.pushVal( [Q.VALUE, Q.ROOT] );
        } else {
            context.pushVal( entitySet );
        }
        if( filterFn ){
            context.pushVal( filterFn );
        }
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
        if( val && val.isQueryContext ){
            val = val.toArray();
            this.valStack = this.valStack.concat( val );
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
    return {
        isQueryContext: true,
        valStack: context.valStack,
        opStack: context.opStack
    };
}


_.extend( Q, {
    attr: QueryFunctions.attr,
    value: QueryFunctions.value,
    filter: QueryFunctions.filter,
}, FilterFunctions);

module.exports = Q;