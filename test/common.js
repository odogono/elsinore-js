require('../index');

var fs = require('fs'), path = require('path');
var rootDir = path.join( path.dirname(__filename), '../' );

Entity = require('../lib/entity');
assert = require('assert');
path = require('path');
async = require('async');


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


print_var = function(arg, options){
    log.debug( JSON.stringify(arg,null,'\t') );
}