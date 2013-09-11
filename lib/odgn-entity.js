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

if (typeof module !== 'undefined' && module.exports) {
    var odgnEntity = module.exports = global.odgnEntity = {};
    odgnEntity.storage = { MemoryStorage:require('./memory_storage') };
    odgnEntity.Schema = require('./schema');
    odgnEntity.Registry = require('./registry');
    odgnEntity.Entity = require('./entity');
    odgnEntity.EntitySet = require('./entity_set');
    odgnEntity.Component = require('./component');
    odgnEntity.EntitySystem = require('./entity_system');
} else {
    window.odgnEntity = {};
}