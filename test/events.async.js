'use strict'

import test from 'tape';
import _ from 'underscore';
let Backbone = require('backbone');
let Common = require('./common');
let EventsAsync = Common.requireLib('util/events.async');
let Utils = Common.requireLib('utils');


// let EventsAsync = _.extend({}, Backbone.Events, {

//     stopListening: function( obj, name, callback ){
//         Backbone.Events.stopListening.apply( this, arguments );
//         delete this._asyncListenQueue;
//     },
    
//     listenToAsync: function(obj, name, callback){
//         let self = this;
//         let asyncListenQueue = this._asyncListenQueue || (this._asyncListenQueue = []);
//         return this.listenTo( obj, name, () => {
//             asyncListenQueue.push( {c:callback, a:_.toArray(arguments)} );
//         });
//     },

//     // triggerAsync: function(name){
//     //     if (!this._events ) { return this; }
//     //     this._asyncEvents || (this._asyncEvents = []);
//     //     this._asyncEvents.push( _.toArray(arguments) );
//     // },

//     /**
//     *   Releases all previously received events
//     */
//     releaseAsync: function(){
//         let item, ii, len;
//         if(!this._asyncListenQueue){ return this; }
//         for( ii = 0, len = this._asyncListenQueue.length; ii < len; ii++ ){
//             item = this._asyncListenQueue[ii];
//             item.c.apply( item.c, item.a );
//         }
//         this._asyncListenQueue.length = 0;
//         return this;
//     },
// });



test('basic', function(t){
    let core = _.extend({}, EventsAsync);
    let bus = _.extend({}, EventsAsync);

    core.listenToAsync( bus, 'all', name => {
        console.log('nailed it ' + name + ' ' + JSON.stringify(_.toArray(arguments).slice(0)) );
    });

    core.listenToAsync( bus, 'doorClose', name => {
        console.log('!closing');
    });

    core.listenToAsync( bus, 'doorOpen', name => {
        console.log('!opening');
    });
    core.listenToAsync( bus, 'doorOpen', name => {
        console.log('!opening2');
    });

    

    // bus.listenToAsync( 'my-event', function(name){
    //     console.log('nailed it async ' + name);
    // });

    // bus.trigger('my-event');
    // bus.trigger('my-event', 22 );
    // bus.trigger('my-event', 'barry');
    // bus.trigger('msg', 'welcome', 'to', 'the', 'stuff' );
    bus.trigger('doorOpen');
    // bus.trigger('close');

    // core.stopListening();
    core.releaseAsync();
    // core.releaseAsync(); // won't release anymore
    // core.releaseAsync();
    // printIns( core );
    // printIns( core );

    t.end();
});