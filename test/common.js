/**
 * Test Common Functions
 */

Elsinore = require('../index');
ComponentDef = Elsinore.ComponentDef;


assert = require('assert');
Fs = require('fs');
Path = require('path');
Util = require('util');
Sinon = require('sinon');
_ = require('underscore');
Backbone = require('backbone');
Promise = require('bluebird');

require("mocha-as-promised")();

Chai = require("chai");
ChaiAsPromised = require("chai-as-promised");
Chai.use(ChaiAsPromised);
expect = Chai.expect;
Chai.should();

var registeredComponentDefs = {};
var registeredComponentDefIds = {};

var rootDir = Path.join( Path.dirname(__filename), '../' );

Common = {
    paths:{ 
        root: rootDir,
        fixtures: Path.join( rootDir, 'test', 'fixtures' )
    }
};

Common.path = function( dir, subPath ){
    return Path.join( Common.paths[dir], subPath );
};

Common.pathFixture = function( subPath ){
    return Path.join( Common.paths.fixtures, subPath );
};

Common.readFixture = function( subPath, parseJson ){
    var fixturePath = Common.pathFixture( subPath );
    var data = Fs.readFileSync( fixturePath, 'utf8' );
    return parseJson ? JSON.parse(data) : data;
}

root.print_ins = function(arg,depth,showHidden,colors){
    if( _.isUndefined(depth) ) depth = 1;
    var stack = __stack[1];
    var fnName = stack.getFunctionName();
    var line = stack.getLineNumber();
    // Util.log( fnName + ':' + line + ' ' + Util.inspect(arg,showHidden,depth,colors) );
    Util.log( Util.inspect(arg,showHidden,depth,colors) );
};

root.print_var = function(arg, options){
    var stack = __stack[1];
    var fnName = stack.getFunctionName();
    var line = stack.getLineNumber();
    // Util.log( fnName + ':' + line + ' ' + JSON.stringify(arg,null,'\t') );
    Util.log( JSON.stringify(arg,null,"\t") );
}

root.log = {
    warn:Util.log,
    error: Util.log,
    debug: Util.log,
    info: Util.log
}

root.print_stack = function(){
    var rootPath = Path.join(Path.dirname(__filename),'../');
    var stack = _.map(__stack, function(entry,i){
        var filename = entry.getFileName();
        if( filename.indexOf(rootPath) === 0  ){
            filename = filename.substring(rootPath.length);
        }
        return _.repeat("  ", i) + filename + ' ' + entry.getFunctionName() + ':' + entry.getLineNumber()
    });
    stack.shift();
    Util.log( "\n" + stack.join("\n") );
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

function createAndInitialize(options){
    var registry = Elsinore.Registry.create();
    return registry.initialize()
        .then( function(registry){
            return registry.storage;
        });
}

function createEntity(id){
    return Elsinore.Entity.create(id);
}

function createEntities( count ){
    return _.times( count, function(i){ return createEntity() });
}

function createComponentDef( schemaId, schemaAttrs ){
    var schema = {id:schemaId};
    if( schemaAttrs )
        schema = _.extend(schema,schemaAttrs);
    var result = Elsinore.ComponentDef.create( schema, schemaAttrs );
    // var result = new Backbone.Model( {schema:schema} );
    // result.getSchemaId = function(){
    //     return schemaId;
    // }
    return result;
}

function createComponent(componentDefId, attrs){
    if( !componentDefId ){
        return Elsinore.Component.create();
    }
    var def = createComponentDef( componentDefId );
    return def.create( attrs );
}


function registerComponentDef( storage, schema ){
    if( _.isArray(schema) ){
        var current = Promise.fulfilled();
        return Promise.all( schema.map( function(sch){
            return current = current.then(function(){
                return registerComponentDef( storage, sch );
            });
        }));
    }
    var def = ComponentDef.create( schema );
    return storage.registerComponentDef( def ).then( function(def){
        registeredComponentDefs[ def.getSchemaId() ] = def;
        registeredComponentDefIds[ def.id ] = def;
        return def;
    });
}

function createComponents( storage, components, options ){
    if( _.isArray(storage) ){
        components = storage;
        storage = null;
    }

    // var save = options ? options.save || false;
    // we store each array of components seperatley
    var comTypes = {};
    // convert components data into instances
    components = components.map(function(com){
        var schemaId = com['schema'];
        var def = registeredComponentDefs[schemaId];
        delete com['schema'];
        var result = def.create( com );
        var typeArray = comTypes[ def.id ] || (comTypes[ def.id ] = []);
        typeArray.push( result );
        // log.debug('creating component ' + def.getSchemaId() + ' ' + JSON.stringify(com) );
        return result;
    });

    if( storage ){
        return storage.saveComponents( components );
    }

    return components;
}

function getComponentDef( schemaId ){
    return registeredComponentDefs[ schemaId ];
}

module.exports = {
    Entity: Elsinore.Entity,
    createAndInitialize: createAndInitialize,
    createEntity: createEntity,
    createEntities: createEntities,
    createComponentDef: createComponentDef,
    createComponent: createComponent,
    createComponents: createComponents,
    registerComponentDef: registerComponentDef,
    ComponentDef: registeredComponentDefs,
    getComponentDef: getComponentDef,
    fixtures:{
        components: require('./fixtures/components.json')
    }
};