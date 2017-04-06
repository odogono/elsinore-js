import { Collection } from 'odgn-backbone-model';
import DeepEqual from 'deep-equal';

const getClass = {}.toString;

// export {createLog,setActive as setLogActive} from './log';
export const deepEqual = DeepEqual;

// export {entityToString} from './to_string';
// export {toString,entitySetToString,entityToString,componentToString} from './to_string';
// export {uuid as createUUID} from './uuid';
export function mergeRecursive(obj1, obj2) {
    for (let p in obj2) {
        if (obj2.hasOwnProperty(p)) {
            if (obj1 === undefined) {
                obj1 = {};
            }
            obj1[p] = typeof obj2[p] === 'object' ? mergeRecursive(obj1[p], obj2[p]) : obj2[p];
        }
    }
    return obj1;
}

/**
 * Pushes item onto the end of the array and returns the array
 */
export function arrayPush(array = [], item) {
    if (Array.isArray(item)) {
        return array.concat(item);
    }
    array.push(item);
    return array;
}

// 
// Returns an array broken into set lengths
// 
export function chunk(array, chunkLength) {
    let i, j;
    let result = [];
    for (i = 0, j = array.length; i < j; i += chunkLength) {
        result.push(array.slice(i, i + chunkLength));
    }

    return result;
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
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as 
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
export function hash /*Fnv32a*/(str, asString = false, seed = 2166136261) {
    /*jshint bitwise:false */
    let ii, len, hval = seed;
    // hval = (seed === undefined) ? 0x811c9dc5 : seed;
    for (ii = 0, len = str.length; ii < len; ii++) {
        hval ^= str.charCodeAt(ii);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    hval = hval >>> 0;

    if (asString) {
        // Convert to 8 digit hex string
        return ('0000000' + hval.toString(16)).substr(-8);
    }
    return hval;
}

// /**
//  * 
//  */
// export function normalizeUri(uri){
//     let result;
//     if( !uri )
//         return null;
//     result = Url.parse( uri );
//     return result.href;
// }
// /**
//  * 
//  */
// export function parseUri( uri, parseQueryString ){
//     let result = Url.parse( uri, true );
//     if( result.hash ){
//         result.fragment = result.hash.substring(1);
//         result.baseUri = result.path; //result.href.slice(0, result.href.length - result.hash.length);
//     } else {
//         result.baseUri = result.path;// result.href;
//     }
//     return result;
// }
/**
 * 
 */
// export function resolveUri( from, to ){
//     return Url.resolve( from, to );
// }
// /**
//  * parseUri 1.2.2
//  * (c) Steven Levithan <stevenlevithan.com>
//  * MIT License
//  * http://blog.stevenlevithan.com/archives/parseuri
//  */
// export function parseUri( str ) {
//     let o   = parseUri.options,
//         m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
//         uri = {},
//         i   = 14;
//     while (i--) uri[o.key[i]] = m[i] || "";
//     uri[o.q.name] = {};
//     uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
//         if ($1) uri[o.q.name][$1] = $2;
//     });
//     return uri;
// };
// parseUri.options = {
//     strictMode: false,
//     key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
//     q:   {
//         name:   "queryKey",
//         parser: /(?:^|&)([^&=]*)=?([^&]*)/g
//     },
//     parser: {
//         strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
//         loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
//     }
// };
export function toBoolean(value, defaultValue = false) {
    switch (value) {
        case true:
        case 'true':
        case 1:
        case '1':
        case 'yes':
            return true;
        case false:
        case 'false':
        case 0:
        case '0':
        case 'no':
            return false;
        default:
            return defaultValue;
    }
}

/**
 * Converts a value to an integer - well as much as that
 * means in JS.
 * If the value is not convertible, the supplied defaultValue
 * will be returned
 */
export function toInteger(value, defaultValue = 0) {
    if (isNaN(value)) {
        value = defaultValue;
    }
    return value < 0 ? Math.ceil(value) : Math.floor(value);
}

/**
 * 
 * @param {*} obj 
 */
export function clone(obj) {
    return Object.assign({}, obj);
}

/**
 * Returns a clone of the object without the blacklisted keys
 * 
 * @param {*} obj 
 * @param {*} blacklist 
 */
export function omit(obj, ...blacklist) {
    if (!isObject(obj)) {
        return;
    }
    if (blacklist.length === 0) {
        return clone(obj);
    }
    let result = {};
    for (let key in obj) {
        if (blacklist.includes(key)) {
            continue;
        }
        result[key] = obj[key];
    }
    return result;
}

/**
 * 
 */
export function deepClone(obj) {
    const str = stringify(obj);
    return parseJSON(str);
}

// from: http://www.tuanhuynh.com/blog/2014/unpacking-underscore-clone-and-extend/
export function deepExtend(out = {}, ...others) {
    let ii, len;
    let obj;
    let key, val;

    for (ii = 0, len = others.length; ii < len; ii++) {
        obj = others[ii];

        if (!obj) {
            continue;
        }

        for (key in obj) {
            if (!obj.hasOwnProperty(key)) {
                continue;
            }

            val = obj[key];

            if (Array.isArray(val)) {
                out[key] = deepExtend(out[key] || [], val);
            } else if (isString(val)) {
                out[key] = String.prototype.slice.call(val);
            } else if (isDate(val)) {
                out[key] = new Date(val.valueOf());
            } else if (typeof val === 'object') {
                out[key] = deepExtend(out[key], val);
            } else {
                out[key] = val;
            }
        }
    }
    return out;
}

/**
 * 
 */
export function clearCollection(col) {
    if (!col) {
        return new Collection();
    }
    col.reset();
    return col;
}

/**
 * 
 */
export function clearArray(arr) {
    if (!arr) {
        return [];
    }
    while (arr.length > 0) {
        arr.pop();
    }
    return arr;
}

/**
 * 
 */
export function clearMap(map) {
    return {};
}

/**
*   If the passed array has only a single value, return
*   that value, otherwise return the array
*/
export function valueArray(array) {
    if (array == null) {
        return void 0;
    }
    if (array.length === 1) {
        return array[0];
    }
    return array;
}

/**
*   calls a passed iterator until it is exhausted.
*   The iterator function should implement a function next()
*   which returns an object containing the value, or if
*   no more values are available, it should return a Promise.reject
*/
export function reduceIterator(iterator, eachFn, memo) {
    return new Promise(function(resolve, reject) {
        function iterateOk(item) {
            return Promise.resolve().then(function() {
                if (item.value) {
                    item = item.value;
                }
                return eachFn(memo, item);
            }).then(iterate);
        }

        function iterateFail() {
            return resolve(memo);
        }

        function iterate() {
            return iterator.next().then(iterateOk, iterateFail);
        }

        iterate();
    });
}

/**
 * @param {object} obj
 * @param space
 */
export function stringify(obj, space) {
    let cache = [];
    return JSON.stringify(
        obj,
        function(key, value) {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Circular reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        },
        space,
    );
}

/**
 * Safe parsing of json data
 */
export function parseJSON(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (err) {
        return defaultValue;
    }
}

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

/**
 * 
 * @param {*} object 
 */
export function isFunction(object) {
    return object && getClass.call(object) == '[object Function]';
}

export function isBoolean(object) {
    return object && getClass.call(object) == '[object Boolean]';
}

export function isString(object){
    return object && getClass.call(object) == '[object String]';
}

export function isDate(object){
    return object && getClass.call(object) == '[object Date]';
}

/**
*   Converts a string so that the words are capitalised and concatenated
*/
export function toPascalCase(str) {
    return str.match(/[A-Z]?[a-z]+/g).map(function(word) {
        return word.charAt(0).toUpperCase() + word.substring(1);
    }).join('');
    // return str.replace(/([A-Z]?[a-z]+)/gi, function(m,word){
    // doesn't deal with the delimiters...
    // return word.charAt(0).toUpperCase() + word.substring(1);
    // });
    // return Classify( str );
}

export function getEntityIdFromId(id) {
    return id & 4294967295;
}

export function getEntitySetIdFromId(id) {
    return (id - (id & 4294967295)) / 4294967296;
}

export function setEntityIdFromId(eid, esid) {
    return (esid & 2097151) * 4294967296 + (eid & 4294967295);
}

/**
 * Returns the given property from the object, or returns a
 * default if the property does not exist
 * 
 * @param {object} obj
 * @param {string} name
 * @param defaultTo
 * @return {object}
 */
export function readProperty(obj, name, defaultTo = null) {
    let result;

    if (Array.isArray(name)) {
        let pathResults = name.map(p => obj[p]);

        // pick the first non-undefined value
        result = pathResults.find(r => !isUndefined(r));
    } else {
        result = obj[name];
    }

    if (isUndefined(result)) {
        result = defaultTo;
    }

    return result;
}

// Traverses the children of `obj` along `path`. If a child is a function, it
// is invoked with its parent as context. Returns the value of the final
// child, or `fallback` if any child is undefined.
export function result(obj, path, fallback) {
    if (!Array.isArray(path)) {
        path = [ path ];
    }
    const length = path.length;
    if (!length) {
        return isFunction(fallback) ? fallback.call(obj) : fallback;
    }
    for (let ii = 0; ii < length; ii++) {
        let prop = obj == null ? void 0 : obj[path[ii]];
        if (prop === void 0) {
            prop = fallback;
            ii = length; // Ensure we don't continue iterating.
        }
        obj = isFunction(prop) ? prop.call(obj) : prop;
    }
    return obj;
}

/**
 * Similar to without, but returns the values from array that are not present in the other arrays. 
 * @param {*} array 
 * @param {*} others 
 */
export function arrayDifference(array, other) {
    return array && array.filter(x => other.indexOf(x) < 0);
}

/**
 * 
 * @param {*} array 
 * @param {*} other 
 */
export function arrayWithout(array, other) {
    if( !Array.isArray(other) ){
        return array.filter(x => x !== other );
    }
    return arrayDifference(array, other);
}

/**
 * Returns an array containing the unique members of the passed array
 * @param {*} array 
 */
export function arrayUnique(array) {
    // http://stackoverflow.com/a/17903018/2377677
    return array.reduce(
        (p, c) => {
            if (p.indexOf(c) < 0) {
                p.push(c);
            }
            return p;
        },
        [],
    );
}

/**
 * 
 * @param {*} ary 
 * @param {*} ret 
 */
export function arrayFlatten(ary, shallow = false) {
    if (shallow) {
        return [].concat.apply([], ary);
    }
    let ret = [];
    //ret = ret === undefined ? [] : ret;
    for (let ii = 0; ii < ary.length; ii++) {
        if (Array.isArray(ary[ii])) {
            arrayFlatten(ary[ii], ret);
        } else {
            ret.push(ary[ii]);
        }
    }
    return ret;
}

let idCounter = 0;

/**
 * Generate a unique integer id (unique within the entire client session).
 * from underscorejs
 * 
 * @param {*} prefix 
 */
export function uniqueId(prefix) {
    let id = ++idCounter + '';
    return prefix ? prefix + id : id;
}


// export function size(object){
//     if( isObject(object) ){
//         return Object.keys(object).length;
//     }
// }