require('./lib/common');
var entity = module.exports = require('./lib/entity');
entity.entityCollection = require('./lib/entity_collection');
entity.EntityCollection = entity.entityCollection.EntityCollection;
require('./lib/entity.server');
require('./lib/entity_relationship');

Backbone.sync = require('./lib/sync/default').sync;

entity.initialise = function( options ){
    options = options || {};
    
    if( options.schema ){
        entity.schema = require('./lib/schema');
        entity.schema.initialise();
        // import entity schema functions
        require('./lib/entity.schema');
    }
}

entity.setSync = function( lib, config ){
    lib.initialise( config );
    Backbone.sync = lib.sync;
};