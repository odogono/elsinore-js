
/**
 * An entity is a container for components
 */
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


/**
 * [ description]
 * @return {[type]} [description]
 */
var EntityRegistry = function(){
    this._reset();
};



_.extend(EntityRegistry.prototype, Backbone.Events, {

    _reset: function(){
        this._entityId = 1;
        this._entities = []; // an array of all created component instances
    },


    create: function(callback){
        var self = this;
        return async.nextTick(function(){
            var result = new Entity();
            result.id = self._entityId++;
            // add the new entity to the entity registry
            self._entities[ result.id ] = result;
            return callback(null, result);
        });
    }

});



exports.EntityRegistry = {
    create: function(options){
        var cr = new EntityRegistry();
        return cr;
    }
};