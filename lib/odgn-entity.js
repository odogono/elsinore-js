_ = require('underscore');
Backbone = require('backbone');
_.str = require( 'underscore.string' );
_.mixin(_.str.exports());

module.exports = function(odgn){
    // _ = _ || require('underscore');
    // Backbone = Backbone || require('backbone');

    odgn = odgn || { entity:{} };

    odgn.entity.Model = require('./model');

    odgn.entity.ModelRegistry = require('./model_registry')(odgn);

    // odgn.entity.Component = require('./component').Component;

    odgn.entity.ComponentRegistry = require('./component').ComponentRegistry;

    return odgn;
};

// var odgn = module.exports = { Entity:{} };