import { QueryOp } from '../types';
import {deepEqual} from '../util/deep_equal';
import { register } from './dsl';

// export const EQUALS = '=='; // == 
// export const NOT_EQUAL = '!='; // !=
// export const LESS_THAN = '<'; // <
// export const LESS_THAN_OR_EQUAL = '<=';
// export const GREATER_THAN = '>'; // >
// export const GREATER_THAN_OR_EQUAL = '>=';



function dslEquals( val ){
    this.pushVal( val, true );
    this.pushOp( QueryOp.Equals );
    return this;
}

function dslLessThan( val ){
    this.pushVal( val, true );
    this.pushOp( QueryOp.LessThan );
    return this;  
}

function dslLessThanOrEqual( val ){
    this.pushVal( val, true );
    this.pushOp( QueryOp.LessThanOrEqual );
    return this;  
}

function dslGreaterThan( val ){
    this.pushVal( val, true );
    this.pushOp( QueryOp.GreaterThan );
    return this;  
}

function dslGreaterThanOrEqual( val ){
    this.pushVal( val, true );
    this.pushOp( QueryOp.GreaterThanOrEqual );
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
        if( op == QueryOp.Equals ){
            result = value1.indexOf(value2) !== -1;
        }
    }
    else if( !isValue1Array && isValue2Array ){
        if( op == QueryOp.Equals ){
            result = (value2.indexOf(value1) !== -1);
        }
    }
    else if( !isValue1Array && !isValue2Array ){
        switch( op ){
            case QueryOp.LessThan:
                result = (value1 < value2);
                break;
            case QueryOp.LessThanOrEqual:
                result = (value1 <= value2);
                break;
            case QueryOp.GreaterThan:
                result = (value1 > value2);
                break;
            case QueryOp.GreaterThanOrEqual:
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
        if( op == QueryOp.Equals ){
            result = deepEqual( value1, value2 );
        }
    }
    
    return (context.last = [QueryOp.Value, result]);
}


const tokens = [QueryOp.Equals,
    QueryOp.LessThan,
    QueryOp.LessThanOrEqual,
    QueryOp.GreaterThan,
    QueryOp.GreaterThanOrEqual];

const dslFunctions = {
    'equals': dslEquals,
    'lessThan': dslLessThan,
    'lessThanOrEqual': dslLessThanOrEqual,
    'greaterThan': dslGreaterThan,
    'greaterThanOrEqual': dslGreaterThanOrEqual
};

register(tokens, commandEquals, dslFunctions, {argCount:2,precedence:-1, debug:true} );