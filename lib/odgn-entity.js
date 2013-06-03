_ = require('underscore');
Backbone = require('backbone');
_.str = require( 'underscore.string' );
_.mixin(_.str.exports());

module.exports = function(odgn, options){

    odgn = odgn || { entity:{} };
    var entity = odgn.entity;

    entity.Schema = require('./schema');

    entity.Model = require('./model');
    entity.ModelRegistry = require('./model_registry')(odgn);

    // odgn.entity.Component = require('./component').Component;

    entity.EntityRegistry = require('./entity').EntityRegistry;
    entity.ComponentRegistry = require('./component').ComponentRegistry;

    // entity.useSync = function( sync ){
    //     Backbone.sync = sync.sync;
    // };

    // // import and use the default sync - which does nothing
    // entity.ModelSync = require('./lib/sync/default').EntitySync;
    // entity.useSync( require('./lib/sync/default').create() );

    return odgn;
};