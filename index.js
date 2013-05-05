require('./lib/common');
var entity = module.exports = require('./lib/entity');

entity.entityCollection = require('./lib/entity_collection');
entity.EntityCollection = entity.entityCollection.EntityCollection;

require('./lib/entity.server');
require('./lib/entity_relationship');



entity.initialise = function( options ){
    options = options || {};
    
    if( options.schema ){
        entity.schema = require('./lib/schema');
        entity.schema.initialise();
        // import entity schema functions
        require('./lib/entity.schema');
    }
}


entity.useSync = function( sync ){
    Backbone.sync = sync.sync;
};


entity.EntitySync = require('./lib/sync/default').EntitySync;

entity.useSync( require('./lib/sync/default').create() );
