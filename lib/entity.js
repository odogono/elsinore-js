var BitArray = require('bit-array');
var _ = require('underscore');
var Backbone = require('backbone');
var utils = require('./utils');

/**
 * An entity is a container for components
 */
var Entity = Backbone.Model.extend({

    /**
     * Adds the component to this entity.
     * A convenience function which delegates to EntityManager
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    addComponent: function( componentDef, callback ){
        return this.registry.addComponent( componentDef, this, callback );
    },

    /**
     * Returns true if this entity has the specified component type
     * 
     * @param  {[type]} type [description]
     * @return {[type]}      [description]
     */
    hasComponent: function( component ){
        return this.registry.doesEntityHaveComponent( this, component );
    },

    /**
     * Removes a component from this entity
     * A convenience function which delegates to EntityManager
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    removeComponent: function( component, callback ){
        return this.registry.removeComponent( component, this, callback );
    },

    /**
     * Returns a component from this entity.
     * Better to use an EntitySet for this type of query.
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    getComponent: function( component, options, callback ){
        if( _.isFunction(options) ){
            callback = options; options = {};
        }
        return this.registry.getEntityComponent( this, component, options, callback );
    },

    /**
     * Returns all components on this entity
     * 
     * @return {[type]} [description]
     */
    getComponents: function(){
        return [];
    },


    /**
     * Proxies event triggering to the registry
     * @param  {[type]} name [description]
     * @return {[type]}      [description]
     */
    trigger: function(name){
        if( !this.registry )
            return;
        var args = Array.prototype.slice.call(arguments);
        args.splice( 1,0, this );
        this.registry.trigger.apply( this.registry, args );
    },

    parse: function(resp, options){
        if( resp.component_bf ){
            if( _.isString(resp.component_bf) && resp.component_bf.indexOf('0x') == 0 )
                resp.component_bf = resp.component_bf.substring(2);
            resp.component_bf = new BitArray(64, resp.component_bf);
        }
        return resp;
    },

    toJSON: function(){
        var result = _.clone(this.attributes);
        if( this.id )
            result.id = this.id;
        result.component_bf = result.component_bf.toHexString();
        return result;
    }

}, {
    STATUS_ACTIVE: 0
});

Entity.create = function(id, options){
    var result = new Entity();
    result._debug_is_entity = true;
    result.set({id:id, 'component_bf': new BitArray(64)});
    return result;
};

Entity.parse = function( resp ){
    var result = exports.create();
    result.set( result.parse(resp) );
    return result;
};

Entity.isEntity = function( entity ){
    if( entity != null && typeof entity === 'object' && entity instanceof Entity ){
        return true;
    }
    return false;
};

Entity.toEntity = function( entity ){
    if( Entity.isEntity(entity) ){
        return entity;
    }
    if( utils.isInteger(entity) ){
        return Entity.create( entity, null );
    }
    return null;
};

module.exports = Entity;