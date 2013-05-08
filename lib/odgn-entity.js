_ = require('underscore');
Backbone = require('backbone');
_.str = require( 'underscore.string' );
_.mixin(_.str.exports());

module.exports = function(odgn){
    // _ = _ || require('underscore');
    // Backbone = Backbone || require('backbone');

    odgn = odgn || { Entity:{} };

    odgn.Entity.Model = require('./model');

    odgn.Entity.Registry = require('./registry')(odgn);

    return odgn;
};

// var odgn = module.exports = { Entity:{} };