var _ = require('underscore');
var Backbone = require('backbone');

/**
 * Components contain data
 * @type {[type]}
 */
var Component = Backbone.Model.extend({
    parse: function( resp, options ){
        if( !resp || _.keys(resp).length <= 0 )
            return resp;
        if( resp.entity_id ){
            this.entityId = resp.entity_id;
            delete resp.entity_id;
        }
        if( resp.entityId ){
            this.entityId = resp.entityId;
            delete resp.entityId;
        }
        return resp;
    },

    toJSON: function( options ){
        var result = Backbone.Model.prototype.toJSON.apply(this,arguments);

        // remove attributes beginning with '_'
        var copy = {};
        for (var key in result) {
            if(key[0] != '_' ){
                copy[key] = result[key];
            }
        }
        return copy;
    }
});


var create = function(options){
    var com = new Component();
    return com;
}



var isComponent = function(obj){
    return ( obj != null && _.isObject(obj) && obj instanceof Component );
}


module.exports = {
    Model: Component,
    isComponent: isComponent,
    create: create
}