'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Model = require('./model');
var Utils = require('./utils');

/**
 * Components contain data
 * @type {[type]}
 */
var Component = Model.extend({
    type: 'Component',
    isComponent: true,

    
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

    // toJSON: function(){
    //     var result = Model.prototype.toJSON.apply(this); //_.clone(this.attributes);
    //     result.n = this.name;
    //     result._cid = this.cid;
    //     return result;
    // },
    
    getEntityId: function(){
        return this.get('_e');
    },

    setEntityId: function(id, internalId){
        this.set({'_e':id});
    },

    hash: function(asString){
        var result = Utils.stringify(  _.omit(this.attributes, '_e') );
        // log.debug('hashed ' + result );
        return Utils.hash( result, asString );
    },
});


Component.create = function( attrs, options){
    var com = new Component( attrs, options );
    return com;
};



Component.isComponent = function(obj){
    return obj && obj.isComponent;
};

module.exports = Component;