
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

inherits(ElsinoreError, Error);

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


module.exports = {
    ElsinoreError: ElsinoreError,
    mergeRecursive: mergeRecursive,
    chunk: chunk,
    isNumeric: isNumeric,
    isInteger: isInteger
};
