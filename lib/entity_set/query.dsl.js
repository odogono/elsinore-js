'use strict';

var _ = require('underscore');
var Q = require('./query');


var QueryFunctions = {
    and: function( val ){
        this.valStack.push( [Q.VALUE, val] );
        this.opStack.push( Q.AND );
        return this;
    },

    equals: function( val ){
        this.valStack.push( [Q.VALUE, val] );
        this.opStack.push( Q.EQUALS );
        return this;
    },

    filter: function( entitySet, filterFn ){
        var context = readContext( this );
        context.opStack.push( Q.FILTER );
        if( !entitySet ){
            context.valStack.push( [Q.VALUE, Q.ROOT] );
        } else {
            context.valStack.push( entitySet );
        }
        if( filterFn ){
            context.valStack.push( filterFn );
        }
        return context;
    },

    attr: function( componentIds, attrs ){
        var context = readContext( this );
        context.valStack.push( [Q.ATTR, componentIds, attrs] );
        // printIns( context, 1 );
        return context;
    },

    value: function( val ){
        var context = readContext( this );
        context.valStack.push( [Q.VALUE, val] );
        return context;
    },

    toArray: function(){
        var op,val,result;
        // printIns( this );
        result = [];
        while( this.opStack.length > 0 ){

            result.push( this.opStack.shift() );
            result.push( popValStack( this ) );
            result.push( popValStack( this ) );
        }

        return result;
    }
};

function popValStack( context ){
    var val = context.valStack.shift();
    if( val.isQueryContext ){
        return val.toArray();
    }
    return val;
}

function readContext( context ){
    if( context === Q ){
        return _.extend({},{
            isQueryContext: true,
            queue: [],
            valStack: [],
            opStack: [],
        }, QueryFunctions );
    }
    else if( context.isQueryContext ){
        return context;
    } else {
        throw new Error('invalid context');
    }
}




_.extend( Q, {
    attr: QueryFunctions.attr,
    value: QueryFunctions.value,
    filter: QueryFunctions.filter
});

_.extend( Q.prototype, QueryFunctions, {
    isQuery: true,
    type: 'Query',
});




module.exports = Q;