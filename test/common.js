require('../index');


async = require('async');
assert = require('assert');
fs = require('fs');
path = require('path');
util = require('util');

require('underscore');
Backbone = require('backbone');
// _.str = require( 'underscore.string' );
// _.mixin(_.str.exports());
// 
// winston = require('winston');
// log = new (winston.Logger)({
//     transports:[
//         new (winston.transports.Console)( {colorize:true,prettyPrint:false,timestamp:true, silent:false} )
//     ]
// });

var rootDir = path.join( path.dirname(__filename), '../' );


Common = {
    paths:{ 
        root: rootDir,
        fixtures: path.join( rootDir, 'test', 'fixtures' )
    }
};

Common.path = function( dir, subPath ){
    return path.join( Common.paths[dir], subPath );
};

Common.pathFixture = function( subPath ){
    return path.join( Common.paths.fixtures, subPath );
};

Common.readFixture = function( subPath, parseJson ){
    var fixturePath = Common.pathFixture( subPath );
    var data = fs.readFileSync( fixturePath, 'utf8' );
    return parseJson ? JSON.parse(data) : data;
}

root.print_ins = function(arg,depth,showHidden,colors){
    if( _.isUndefined(depth) ) depth = 5;
    util.log( util.inspect(arg,showHidden,depth,colors) );
};

root.print_var = function(arg, options){
    if( arg === undefined )
        return util.log('undefined');
    util.log( JSON.stringify(arg,null,'\t') );
}

root.log = {
    debug: util.log,
    info: util.log
}