'use strict';

var _ = require('underscore');
var Backbone = require('backbone');

var EventsAsync = _.extend({}, Backbone.Events, {

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
        var self = this;
        var asyncListenQueue = this._asyncListenQueue || (this._asyncListenQueue = []);
        this.isListeningAsync = true;
        return this.listenTo( obj, name, function(){
            // log.debug('listenToAsync recv ' + JSON.stringify(arguments) );
            asyncListenQueue.push( {c:callback, a:_.toArray(arguments)} );
        });
    },

    /**
    *   Releases all previously received events
    */
    releaseAsync: function(){
        var item, i,l;
        if(!this._asyncListenQueue) { return this; }
        for( i = 0, l = this._asyncListenQueue.length; i < l; i++ ){
            item = this._asyncListenQueue[i];
            // log.debug('releasing ' + JSON.stringify(item.a) );
            item.c.apply( item.c, item.a );
        }
        this._asyncListenQueue.length = 0;
        return this;
    },
});

module.exports = EventsAsync;