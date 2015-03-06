'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Utils = require('./utils');

var Model = Backbone.Model.extend({
    type: 'Model',
    isModel: true,

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

    getRegistry: function(){
        return this.registry;
    },
    
    setRegistry: function(registry){
        this.registry = registry;
    },

    isEqual: function(other){
        return this.hash() === other.hash();
    },

    hash: function(options){
        var result = JSON.stringify(this.toJSON());
        return Utils.hash( result, true );
    },

    toJSON: function( options ){
        var result = _.clone(this.attributes);
        // remove attributes beginning with '_'
        var copy = {};
        for (var key in result) {
            if(key[0] != '_' ){
                copy[key] = result[key];
            }
        }
        if( this.id ){
            result.id = this.id;
        }
        return copy;
    },
});

module.exports = Model;