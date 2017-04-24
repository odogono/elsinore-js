import {Events} from 'odgn-backbone-model';
import stringify from './stringify';

/**
*   An event listener which captures incoming events and
*   only releases them when instructed to.
*/
const EventsAsync = Object.assign({}, Events, {

    /**
    *
    */
    stopListening: function( obj, name, callback ){
        Events.stopListening.apply( this, arguments );
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
        // console.log('[EventsAsync][listenToAsync] registered listenToAsync', name, 'to', obj.cid, stringify(obj)  );

        // NOTE: because we use the arguments object, we can't use es6 fat arrows here
        let listenFn = function(...args){
            // console.log('[EventsAsync][listenToAsync] recv ' + stringify(arguments) + ' for name '+ name);
            asyncListenQueue.push( {c:callback, a:args,name} );
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
            args = [item.name].concat(item.a);
            // console.log('[EventsAsync][releaseAsync] releasing', item.name, JSON.stringify(args) );
            item.c.apply( item.c, args );
        }
        this._asyncListenQueue.length = 0;
        return this;
    },
});

// module.exports = EventsAsync;
export default EventsAsync;