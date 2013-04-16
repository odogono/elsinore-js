require('./lib/common');
var entity = require('./lib/entity');
var collection = require('./lib/entity_collection');
require('./lib/entity.server');
require('./lib/entity_relationship');
entity.Collection = collection;
module.exports = entity;

entity.initialise = function( options ){
    options = options || {};

    if( options.schema ){
        log.debug('initialising json schema');
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