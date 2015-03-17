'use strict'

var test = require('tape');
var _ = require('underscore');
var Backbone = require('backbone');

var Common = require('./common');

var EventsAsync = _.extend({}, Backbone.Events, {

    stopListening: function( obj, name, callback ){
        Backbone.Events.stopListening.apply( this, arguments );
        delete this._asyncListenQueue;
    },
    
    listenToAsync: function(obj, name, callback){
        var self = this;
        var asyncListenQueue = this._asyncListenQueue || (this._asyncListenQueue = []);
        return this.listenTo( obj, name, function(){
            asyncListenQueue.push( {c:callback, a:_.toArray(arguments)} );
        });
    },

    // triggerAsync: function(name){
    //     if (!this._events ) { return this; }
    //     this._asyncEvents || (this._asyncEvents = []);
    //     this._asyncEvents.push( _.toArray(arguments) );
    // },

    /**
    *   Releases all previously received events
    */
    releaseAsync: function(){
        var item, i,l;
        if(!this._asyncListenQueue) return this;
        for( i = 0, l = this._asyncListenQueue.length; i < l; i++ ){
            item = this._asyncListenQueue[i];
            item.c.apply( item.c, item.a );
        }
        this._asyncListenQueue.length = 0;
        return this;
    },
});


test('basic', function(t){
    var core = _.extend({}, EventsAsync);
    var bus = _.extend({}, EventsAsync);

    core.listenToAsync( bus, 'all', function(name){
        console.log('nailed it ' + name + ' ' + JSON.stringify(_.toArray(arguments).slice(0)) );
    });

    // bus.onAsync( 'my-event', function(name){
    //     console.log('nailed it async ' + name);
    // });

    // bus.trigger('my-event');
    bus.trigger('my-event', 22 );
    bus.trigger('my-event', 'barry');
    bus.trigger('msg', 'welcome', 'to', 'the', 'stuff' );

    core.stopListening();
    core.releaseAsync();
    // core.releaseAsync(); // won't release anymore
    // core.releaseAsync();
    // printIns( core );
    // printIns( core );

    t.end();
});