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
    type: 'Entity',
    isEntity: true,

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

    destroy: function(){
        if( this._entitySet ){
            this._entitySet.removeEntity( this );
        }
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
        existing = this.components[ component.schemaIId ];
        if( existing ){
            existing.setEntityId( null );
        }
        component.setEntityId( this.getEntityId() );
        this[ component.name ] = component;
        this.components[ component.schemaIId ] = component;
        this.getComponentBitfield().set( component.schemaIId, true );
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
        delete this[ component.name ];
        delete this.components[ component.schemaIId ];
        this.getComponentBitfield().set( component.schemaIId, false );
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


Entity.create = function(entityId, entitySetId){
    var result = new Entity();
    result.cid = Entity.createId();

    if( _.isUndefined(entityId) ){
        entityId = 0;
    }
    
    if( _.isUndefined(entitySetId) ){
        entitySetId = 0;
    }

    result.components = [];
    result.setEntitySetId( entitySetId );
    result.setEntityId( entityId );

    // log.debug('EC ' + result.cid );
    // if( result.cid == 'e66' ){
    //     throw new Error('here');
    // }
    
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
    
    if( Entity.isEntity(entity) ){ return entity; }

    // if( _.isObject(entity) ){
    //     if( entity._e ){
    //         entityId = entity._e;
    //     }
    //     if( entity._es ){
    //         entitySetId = entity._es;
    //     }
    //     return Entity.create( entityId, entitySetId, options );
    // }
    return null;
};

module.exports = Entity;