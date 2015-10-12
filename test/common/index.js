var _ = require('underscore');

var Fs = require('fs');
var Es = require('event-stream');
var Path = require('path');
var Util = require('util');

var Sh = require('shelljs');

var rootDir = Path.join( Path.dirname(__filename), '../../' );
var fixtureDir = Path.join( rootDir, 'test', 'fixtures' );
var varDir = Path.join( rootDir, 'var' );

var ElsinoreDir = Path.join(rootDir, 'src')

export const Elsinore = require(ElsinoreDir);

export function pathVar( path, clear ){
    path = Path.join( varDir, path );
    if( clear ){ Sh.rm('-rf', path ); }
    Sh.mkdir('-p', path );
    return path;
}

export function pathVarFile( path, clear ){
    path = Path.join( varDir, path );
    if( clear ){ 
        // log.debug('clearing ' + path );
        Sh.rm('-rf', path ); 
    }
    Sh.mkdir('-p', Path.dirname(path) );
    return path;
}

// compile a map of schema id(uri) to schema
export function loadComponents(){
    var data = loadFixtureJSON( 'components.json' );
    var componentData = _.reduce( data, 
                        function(memo, entry){
                            memo[ entry.id ] = entry;
                            return memo;
                        }, {});
    return componentData;
}

/**
*   Returns an entityset with the given entities
*/
export function loadEntities( registry, fixtureName, EntitySet, options ){
    var data;
    var lines;
    var result;

    fixtureName = fixtureName || 'entity_set.entities.json';
    registry = registry || initialiseRegistry( options );
    result = registry.createEntitySet( EntitySet, options );

    if( _.isString(fixtureName) ){
        if( fixtureName.indexOf('.json') === -1 ){
            fixtureName = fixtureName + '.json';
        }
        data = loadFixture( fixtureName );
        data = JSON.parse( data );
    }
    else if( _.isObject(fixtureName) ){
        data = fixtureName;
    } else {
        throw new Error('invalid fixture name specified');
    }

    _.each( data, function(line){
        // var comDef = line.id;
        var com = registry.createComponent( line );
        result.addComponent( com );
        return com;
    });

    return result;
}

// function initialiseRegistry(_logEvents){
//     var componentData;
//     var registry = Elsinore.Registry.create();
//     if( _logEvents ){
//         logEvents( registry );
//     }
    
//     componentData = loadComponents();
//     registry.registerComponent( componentData );

//     return registry;
// }


/**
*
*/
export function initialiseRegistry( doLogEvents ){
    var componentData;
    var registry = Elsinore.Registry.create();
    var options, load;

    if( _.isObject(doLogEvents) ){
        options = doLogEvents;
        doLogEvents = options.doLogEvents;
    }
    if( doLogEvents ){
        // log.debug('logging events');
        logEvents( registry );
    }

    options = (options || {});
    load = _.isUndefined(options.loadComponents) ? true : options.loadComponents;

    if( load ){
        componentData = loadComponents();
        // log.debug('loading components ' + JSON.stringify(options) );
        // printIns( componentData );
        return registry.registerComponent( componentData, options )
            .then( () => registry )
    }

    return Promise.resolve(registry);
}


export function createFixtureReadStream( fixturePath ){
    var path = Path.join( fixtureDir, fixturePath );
    return Fs.createReadStream( path, { encoding: 'utf-8' })
        .pipe(Es.split())
        .pipe(Es.parse());
}

export function loadFixture( fixturePath ){
    var path = Path.join( fixtureDir, fixturePath );
    var data = Fs.readFileSync( path, 'utf8');
    return data;
}

export function loadFixtureJSON( fixturePath, data ){
    try {
        var data = loadFixture( fixturePath );
        data = JSON.parse( data );
        return data;
    } catch( e ){
        log.debug('error loading fixture JSON: ' + e );
        return null;
    }
}

function logEvents(obj, prefix){
    prefix = prefix || 'evt';
    obj.on('all', function(evt){
        log.debug(prefix + ' ' + JSON.stringify( _.toArray(arguments) ) );
    });
}

export function printIns(arg,depth,showHidden,colors){
    if( _.isUndefined(depth) ) depth = 2;
    // var stack = __stack[1];
    // var fnName = stack.getFunctionName();
    // var line = stack.getLineNumber();
    // Util.log( fnName + ':' + line + ' ' + Util.inspect(arg,showHidden,depth,colors) );
    Util.log( Util.inspect(arg,showHidden,depth,colors) );
};

export function printVar(){
    var i, len;
    for (i = 0, len = arguments.length; i < len; i++) {
        Util.log( JSON.stringify(arguments[i], null, '\t') );
        // Util.log( Util.inspect(arguments[i], {depth:1}) );
    }
}


import {toString as entityToString} from '../../src/util/to_string';
var toStringPath = Path.join(ElsinoreDir, 'util/to_string');

export function printE(e){
    Util.log( entityToString(e) );
}

export {default as CopyEntity} from '../../src/util/copy';

global.log = {
    debug: console.log,
    error: console.log
};

global.printIns = printIns;

export function requireLib( path ){
    return require( Path.join(ElsinoreDir,path) );
}

// module.exports = {
//     requireLib: function(path){
//         return require( Path.join(ElsinoreDir, path) );
//     },
//     printVar: printVar,
//     printIns: printIns,
//     logEvents: logEvents,
//     createFixtureReadStream: createFixtureReadStream,
//     loadFixture: loadFixture,
//     loadFixtureJSON: loadFixtureJSON,
//     loadComponents: loadComponents,
//     loadEntities: loadEntities,
//     initialiseRegistry: initialiseRegistry,
//     pathVar: pathVar,
//     pathVarFile: pathVarFile,
//     Elsinore: Elsinore
// }