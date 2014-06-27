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
        if( BitField.isBitField(componentDef) ){
            return bf.and(null,componentDef);
        }
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

    clone: function(){
        var comClone;
        var result = Entity.create( this.attributes );
        // clone each of the attached components
        for( var comId in this.components ){
            comClone = this.components[comId].clone();
            result.addComponent( comClone );
        }
        result.registry = this.registry;
        return result;
    },

    toJSON: function(){
        var result = _.clone(this.attributes);
        if( this.id )
            result.id = this.id;
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
    if( _.isObject(id) )
        result.set(id);
    else
        result.set({id:id});
    return result;
};

// Entity.parse = function( resp ){
//     var result = Entity.create();
//     result.set( resp, {parse:true} );
//     return result;
// };

// Entity.isValid = function( entity ){
//     return entity && utils.isInteger(entity.id);
// }

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
    if( _.isObject(entity) ){
        return Entity.create( entity );
    }
    return null;
};

module.exports = Entity;