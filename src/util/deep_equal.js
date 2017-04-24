import stringify from './stringify';

/**
 * Returns true if both values are equal 
 * @param {*} val1 
 * @param {*} val2 
 */
export default function deepEqual(val1,val2){
    if( val1 === val2 ){ return true; }
    return stringify(val1) === stringify(val2);
}