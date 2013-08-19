
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
    addComponent: function( component, callback ){
        return this.registry.addComponent( component, this, callback );
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

}, {
    STATUS_ACTIVE: 0
});

exports.create = function(id, options){
    var result = new Entity();
    result._debug_is_entity = true;
    result.id = id;
    return result;
};

exports.parse = function( resp ){
    var result = exports.create();
    result.set( result.parse(resp) );
    return result;
};

exports.isEntity = function( entity ){
    if( entity != null && typeof entity === 'object' && entity instanceof Entity ){
        return true;
    }
    return false;
};

exports.toEntity = function( entity ){
    if( exports.isEntity(entity) ){
        return entity;
    }
    if( _.isInteger(entity) ){
        return exports.create( entity, null );
    }
    return null;
};