// import { Collection } from './collection';

const getClass = {}.toString;

/**
 * Returns true if the value is undefined
 *
 * @param val
 * @returns {boolean}
 */
export function isUndefined(val) {
    return val === void 0;
}

/**
 * Returns true if the passed value is a Boolean
 *
 * @param {*} object
 */
export function isBoolean(object) {
    return object && getClass.call(object) == '[object Boolean]';
}

/**
 *
 * @param {*} object
 */
export function isString(object) {
    return object && getClass.call(object) == '[object String]';
}

/**
 *
 * @param {*} object
 */
export function isDate(object) {
    return object && getClass.call(object) == '[object Date]';
}

/**
 *
 * @param {*} object
 * @returns {boolean} if the object is a function
 */
export function isFunction(object) {
    return object && getClass.call(object) == '[object Function]';
}

// taken from underscore-contrib/underscore.function.predicates
// cannot include directly in node
// A numeric is a letiable that contains a numeric value, regardless its type
// It can be a String containing a numeric value, exponential notation, or a Number object
// See here for more discussion: http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric/1830844#1830844
export function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

// An integer contains an optional minus sign to begin and only the digits 0-9
// Objects that can be parsed that way are also considered ints, e.g. "123"
// Floats that are mathematically equal to integers are considered integers, e.g. 1.0
// See here for more discussion: http://stackoverflow.com/questions/1019515/javascript-test-for-an-integer
export function isInteger(i) {
    return !isNaN(parseFloat(i)) && isFinite(i) && i % 1 === 0;
}

/**
 * Returns true if the value is a Promise
 * https://github.com/then/is-promise
 *
 * @param p the value to be tested
 * @returns {boolean}
 */
export function isPromise(p) {
    return !!p && (typeof p === 'object' || typeof p === 'function') && typeof p.then === 'function';
}

/**
 * Checks if the value is an object
 *
 * taken from https://github.com/lodash/lodash/blob/master/isObject.js
 *
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 */
export function isObject(value) {
    const type = typeof value;
    return value != null && (type == 'object' || type == 'function');
}

export function isEntitySet(value) {
    return value && value.isEntitySet === true;
}

export function isMemoryEntitySet(value) {
    return isEntitySet(value) && value.isMemoryEntitySet === true;
}

export function isEntity(entity) {
    return entity && entity.isEntity === true;
}

export function isComponent(value){
    return value && value.isComponent === true;
}

export function isCollection(value){
    return value && value.isCollection === true;// instanceof Collection;
}