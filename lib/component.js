var _ = require('underscore');
var Backbone = require('backbone');

/**
 * Components contain data
 * @type {[type]}
 */
var Component = Backbone.Model.extend({
    clone: function(){
        var result = new this.constructor(this.attributes);
        result.ComponentDef = this.ComponentDef;
        result.registry = this.registry;
        return result;
    },

    parse: function( resp, options ){
        if( !resp || _.keys(resp).length <= 0 )
            return resp;
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
    },

    getEntityId: function(){
        return this.get('_e');
    },

    setEntityId: function(id){
        this.set('_e',id);
    },
    getRegistry: function(){
        return this.registry;
    },
    setRegistry: function(registry){
        this.registry = registry;
    }
});



Component.getComponentDef = function(com){
    return com ? com.ComponentDef : null;
}

Component.setComponentDef = function(com,def){
    if( com ) com.ComponentDef = def;
}

Component.getComponentDefId = function(com){
    var def = Component.getComponentDef(com);
    return def ? def.id : null;
}

Component.create = function(options){
    var com = new Component();
    return com;
}



Component.isComponent = function(obj){
    return ( obj && _.isObject(obj) && obj instanceof Component );
}

module.exports = Component;