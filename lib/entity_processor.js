var _ = require('underscore');
var Backbone = require('backbone');

/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */
var EntitySystem = Backbone.Model.extend({

    initialize: function( attrs, options ){
        
    },

    start: function(){

    },

    stop: function(){

    },

    update: function( deltaTime, startTime, currentTime, options, callback ){
        return callback();
    },

    updateEntity: function( entity, deltaTime, startTime, currentTime, options, callback ){
    },

});

EntitySystem.create = function create(attrs,options){
    var Model = options.Model || exports.Model;
    var result = new Model(attrs);
    return result;
}

// module.exports = {
//     Model: EntitySystem,
//     EntitySystem: EntitySystem,
//     create: create
// }
module.exports = EntitySystem;