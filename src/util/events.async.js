'use strict';

let _ = require('underscore');
let Backbone = require('backbone');
let Utils = require('../utils');

let EventsAsync = _.extend({}, Backbone.Events, {

    /**
    *
    */
    stopListening: function( obj, name, callback ){
        Backbone.Events.stopListening.apply( this, arguments );
        delete this._asyncListenQueue;
        this.isListeningAsync = false;
        return this;
    },
    
    /**
    *   
    */
    listenToAsync: function(obj, name, callback){
        let asyncListenQueue = this._asyncListenQueue || (this._asyncListenQueue = []);
        this.isListeningAsync = true;
        // log.debug('registered listenToAsync ' + name + ' to ' + Utils.stringify(obj)  );

        // NOTE: because we use the arguments object, we can't use es6 fat arrows here
        let listenFn = function(){
            // log.debug('listenToAsync recv ' + Utils.stringify(arguments) + ' for name '+ name);
            asyncListenQueue.push( {c:callback, a:_.toArray(arguments),name} );
        };

        // this._asyncListeneners = this._asyncListeneners || (this._asyncListeneners={});
        // this._asyncListeneners[name] = listenFn;

        return this.listenTo( obj, name, listenFn);
    },

    /**
    *   Releases all previously received events
    */
    releaseAsync: function(){
        let item, ii, len, args;
        if(!this._asyncListenQueue) { return this; }
        for( ii = 0, len = this._asyncListenQueue.length; ii < len; ii++ ){
            item = this._asyncListenQueue[ii];
            args = [ item.name ].concat(item.a);
            // log.debug('releasing ' + item.name, Utils.stringify(args) );
            item.c.apply( item.c, args );
        }
        this._asyncListenQueue.length = 0;
        return this;
    },
});

module.exports = EventsAsync;