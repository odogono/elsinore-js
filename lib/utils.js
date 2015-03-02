'use strict';

var _ = require('underscore');
var Inherits = require('util').inherits;
var Promise = require('bluebird');
// var Url = require('url');
var Url = require("fast-url-parser");


function ElsinoreError(msg){
    this.name = 'ElsinoreError';
    this.message = msg;
    this.cause = msg;

    if (message instanceof Error) {
        this.message = message.message;
        this.stack = message.stack;
    }
    else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

    return error;
}

Inherits(ElsinoreError, Error);

function mergeRecursive(obj1, obj2) {
    for (var p in obj2) {
        if( obj2.hasOwnProperty(p) ){
            if( obj1 === undefined )
                obj1 = {};
            obj1[p] = (typeof obj2[p] === 'object') ? mergeRecursive(obj1[p], obj2[p]) : obj2[p];
        }
    }
    return obj1;
}


// 
// Returns an array broken into set lengths
// 
function chunk( array, chunkLength ){
    var i,j,temparray;
    var result = [];
    for (i=0,j=array.length; i<j; i+=chunkLength) {
        result.push( array.slice(i,i+chunkLength) );
    }

    return result;
};

// taken from underscore-contrib/underscore.function.predicates
// cannot include directly in node

// A numeric is a variable that contains a numeric value, regardless its type
// It can be a String containing a numeric value, exponential notation, or a Number object
// See here for more discussion: http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric/1830844#1830844
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
};

// An integer contains an optional minus sign to begin and only the digits 0-9
// Objects that can be parsed that way are also considered ints, e.g. "123"
// Floats that are mathematically equal to integers are considered integers, e.g. 1.0
// See here for more discussion: http://stackoverflow.com/questions/1019515/javascript-test-for-an-integer
function isInteger(i) {
    return !isNaN(parseFloat(i)) && isFinite(i) && i % 1 === 0;
};


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
function hashFnv32a(str, asString, seed) {
    /*jshint bitwise:false */
    var i, l,
        hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if( asString ){
        // Convert to 8 digit hex string
        return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
}


function normalizeUri(uri){
    var result;
    if( !uri )
        return null;
    result = Url.parse( uri );
    return result.href;
}

function parseUri( uri ){
    var result;
    // result = require('uri-js').parse( uri );
    result = Url.parse( uri );
    if( result.hash ){
        result.fragment = result.hash.substring(1);
        result.baseUri = result.href.slice(0, result.href.length - result.hash.length);
    }

    return result;
}

function resolveUri( from, to ){
    // log.debug( JSON.stringify( from ) + ', ' + JSON.stringify( to ) );
    return Url.resolve( from, to );
}


function deepClone( obj ){
    return JSON.parse(JSON.stringify(obj));
}

// from: http://www.tuanhuynh.com/blog/2014/unpacking-underscore-clone-and-extend/
function deepExtend( out ){
    var i, len;
    var obj;
    var key;

    out || (out={});

    for (i = 1, len = arguments.length; i < len; i++) {
        obj = arguments[i];

        if (!obj){
            continue;
        }

        for (key in obj) {
            if( !obj.hasOwnProperty(key) ){
                continue;
            }

            if( _.isArray(obj[key] ) ){
                out[key] = deepExtend( out[key] || [], obj[key] );
            }
            else if (typeof obj[key] === 'object'){
                out[key] = deepExtend(out[key], obj[key]);
            }
            else {
                out[key] = obj[key];
            }
        }
    }
    return out;
}


function clearArray( arr ){
    while (arr.length > 0) {
        arr.pop();
    }
    return arr;
}

function clearMap( map ){
    return {};
}

/**
*   If the passed array has only a single value, return
*   that value, otherwise return the array
*/
function valueArray( array ){
    if (array == null) { return void 0; }
    if( array.length === 1 ){
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
function reduceIterator( iterator, eachFn, memo ){
    return new Promise( function( resolve, reject){
        function iterateOk(item){
            return Promise.resolve()
                .then( function(){
                    return eachFn(memo,item);
                })
                .then( iterate );
        };

        function iterateFail(){
            return resolve( memo );
        }

        function iterate(){
            return iterator.next().then( iterateOk, iterateFail );
        };

        iterate();
    });
}


module.exports = {
    ElsinoreError: ElsinoreError,
    mergeRecursive: mergeRecursive,
    chunk: chunk,
    isNumeric: isNumeric,
    isInteger: isInteger,
    hash: hashFnv32a,
    normalizeUri: normalizeUri,
    parseUri: parseUri,
    resolveUri: resolveUri,
    deepClone: deepClone,
    deepExtend: deepExtend,
    reduceIterator: reduceIterator,
    clearArray: clearArray,
    clearMap: clearMap,
    valueArray: valueArray
};
