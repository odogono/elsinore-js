import _ from 'underscore';
import Query from './index';
import * as Q from './index';


function precendence( operator ){
    let result;

    result = Q.precendenceValues[ operator ];
    if( result !== undefined ){
        return result;
    }

    switch( operator ){
        case Q.AND:
        case Q.ALL:
        case Q.ANY:
        case Q.NOT:
        case Q.OR:
            return 1;
        case Q.VALUE:
            return 2;
        case Q.EQUALS:
        // case Q.ALL_FILTER:
        default:
            return -1;
    }
}


function argCount( operator ){
    let result;

    result = Q.argCounts[ operator ];
    if( result !== undefined ){
        return result;
    }
    
    switch( operator ){
        case Q.FILTER:
        case Q.ALL:
        case Q.ANY:
        case Q.NONE:
        case Q.ATTR:
            return 1;
        case Q.ROOT:
        default:
            return 2;
    }
}

let FilterFunctions = {
    /**
    *   The entities must have ALL of the specified components
    */
    all: function (componentIds, filterFn){
        let context = readContext( this );
        context.pushOp( Q.ALL_FILTER );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }

        return context;
    },

    include: function(componentIds, filterFn){
        let context = readContext( this );
        // context.pushOp( filterFn ? Q.INCLUDE_FILTER : Q.INCLUDE );
        context.pushOp( Q.INCLUDE_FILTER );
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
        let context = readContext( this );
        // context.pushOp( filterFn ? Q.ANY_FILTER : Q.ANY );
        context.pushOp( Q.ANY_FILTER );
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
        let context = readContext( this );
        context.pushOp( Q.NONE_FILTER );
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

let QueryFunctions = {

    and: function( val ){
        let context = readContext( this );
        context.pushVal( val, true );
        context.pushOp( Q.AND );
        return context;
    },

    or: function ( val ){
        this.pushVal( val, true );
        this.pushOp( Q.OR );
        return this;
    },

    where: function( clauses ){
        let context = readContext(this);
        clauses = _.toArray(arguments);

        if( clauses.length <= 0 ){
            return this;
        }
        if( clauses.length === 1 ){
            context.pushVal( clauses[0] );
        } else {
            clauses = _.reduce( clauses, function(res, clause, i){
                res.push( clause.toArray() );
                if( res.length > 1 ){
                    res.push( Q.AND );
                }
                return res;
            },[]);

            this.valStack = this.valStack.concat( _.flatten(clauses, true) );
        }
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

    /**
    *   Selects a component attribute
    */
    attr: function( attr ){
        let lastCommand, op, val;
        let context = readContext( this, false, true, true );

        context.pushVal( [Q.ATTR, attr] );

        return context;
    },

    value: function( val ){
        let context = readContext( this );
        context.pushVal( val, true );
        return context;
    },

    root: function(){
        let context = readContext(this);
        context.pushOp( Q.ROOT );
        return context;
    },

    toArray: function( toTree ){
        let count = 0;
        let op,val,result,vals;
        let ii,len;

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

// Q.toArray = function( query, toTree ){
//     let commands = query;

//     if( Q.isQuery(query) ){
//         return query.toArray( toTree );
//     }

//     if( _.isArray(query) ){
//         return _.reduce( query, (result, command) => {
//             if( Q.isQuery(command) ){
//                 command = command.toArray( toTree );
//             }
//             result = result.concat( command );
//             return result;
//         },[]);
//     }
//     return null;
// }


/**
*   Converts an RPN expression into an AST
*/
// Q.rpnToTree = rpnToTree;
function rpnToTree( values ){
    let ii, len, op, stack, rightIndex, slice, result, count;

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
    let ii,len, parenCount = 0;
    let result = [];

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


let StackFunctions = {
    popVal: function(){
        let val = this.valStack.shift();
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
        let lastOp = this.lastOp();
        while( this.opStack.length > 0 && (precendence( op ) <= precendence( lastOp )) ){
            this.pushVal( this.popOp() );
        }
        this.opStack.push( op );
    },

    pushVal: function(val, wrapInValueTuple){
        let out;
        let concat;
        let isQuery, isArray;
        
        isQuery = Q.isQuery(val);
        isArray = _.isArray(val);

        // log.debug('pushing val ' + JSON.stringify(val) + ' ' + isQuery + ' ' + isArray );

        if( wrapInValueTuple ){
            if( !isQuery ){//&& (!isArray)){// || val[0] !== Q.VALUE) ){
                // log.debug('wrapping! ' + JSON.stringify(val) );
                val = [Q.VALUE,val];
            }  
            // else {
            //     log.debug('not wrapping! ' + JSON.stringify(val) );
            // }
        }
        // log.debug('>pushVal ' + JSON.stringify(val) );
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
    let result, functions;

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
        // if( addFilterFunctions ){ functions.push( FilterFunctions ); }
        if( addQueryFunctions ){ functions.push( QueryFunctions ); }

        if( functions.length > 0 ){
            return _.extend.apply( null, [result].concat(functions) );
        }
        return result;
    }
    else if( Q.isQuery(context) ){ //context.isQuery ){
        return context;
    } else {
        console.log('context ' + (typeof context) );
        throw new Error('invalid context' );
    }
}

function contextData( context ){
    let result = {
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
// _.extend( Q, {
//     readContext: readContext,

//     attr: QueryFunctions.attr,
//     value: QueryFunctions.value,
//     root: QueryFunctions.root,
//     pipe: QueryFunctions.pipe,
//     // pluck: QueryFunctions.pluck,
//     // without: QueryFunctions.without,
// }, FilterFunctions );


// module.exports = Q;

export class DslContext {
    constructor(query){
        this.query = query;
        this.valStack = [];
        this.opStack = [];
    }

    /**
     * takes the specified context and returns a new instance
     * of a DslContext if the passed context is not already a DslContext.
     */
    readContext(context){
        // the context has to be a new instance of a DslContext,
        // so that it is possible to compose a query using subqueries
        if( context instanceof QueryBuilder ){
            let result = new DslContext(context.query)
            return result;
        }
        return context;
    }

    value( val ){
        const context = this.readContext( this );
        context.pushVal( val, true );
        return context;
    }

    root(){
        const context = this.readContext( this );
        context.pushOp( Q.ROOT );
        return context;
    }

    and( val ){
        const context = this.readContext( this );
        context.pushVal( val, true, 'fromAnd' );
        context.pushOp( Q.AND );
        return context;
    }

    or( val ){
        this.pushVal( val, true );
        this.pushOp( Q.OR );
        return this;
    }

    where( ...clauses ){
        const context = this.readContext( this );

        if( clauses.length <= 0 ){
            return context;
        }
        if( clauses.length === 1 ){
            context.pushVal( clauses[0] );
        } else {
            clauses = _.reduce( clauses, (res, clause, i) => {
                res.push( clause.toArray() );
                if( res.length > 1 ){
                    res.push( Q.AND );
                }
                return res;
            },[]);

            context.valStack = context.valStack.concat( _.flatten(clauses, true) );
        }
        return context;
    }

    equals( val ){
        this.pushVal( val, true );
        this.pushOp( Q.EQUALS );
        return this;
    }

    lessThan( val ){
        this.pushVal( val, true );
        this.pushOp( Q.LESS_THAN );
        return this;  
    }

    lessThanOrEqual( val ){
        this.pushVal( val, true );
        this.pushOp( Q.LESS_THAN_OR_EQUAL );
        return this;  
    }

    greaterThan( val ){
        this.pushVal( val, true );
        this.pushOp( Q.GREATER_THAN );
        return this;  
    }

    greaterThanOrEqual( val ){
        this.pushVal( val, true );
        this.pushOp( Q.GREATER_THAN_OR_EQUAL );
        return this;  
    }

    /**
    *   Selects a component attribute
    */
    attr( attr ){
        const context = this.readContext( this );
        context.pushVal( [Q.ATTR,attr] );
        return context;

        // let lastCommand, op, val;
        // let context = readContext( this, false, true, true );

        // context.pushVal( [Q.ATTR, attr] );

        // return context;
    }

    // 
    // Filter Functions
    // 

    /**
    *   The entities must have ALL of the specified components
    */
    all(componentIds, filterFn){
        const context = this.readContext( this );
        context.pushOp( Q.ALL_FILTER );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }

        return context;
    }

    include(componentIds, filterFn){
        const context = this.readContext( this );
        // context.pushOp( filterFn ? Q.INCLUDE_FILTER : Q.INCLUDE );
        context.pushOp( Q.INCLUDE_FILTER );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }
        return context;
    }

    /**
    *   Entities should have at least one of the specified components
    */
    any( componentIds, filterFn ){
        const context = this.readContext( this );
        // context.pushOp( filterFn ? Q.ANY_FILTER : Q.ANY );
        context.pushOp( Q.ANY_FILTER );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }
        return context;
    }

    /**
    *   entities will be excluded if the have any of the componentIds
    */
    none(componentIds, filterFn ){
        const context = this.readContext( this );
        context.pushOp( Q.NONE_FILTER );
        context.pushVal( componentIds, true );
        if( filterFn ){
            context.pushVal( filterFn, true );
        }
        return context;
    }


    popVal(){
        let val = this.valStack.shift();
        if( val && val.isQuery ){
            return val.toArray();
        }
        return val;
    }

    peekVal(){
        return this.valStack[0];
    }

    lastOp(){
        return this.opStack[ this.opStack.length -1 ];
    }

    popOp(){
        return this.opStack.pop();
    }

    pushOp( op  ){
        let lastOp = this.lastOp();
        while( this.opStack.length > 0 && (precendence( op ) <= precendence( lastOp )) ){
            this.pushVal( this.popOp() );
        }
        this.opStack.push( op );
    }

    pushVal(val, wrapInValueTuple, label=''){
        const isQuery = val instanceof DslContext;
        
        if( wrapInValueTuple ){
            if( !isQuery ){
                val = [Q.VALUE,val];
            }
        }

        // log.debug(`>pushVal ${label} : ${JSON.stringify(val)}`);
        if( val && isQuery ){
            this.valStack = this.valStack.concat( val.toArray() );
        } else {
            this.valStack.push(val);
        }
        return this;
    }

    /**
     * 
     */
    toArray( toTree=false ){
        let count = 0;
        let op,val,result,vals;
        let ii,len;

        // console.log('QB.toArray op', this.opStack, 'val', this.valStack );
        // move reminaing ops
        while( this.opStack.length > 0 ){
            this.pushVal( this.popOp() );
        }

        // console.log('QB.toArray B val', this.valStack );

        result = this.valStack;

        if( toTree ){
            return this.commands = rpnToTree( result );
        }

        return result;
    }
}


// const BaseFunctions = (SuperClass) => class extends SuperClass {
//     readContext(context){
//         return context;
//     }
// }



// const MainFunctions = (SuperClass) => class extends SuperClass {
//     value( val ){
//         const context = this.readContext(this);
//         this.pushVal(val,true);
//         return context;
//     }
// }



export default class QueryBuilder extends DslContext {

    constructor( query ){
        super(query);
    }

    and(){ throw new Error('invalid function and'); }
    or(){ throw new Error('invalid function or'); }
    where(){ throw new Error('invalid function where'); }

    // toArray( query, toTree ){
    //     let commands = query;

    //     if( Q.isQuery(query) ){
    //         return query.toArray( toTree );
    //     }

    //     if( _.isArray(query) ){
    //         return _.reduce( query, (result, command) => {
    //             if( Q.isQuery(command) ){
    //                 command = command.toArray( toTree );
    //             }
    //             result = result.concat( command );
    //             return result;
    //         },[]);
    //     }
    //     return null;
    // }

}