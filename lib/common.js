var _ = require('underscore');
var Backbone = require('backbone');
_.str = require( 'underscore.string' );
_.mixin(_.str.exports());

var winston = require('winston');

global.log = new (winston.Logger)({
    transports:[
        new (winston.transports.Console)( {colorize:true,prettyPrint:false,timestamp:true, silent:false} )
    ]
});

root.dlog = function(msg){
    console.log(msg);
}

var inspect = require('util').inspect;
root.print_ins = function(arg,showHidden,depth,colors){
    if( _.isUndefined(depth) ) depth = 5;
    log.debug( inspect(arg,showHidden,depth,colors) );
}

root.print_stack = function(){
    var rootPath = path.join(path.dirname(__filename),'../');
    var stack = _.map(__stack, function(entry,i){
        var filename = entry.getFileName();
        if( filename.indexOf(rootPath) === 0  ){
            filename = filename.substring(rootPath.length);
        }
        return _.repeat("  ", i) + filename + ' ' + entry.getFunctionName() + ':' + entry.getLineNumber()
    });
    stack.shift();
    util.log( "\n" + stack.join("\n") );
}
