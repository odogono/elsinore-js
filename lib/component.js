'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Model = require('./model');

/**
 * Components contain data
 * @type {[type]}
 */
var Component = Model.extend({
    isComponent: function(){
        return true;
    },

    parse: function( resp ){
        if( !resp || _.keys(resp).length <= 0 ){
            return resp;
        }
        if( resp.entity_id ){
            this.setEntityId( resp.entity_id );
            delete resp.entity_id;
        }
        if( resp.entityId ){
            this.setEntityId( resp.entityId );
            delete resp.entityId;
        }
        return resp;
    },
    
    getEntityId: function(){
        return this.get('_e');
    },

    setEntityId: function(id){
        this.set('_e',id);
    }
});


Component.create = function( attrs, options){
    var com = new Component( attrs, options );
    return com;
};



Component.isComponent = function(obj){
    return ( obj && _.isObject(obj) && obj instanceof Component );
};

module.exports = Component;