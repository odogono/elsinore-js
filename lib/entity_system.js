
/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */
var EntitySystem = exports.Model = Backbone.Model.extend({

    initialize: function( attrs, options ){
        
    },

    start: function(){

    },

    stop: function(){

    },

    update: function( deltaTime, startTime, currentTime, options, callback ){
        return callback();
    },

    // updateEntity: function( entity, deltaTime, currentTime, options, callback ){
    // }

});

exports.create = function(attrs,options){

    var Model = options.Model || exports.Model;
    var result = new Model(attrs);
    // log.debug('system.create ' + JSON.stringify(result.attributes) );
    result.registry = options.registry;
    return result;
}