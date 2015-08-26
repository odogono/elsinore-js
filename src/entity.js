'use strict';
/*jslint todo: true */

var BitField = require('./bit_field');
var _ = require('underscore');
var Backbone = require('backbone');
var Utils = require('./utils');

var Component = require('./component');
var ElsinoreError = Utils.ElsinoreError;
var Model = require('./model');


var ENTITY_ID_MAX = Math.pow(2,31)-1;
var ENTITY_SET_ID_MAX = Math.pow(2,21)-1;


/**
 * An entity is a container for components
 */
var Entity = Model.extend({
    type: 'Entity',
    isEntity: true,

    isNew: function() {
        return this.get('id') === 0;
    },

    setId: function( entityId, entitySetId ){
        if( entitySetId !== undefined ){
            entityId = Utils.setEntityIdFromId( entityId, entitySetId );
        }
        this.set({id: entityId});
        var components = this.getComponents();
        _.each( components, component => component.setEntityId( entityId ) );
    },

    setEntityId: function( id ){
        var eid = this.get('id');
        // // the entity id is set as the low 30 bits 
        // // eid += (id & 0x3fffffff) - (eid & 0x3fffffff);
        // the entity id is set as the low 32 bits 
        eid += (id & 0xffffffff) - (eid & 0xffffffff);
        this.set({id:eid});
    },

    getEntityId: function(){
        // return this.get('eid') & 0x3fffffff;
        return this.get('id') & 0xffffffff;
    },

    setEntitySetId: function( id ){
        var eid = this.get('id');
        // the es id is set as the high 21 bits
        // this.set( 'eid', (id & 0x3fffff) * 0x40000000 + (eid & 0x3fffffff) );
        eid = (id & 0x1fffff) * 0x100000000 +    (eid & 0xffffffff);
        this.set({id:eid});
    },

    getEntitySetId: function(){
        var id = this.get('id');
        // return (id - (id & 0x3fffffff))  / 0x40000000;
        return    (id - (id & 0xffffffff)) /  0x100000000;
    },

    setEntitySet: function( es ){
        this._entitySet = es;
        this.setEntitySetId( es.id );
    },

    getEntitySet: function(){
        return this._entitySet;
    },

    destroy: function(){
        if( this._entitySet ){
            this._entitySet.removeEntity( this );
        }
    },

    toJSON: function(){
        return {
            id: this.id,
            eid: this.getEntityId(),
            esid: this.getEntitySetId(),
            bf: this.getComponentBitfield().toString()
        };
    },

    hash: function(asString){
        var result = 0;
        for( var sid in this.components ){
            result += this.components[sid].hash(true);
        }
        if( result === 0 ){ return 0; }
        return Utils.hash( result, asString );
    },

    addComponent: function( component ){
        var existing;
        existing = this.components[ component.getSchemaId() ];
        if( existing ){
            existing.setEntityId( null );
        }
        component.setEntityId( this.id );
        component._entity = this;
        this[ component.name ] = component;
        this.components[ component.getSchemaId() ] = component;
        this.getComponentBitfield().set( component.getSchemaId(), true );
        return this;
    },

    getComponents: function( componentIds ){
        var components = this.components;
        componentIds = componentIds || this.getComponentBitfield().toValues();
        return _.reduce( componentIds, function(result,id){
            var com = components[id];
            if( com ){ result.push( com ); }
            return result;
        }, []);
    },

    removeComponent: function( component ){
        if( !component ){ return this; }
        component.setEntityId( null );
        component._entity = null;
        delete this[ component.name ];
        delete this.components[ component.getSchemaId() ];
        this.getComponentBitfield().set( component.getSchemaId(), false );
        return this;
    },

    getComponentByIId: function( iid ){
        var self = this;
        if( _.isArray(iid) ) {
            return _.map( iid, function( id ){
                return self.components[id];
            });
        }
        return this.components[ iid ];
    },

    hasComponent: function( componentIId ){
        if( Component.isComponent(componentIId) ){
            componentIId = componentIId.getSchemaId();
        }
        return this.getComponentBitfield().get( componentIId );
    },

    hasComponents: function(){
        return _.keys(this.components).length > 0;
    },

    getComponentBitfield: function(){
        var bf = this.get('comBf');
        if( !bf ){
            // TODO: the size must be configured from somewhere - otherwise will run out of space
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


    triggerEntityEvent: function(){
        var es = this.getRegistry();// this.getEntitySet();
        var args = _.toArray( arguments );
        args.splice(1, 0, this);
        // args.unshift( this );
        // printIns( args,1 );
        if( es ){
            // so we end up passing evtName, recipientEntity, ... 
            es.triggerEntityEvent.apply( es, args );
        }
    },


}, {
    STATUS_ACTIVE: 0,
    STATUS_INACTIVE: 1,
    STATUS_LOGICALLY_DELETED: 2
});

Entity.createId = function(){
    return _.uniqueId('e');
}


// Entity.getEntityIdFromId = function( id ){
//     return (id & 0xffffffff);
// }

// Entity.getEntitySetIdFromId = function( id ){
//     return (id - (id & 0xffffffff)) /  0x100000000;
// }

// Entity.setEntityIdFromId = function( eid, esid ){
//     return (esid & 0x1fffff) * 0x100000000 + (eid & 0xffffffff);
// }


Entity.create = function(entityId, entitySetId){
    var result = new Entity();
    result.cid = Entity.createId();

    if( _.isUndefined(entityId) ){
        entityId = 0;
    }
    
    // if( _.isUndefined(entitySetId) ){
    //     entitySetId = 0;
    // }

    result.components = [];
    result.setId( entityId, entitySetId );
    // entityId = Utils.setEntityIdFromId( entityId, entitySetId );
    // result.set({id: entityId});

    // result.setEntitySetId( entitySetId );
    // result.setEntityId( entityId );
    
    return result;
};

Entity.isEntity = function( entity ){
    return entity && entity.isEntity;
};

Entity.isEntityId = function( id ){
    return Utils.isInteger( id );
}

Entity.getEntityId = function( entity ){
    if( entity && entity.getEntityId ){
        return entity.getEntityId();
    }
    return null;
}

Entity.toEntityId = function( entityId ){
    if( Entity.isEntity(entityId) ){
        return entityId.id;//getEntityId();
    }
    return entityId;
};

Entity.toEntity = function( entity, options ){
    var entityId;//, entitySetId; 
    
    entityId = (entity === undefined) ? 0 : entity;
    // entitySetId = 0;

    if( Utils.isInteger(entityId) ){
        return Entity.create( entityId, options );
    }
    
    if( Entity.isEntity(entity) ){ return entity; }



    return null;
};

module.exports = Entity;