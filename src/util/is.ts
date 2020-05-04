const getClass:Function = {}.toString;

/**
 * Checks if the value is an object
 *
 * 
 *
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 */
export function isObject(value:any): boolean {
    // taken from https://github.com/lodash/lodash/blob/master/isObject.js
    // const type = typeof value;
    // return value != null && (type === 'object' || type === 'function')
    return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 *
 * @param {*} object
 */
export function isString(value:any): boolean {
    return getClass.call(value) === '[object String]';
}

/**
 *
 * @param {*} object
 * @returns {boolean} if the object is a function
 */
export function isFunction(value:any): boolean {
    return value && getClass.call(value) === '[object Function]';
}

/**
 *
 * @param {*} object
 */
export function isDate(value:any): boolean {
    return value && getClass.call(value) === '[object Date]';
}


// taken from underscore-contrib/underscore.function.predicates
// cannot include directly in node

// A numeric is a letiable that contains a numeric value, regardless its type
// It can be a String containing a numeric value, exponential notation, or a Number object
// See here for more discussion: http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric/1830844#1830844
export function isNumeric(n:any): boolean {
    return !Number.isNaN(parseFloat(n)) && isFinite(n);
}

// An integer contains an optional minus sign to begin and only the digits 0-9
// Objects that can be parsed that way are also considered ints, e.g. "123"
// Floats that are mathematically equal to integers are considered integers, e.g. 1.0
// See here for more discussion: http://stackoverflow.com/questions/1019515/javascript-test-for-an-integer
export function isInteger(i:any): boolean {
    return !Number.isNaN(parseFloat(i)) && isFinite(i) && i % 1 === 0;
}


/**
 * Returns true if the passed value is a boolean
 */
export function isBoolean(value:any):boolean {
    return value && getClass.call(value) === '[object Boolean]';
}

/**
 * 
 */
export function isUUID(value:any):boolean {
    // 4AC18B41-2372-D0FD-9336-E678D0EAE236
    return isString(value) && (value as string).length === 36;
}

/**
 * 
 */
export function isBrowser():boolean {
    return typeof window !== "undefined" && typeof window.document !== "undefined";
}


export function isPromise(value:any): boolean {
    return value && typeof value.then === 'function';
}

export function isEmpty(value:any): boolean {
    if( value == null ){
        return true;
    }
    if( Array.isArray(value) || isString(value) ){
        return value.length === 0;
    }

    return Object.keys(value).length === 0;
}