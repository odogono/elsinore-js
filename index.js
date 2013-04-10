require('./lib/common');
var entity = require('./lib/entity');
var collection = require('./lib/entity_collection');
require('./lib/entity.server');
require('./lib/entity_relationship');
entity.Collection = collection;
module.exports = entity;

entity.setSync = function( lib, config ){
    lib.initialise( config );
    Backbone.sync = lib.sync;
};