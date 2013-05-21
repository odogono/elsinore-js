require('./common');


var Entity = exports.Entity = Backbone.Model.extend({

    /**
     * Adds the component to this entity.
     * A convenience function which delegates to EntityManager
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    addComponent: function( component ){
        return this;
    },

    /**
     * Returns true if this entity has the specified component type
     * 
     * @param  {[type]} type [description]
     * @return {[type]}      [description]
     */
    hasComponent: function( type ){
        return false;
    },

    /**
     * Removes a component from this entity
     * A convenience function which delegates to EntityManager
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    removeComponent: function( component ){
        return this;
    },

    /**
     * Returns all components on this entity
     * 
     * @return {[type]} [description]
     */
    getComponents: function(){
        return [];
    }

});

exports.create = function(options){
    var result = new Entity();
    return result;
}