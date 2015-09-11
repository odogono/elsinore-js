import _ from 'underscore';
import Backbone from 'backbone';
import Model from './model';
import * as Utils from './utils';

/**
 * Components contain data
 * @type {[type]}
 */
var Component = Model.extend({
    type: 'Component',
    isComponent: true,

    parse: function( resp ){
        var esId = 0, eId = 0;
        if( !resp || _.keys(resp).length <= 0 ){
            return resp;
        }
        if( resp._es ){
            esId = resp._es;
            delete resp._es;
        }
        if( resp._e ){
            eId = resp._e;
            // delete resp._e;
        }
        if( esId || eId ){
            // log.debug('creating from ' + eId + ' ' + esId );
            resp._e = Utils.setEntityIdFromId(eId, esId);
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

    getSchemaId: function(){
        return this.get('_s');
    },
    setSchemaId: function(id){
        this.set({'_s':id});
    },

    hash: function(asString){
        let result = Utils.Stringify(  _.omit(this.attributes, '_e','_es','_s') );
        return Utils.hash( result, asString );
    },
});


Component.create = function( attrs, options){
    var com;
    com = new Component( attrs, options );
    return com;
};



Component.isComponent = function(obj){
    return obj && obj.isComponent;
};

module.exports = Component;