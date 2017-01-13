import _ from 'underscore';
import Query from './index';
import {DslContext} from './dsl';
import EntitySet from '../entity_set';
import {deepEqual, hash, stringify} from '../util';

import {register,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE} from './index';

export const EQUALS = '=='; // == 
export const NOT_EQUAL = '!='; // !=
export const LESS_THAN = '<'; // <
export const LESS_THAN_OR_EQUAL = '<=';
export const GREATER_THAN = '>'; // >
export const GREATER_THAN_OR_EQUAL = '>=';



function dslEquals( val ){
    this.pushVal( val, true );
    this.pushOp( EQUALS );
    return this;
}

function dslLessThan( val ){
    this.pushVal( val, true );
    this.pushOp( LESS_THAN );
    return this;  
}

function dslLessThanOrEqual( val ){
    this.pushVal( val, true );
    this.pushOp( LESS_THAN_OR_EQUAL );
    return this;  
}

function dslGreaterThan( val ){
    this.pushVal( val, true );
    this.pushOp( GREATER_THAN );
    return this;  
}

function dslGreaterThanOrEqual( val ){
    this.pushVal( val, true );
    this.pushOp( GREATER_THAN_OR_EQUAL );
    return this;  
}


/**
*   Compares the two operands for equality and returns 
*   a VALUE with the boolean result of that comparison
*/
export function commandEquals( context, op1, op2 ){
    const op = context.op;
    let result;
    let value1;
    let value2;
    let isValue1Array, isValue2Array;
    result = false;

    // console.log('commandEquals', stringify(op1), stringify(op2), op );
    // if( true ){ console.log('EQUALS op1: ' + stringify(op1) ); }
    // if( true ){ console.log('EQUALS op2: ' + stringify(op2) ); }

    value1 = context.valueOf( op1, true );
    value2 = context.valueOf( op2, true );
    isValue1Array = Array.isArray(value1);
    isValue2Array = Array.isArray(value2);

    // if( true ){ console.log('commandEquals', stringify(value1), op, stringify(value2) ); }

    if( isValue1Array && !isValue2Array ){
        if( op == EQUALS ){
            result = _.indexOf(value1,value2) !== -1;
        }
    }
    else if( !isValue1Array && isValue2Array ){
        if( op == EQUALS ){
            result = (_.indexOf(value2,value1) !== -1);
        }
    }
    else if( !isValue1Array && !isValue2Array ){
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
                if( value2 instanceof RegExp ){
                    result = value2.test(value1);
                }else {
                    result = (value1 === value2);
                }
                break;
        }
    } else {
        if( op == EQUALS ){
            result = deepEqual( value1, value2 );
        }
    }
    
    return (context.last = [ VALUE, result ]);
}


const tokens = [EQUALS,
    LESS_THAN,
    LESS_THAN_OR_EQUAL,
    GREATER_THAN,
    GREATER_THAN_OR_EQUAL];

const dslFunctions = {'equals': dslEquals,
         'lessThan': dslLessThan,
         'lessThanOrEqual': dslLessThanOrEqual,
         'greaterThan': dslGreaterThan,
         'greaterThanOrEqual': dslGreaterThanOrEqual};

register(tokens, commandEquals, dslFunctions, {argCount:2,precedence:-1, debug:true} );