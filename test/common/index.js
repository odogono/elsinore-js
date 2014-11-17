var _ = require('underscore');

var Path = require('path');
var Util = require('util');


function logEvents(obj){
    obj.on('all', function(evt){
        log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
    });
}

function printIns(arg,depth,showHidden,colors){
    if( _.isUndefined(depth) ) depth = 2;
    var stack = __stack[1];
    var fnName = stack.getFunctionName();
    var line = stack.getLineNumber();
    // Util.log( fnName + ':' + line + ' ' + Util.inspect(arg,showHidden,depth,colors) );
    Util.log( Util.inspect(arg,showHidden,depth,colors) );
};

function printVar(){
    var i, len;
    for (i = 0, len = arguments.length; i < len; i++) {
        Util.log( JSON.stringify(arguments[i], null, '\t') );
    }
}

Object.defineProperty(global, '__stack', {
    get: function() {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(_, stack) {
            return stack;
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__line', {
    get: function() {
        return __stack[1].getLineNumber();
    }
});

Object.defineProperty(global, '__function', {
    get: function() {
        return __stack[1].getFunctionName();
    }
});

global.printIns = printIns;
global.printVar = printVar;

global.log = {
    debug: console.log
};

module.exports = {
    printVar: printVar,
    printIns: printIns,
    logEvents: logEvents
}