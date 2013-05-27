
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

}, {
    STATUS_ACTIVE: 0
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


var middleware = {};


_.extend(EntityRegistry.prototype, Backbone.Events, {

    /**
     * [ description]
     * @return {[type]} [description]
     */
    _reset: function(){
        this._entityId = 1;
        this._entities = []; // an array of all created component instances
    },

    /**
     * Initialises the entity store
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    initialise: function(options,callback){
        var self = this;
        if( arguments.length == 1 ){
            callback = options;
            options = {};
        }

        if( middleware.initialise ){
            return middleware.initialise( self, options, callback );
        }

        return async.nextTick(function(){
        });
    },

    /**
     * [ description]
     * @param  {[type]} attrs [description]
     * @return {[type]}       [description]
     */
    _create: function( attrs ){
        var result = new Entity(attrs);
        return result;
    },

    /**
     * [ description]
     * @param  {[type]} resp [description]
     * @return {[type]}      [description]
     */
    _parse: function( resp ){
        var result = this._create();
        result.set( result.parse(resp) );
        return result;
    },

    /**
     * Creates a new entity
     * 
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    create: function(options, callback){
        var self = this;
        if( arguments.length == 1 ){
            callback = options;
            options = {};
        }

        if( middleware.create ){
            return middleware.create( self, options, callback );
        }

        return async.nextTick(function(){
            var result = new Entity();
            result.id = self._entityId++;
            // add the new entity to the entity registry
            self._entities[ result.id ] = result;
            return callback(null, result);
        });
    },

    /**
     * Deletes an entity
     * 
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    delete: function( entityId, callback ){
        var self = this;
        
        return async.nextTick(function(){
            return callback();
        });
    },

    /**
     * 
     * @param  {[type]}   entityId [description]
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    read: function( entityId, options, callback ){
        var self = this;
        if( arguments.length == 2 ){
            callback = options;
            options = {};
        }

        if( middleware.read ){
            return middleware.read( entityId, self, options, callback );
        }

        return async.nextTick(function(){
            var result = self._create();
            result.id = entityId;
            return callback(null,result);
        });
    }

});



exports.EntityRegistry = {
    create: function(options, callback){
        options = options || {};
        var cr = new EntityRegistry();
        // return cr.initialise(options,callbac);
        return cr;
    },

    use: function( mw ){
        if( mw && mw.EntityRegistry ){
            middleware = new mw.EntityRegistry();
        }
        // if( mw && mw.EntityRegistry ){
            // _.extend( middleware, mw.EntityRegistry );
        // }
    }
};