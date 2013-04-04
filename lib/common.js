root._ = require('underscore');
root.Backbone = require('backbone');
root._.str = require( 'underscore.string' );
root._.mixin(_.str.exports());

winston = require('winston');
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