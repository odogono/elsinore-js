'use strict';
/*jslint todo: true */

var BitField = require('./bit_field');
var _ = require('underscore');
var Backbone = require('backbone');
var Utils = require('./utils');

var Component = require('./component');
var ElsinoreError = Utils.ElsinoreError;
var Model = require('./model');

/**
 * An entity is a container for components
 */
var Entity = Model.extend({

    setEntityId: function( id ){
        var eid = this.get('eid');
        // the entity id is set as the low 30 bits 
        eid += (id & 0x3fffffff) - (eid & 0x3fffffff);
        // eid += (id & 0xffffff) - (eid & 0xffffff);
        this.set({eid:eid, id:id});
    },

    getEntityId: function(){
        return this.get('eid') & 0x3fffffff;
        // return this.get('id') & 0xffffff;
    },

    setEntitySetId: function( id ){
        var eid = this.get('eid');
        // the entityId is set as the high 20 bits
        this.set( 'eid', (id & 0x3fffff) * 0x40000000 + (eid & 0x3fffffff) );
        // this.set( 'id', (id & 0xffffff) * 0x1000000 + (eid & 0xffffff) );
    },

    getEntitySetId: function(){
        var id = this.get('eid');
        return (id - (id & 0x3fffffff)) / 0x40000000;
        // return (id - (id & 0xffffff)) / 0x1000000;
    },

    setEntitySet: function( es ){
        this._entitySet = es;
        this.setEntitySetId( es.id );
    },

    getEntitySet: function(){
        return this._entitySet;
    },

    

    addComponent: function( component ){
        component.setEntityId( this.getEntityId() );
        this[ component.name ] = component;
        this.components[ component.schemaIId ] = component;
        this.getComponentBitfield().set( component.schemaIId, true );
    },

    removeComponent: function( component ){
        delete this[ component.name ];
        delete this.components[ component.schemaIId ];
        this.getComponentBitfield().set( component.schemaIId, false );
    },

    hasComponent: function( componentIId ){
        return this.getComponentBitfield().get( componentIId );
    },

    hasComponents: function(){
        return _.keys(this.components).length > 0;
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
        return _.keys(this.components).length;
        // return this.getComponentBitfield().count();
    },


    triggerEntityEvent: function( name ){
        var es = this.getEntitySet();
        if( es ){
            es.triggerEntityEvent( this, name );
        }
    },


}, {
    STATUS_ACTIVE: 0,
    STATUS_INACTIVE: 1,
    STATUS_LOGICALLY_DELETED: 2
});

Entity.create = function(entityId, entitySetId){
    var result = new Entity();

    if( _.isUndefined(entityId) ){
        entityId = 0;
    }
    
    if( _.isUndefined(entitySetId) ){
        entitySetId = 0;
    }

    result.components = [];
    result.setEntitySetId( entitySetId );
    result.setEntityId( entityId );
    
    return result;
};

Entity.isEntity = function( entity ){
    return ( entity !== null && typeof entity === 'object' && entity instanceof Entity );
};


Entity.toEntityId = function( entityId ){
    if( Entity.isEntity(entityId) ){
        return entityId.getEntityId();
    }
    return entityId;
};

Entity.toEntity = function( entity, options ){
    var entityId, entitySetId; 
    
    entityId = 0;
    entitySetId = 0;

    if( entity === undefined || Utils.isInteger(entity) ){
        return Entity.create( entity, entitySetId, options );
    }
    if( Entity.isEntity(entity) ){
        return entity;
    }
    if( _.isObject(entity) ){
        if( entity._e ){
            entityId = entity._e;
        }
        if( entity._es ){
            entitySetId = entity._es;
        }
        return Entity.create( entityId, entitySetId, options );
    }
    return null;
};

module.exports = Entity;