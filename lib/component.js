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
            this.setEntityId( resp.entityId );
            delete resp.entityId;
        }
        if( resp.cdef_id ){
            this._cdefId = resp.cdef_id;
            delete resp.cdef_id;
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
        return this.get('_entityId');
    },

    setEntityId: function(id){
        this.set('_entityId',id);
    },

    /**
    *   Returns the ComponentDef Id
    */
    getDefId: function(){
        return this.ComponentDef ? this.ComponentDef.id : null;
    },

    getComponentDef: function(){
        return this.ComponentDef;
    }
});


Component.create = function(options){
    var com = new Component();
    return com;
}



Component.isComponent = function(obj){
    return ( obj != null && _.isObject(obj) && obj instanceof Component );
}

module.exports = Component;