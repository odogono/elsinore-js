_ = require('underscore');
Backbone = require('backbone');
_.str = require( 'underscore.string' );
_.mixin(_.str.exports());


// taken from underscore-contrib/underscore.function.predicates
// cannot include directly in node
_.mixin({
    // A numeric is a variable that contains a numeric value, regardless its type
    // It can be a String containing a numeric value, exponential notation, or a Number object
    // See here for more discussion: http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric/1830844#1830844
    isNumeric: function(n) {
      return !isNaN(parseFloat(n)) && isFinite(n);
    },

    // An integer contains an optional minus sign to begin and only the digits 0-9
    // Objects that can be parsed that way are also considered ints, e.g. "123"
    // Floats that are mathematically equal to integers are considered integers, e.g. 1.0
    // See here for more discussion: http://stackoverflow.com/questions/1019515/javascript-test-for-an-integer
    isInteger: function(i) {
      return _.isNumeric(i) && i % 1 === 0;
    }
});


module.exports = function(odgn, options){

    odgn = root.odgn = odgn || { entity:{} };
    var entity = odgn.entity;

    entity.Schema = require('./schema');

    // entity.Model = require('./model');
    // entity.ModelRegistry = require('./model_registry')(odgn);

    entity.Registry = require('./registry');

    entity.Entity = require('./entity');
    
    entity.EntitySet = require('./entity_set');

    entity.Component = require('./component');

    entity.EntitySystem = require('./entity_system');

    // entity.EntityRegistry = require('./entity').EntityRegistry;
    // entity.ComponentRegistry = require('./component').ComponentRegistry;

    // entity.useSync = function( sync ){
    //     Backbone.sync = sync.sync;
    // };

    // // import and use the default sync - which does nothing
    // entity.ModelSync = require('./lib/sync/default').EntitySync;
    // entity.useSync( require('./lib/sync/default').create() );

    return odgn;
};