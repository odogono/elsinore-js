var _ = require('underscore');
var Backbone = require('backbone');

/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */
var EntityProcessor = Backbone.Model.extend({
    createEntitySet: function(registry){
        return registry.createEntitySet();
    },

    initialize: function( attrs, options ){    
    },

    start: function(){
    },

    stop: function(){
    },

    onUpdate: function( deltaTime, startTime, currentTime, options ){
    },

    // updateEntity: function( entity, deltaTime, startTime, currentTime, options ){
    // },

});

EntityProcessor.isEntityProcessor = function(ep){
    return ( ep && _.isObject(ep) && ep instanceof EntityProcessor );
}

EntityProcessor.prototype.__defineGetter__('length', function(){
    return this.entitySet.length;
});

EntityProcessor.create = function create( attrs, options ){
    var Model = options.Model || EntityProcessor;
    var result = new Model(attrs);
    return result;
}

module.exports = EntityProcessor;