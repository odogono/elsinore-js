// var BitArray = require('bit-array');
var BitField = require('./bit_field');
var _ = require('underscore');
var Backbone = require('backbone');
var Utils = require('./utils');
var ComponentDef = require('./component_def');
var Component = require('./component');
var ElsinoreError = Utils.ElsinoreError;


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
    // addComponent: function( componentDef, callback ){
    //     return this.registry.addComponent( componentDef, this, callback );
    // },

    /**
     * Returns true if this entity has the specified component type
     * 
     * @param  {[type]} type [description]
     * @return {[type]}      [description]
     */
    // hasComponent: function( component ){
    //     return this.registry.doesEntityHaveComponent( this, component );
    // },

    /**
     * Removes a component from this entity
     * A convenience function which delegates to EntityManager
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    // removeComponent: function( component, callback ){
    //     return this.registry.removeComponent( component, this, callback );
    // },

    /**
     * Returns a component from this entity.
     * Better to use an EntitySet for this type of query.
     * 
     * @param  {[type]} component [description]
     * @return {[type]}           [description]
     */
    // getComponent: function( component, options, callback ){
    //     if( _.isFunction(options) ){
    //         callback = options; options = {};
    //     }
    //     return this.registry.getEntityComponent( this, component, options, callback );
    // },

    /**
     * Returns all components on this entity
     * 
     * @return {[type]} [description]
     */
    // getComponents: function(){
    //     return [];
    // },

    addComponent: function( component ){
        var self = this;
        if( _.isArray(component) ){
            return _.each( component, function(com){
                return self.addComponent( com );
            })
        }
        var componentDef = Component.getComponentDef( component );
        var bf = this.getComponentBitfield();
        var componentDefId = componentDef.id;

        // log.debug('addCD bf ' + componentDefId + ' ' + componentDef.id );
        bf.set( componentDefId, true );

        // decorate the entity with the entity name
        this[ componentDef.getName() ] = component;
        this.components[ componentDefId ] = component;

        return this;
    },

    getComponent: function( componentDef ){
        var bf = this.getComponentBitfield();
        var componentDefId = ComponentDef.getId( componentDef );
        if( !componentDefId )
            return null;
        return this.components[ componentDefId ];
    },

    removeComponent: function( component ){
        var componentDef = Component.getComponentDef( component );
        var bf = this.getComponentBitfield();
        var componentDefId = componentDef.id;

        bf.set( componentDefId, false );

        delete this[ componentDef.getName() ];
        delete this.components[ componentDef.id ];

        return this;
    },

    hasComponent: function( componentDef ){
        var bf = this.getComponentBitfield();
        var componentDefId = ComponentDef.getId( componentDef );
        
        return bf.get( componentDefId );
    },

    hasComponents: function(){
        var bf = this.getComponentBitfield();
        return bf.count() > 0;
    },

    getComponentBitfield: function(){
        var bf = this.get('comBf');
        if( !bf ){
            // TODO : the size must be configured from somewhere - otherwise will run out of space
            bf = BitField.create();
            this.set('comBf', bf);
        }
        return bf;
    },

    /**
    *   The number of components on this entity
    */
    getComponentCount: function(){
        return this.getComponentBitfield().count();
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
        // if( resp.component_bf ){
        //     if( _.isString(resp.component_bf) && resp.component_bf.indexOf('0x') == 0 )
        //         resp.component_bf = resp.component_bf.substring(2);
        //     resp.component_bf = new BitArray(64, resp.component_bf);
        // }
        return resp;
    },

    toJSON: function(){
        var result = _.clone(this.attributes);
        if( this.id )
            result.id = this.id;
        // result.component_bf = result.component_bf.toHexString();
        return result;
    }

}, {
    STATUS_ACTIVE: 0,
    STATUS_INACTIVE: 1,
    STATUS_LOGICALLY_DELETED: 2
});

Entity.create = function(id, options){
    var result = new Entity();
    result._debug_is_entity = true;
    result.components = [];
    result.set({id:id});//, 'component_bf': new BitArray(64)});
    return result;
};

Entity.parse = function( resp ){
    var result = Entity.create();
    result.set( resp, {parse:true} );
    return result;
};

Entity.isValid = function( entity ){
    return entity && utils.isInteger(entity.id);
}

Entity.isEntity = function( entity ){
    if( entity != null && typeof entity === 'object' && entity instanceof Entity ){
        return true;
    }
    return false;
};

Entity.toEntity = function( entity ){
    if( entity === undefined || Utils.isInteger(entity) ){
        return Entity.create( entity, null );
    }
    if( Entity.isEntity(entity) ){
        return entity;
    }
    return null;
};

module.exports = Entity;