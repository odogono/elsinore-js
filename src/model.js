'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
let Utils = require('./utils');



let Model = Backbone.Model.extend({
    type: 'Model',
    isModel: true,

    /**
     * Proxies event triggering to the registry
     * @param  {[type]} name [description]
     * @return {[type]}      [description]
     */
    // trigger: function(name){
    //     if( !this.registry ){ return; }
    //     let args = Array.prototype.slice.call(arguments);
    //     args.splice( 1,0, this );
    //     this.registry.trigger.apply( this.registry, args );
    // },

    getRegistry: function(){
        return this.registry;
    },
    
    setRegistry: function(registry){
        this.registry = registry;
    },

    isEqual: function(other){
        return this.hash() === other.hash();
    },

    hash: function( asString ){
        let result = JSON.stringify( this.cid );//_.omit(this.attributes,'hash'));
        return Utils.hash( result, asString );
    },

    toJSON: function( options ){
        let result = _.clone(this.attributes);
        // remove attributes beginning with '_'
        let copy = {};
        for (let key in result) {
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

export default Model;