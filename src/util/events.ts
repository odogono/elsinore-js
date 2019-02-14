import { uniqueID } from './unique_id';

// Backbone.Events
// ---------------

// A module that can be mixed in to *any object* in order to provide it with
// a custom event channel. You may bind a callback to an event with `on` or
// remove with `off`; `trigger`-ing an event fires all callbacks in
// succession.
//
//     let object = {};
//     Object.assign(object, Events);
//     object.on('expand', function(){ alert('expanded'); });
//     object.trigger('expand');
//
// https://github.com/jashkenas/backbone
// Copyright (c) 2010-2017 Jeremy Ashkenas, DocumentCloud

// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

// export let Events = {};



// Regular expression used to split event strings.
let eventSplitter:RegExp = /\s+/;

export class Events {

    _listeningTo:object;
    _listenID:string;

    _events;

    _listeners;

    _asyncListenQueue;

    _isListeningAsync:boolean;


    _isReleasingEvents: boolean = false;

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on(name:string, callback:Function, context?) {
        return internalOn(this, name, callback, context);
    }

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off(name:string, callback:Function, context?) {
        if (!this._events) return this;
        this._events = eventsApi(offApi, this._events, name, callback, {
            context: context,
            listeners: this._listeners
        });
        return this;
    }

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger(name, ...params) {
        if (!this._events) return this;

        let length = Math.max(0, params.length - 1);
        let args = Array(length);
        for (let i = 0; i < length; i++) args[i] = params[i + 1];

        eventsApi(triggerApi, this._events, name, void 0, args);
        return this;
    }

    // Inversion-of-control versions of `on`. Tell *this* object to listen to
    // an event in another object... keeping track of what it's listening to
    // for easier unbinding later.
    listenTo(obj, name:string, callback) {
        if (!obj) return this;
        let id = obj._listenID || (obj._listenID = <string>uniqueID('l'));
        let listeningTo = this._listeningTo || (this._listeningTo = {});
        let listening = listeningTo[id];

        // This object is not listening to any other events on `obj` yet.
        // Setup the necessary references to track the listening callbacks.
        if (!listening) {
            let thisID = this._listenID || (this._listenID = <string>uniqueID('l'));
            listening = listeningTo[id] = { obj: obj, objID: id, id: thisID, listeningTo: listeningTo, count: 0 };
        }

        // Bind callbacks on obj, and keep track of them on listening.
        internalOn(obj, name, callback, this, listening);
        return this;
    }

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening(obj?, name?:string, callback?) {
        let listeningTo = this._listeningTo;
        if (!listeningTo) return this;

        if( !obj ){
            // TODO: improve this simplistic implementation
            delete this._asyncListenQueue;
            this._isListeningAsync = false;
        }

        let ids = obj ? [obj._listenID] : Object.keys(listeningTo);

        for (let i = 0; i < ids.length; i++) {
            let listening = listeningTo[ids[i]];

            // If listening doesn't exist, this object is not currently
            // listening to obj. Break out early.
            if (!listening) break;

            listening.obj.off(name, callback, this);
        }

        return this;
    }

    /**
     * Listen to another object, but keep the received events until releaseAsync is called
     * @param {*} obj 
     * @param {*} name 
     * @param {*} callback 
     */
    listenToAsync(obj, name, callback) {
        let asyncListenQueue = this._asyncListenQueue || (this._asyncListenQueue = []);
        this._isListeningAsync = true;
        // console.log('[EventsAsync][listenToAsync] registered listenToAsync', name, 'to', obj.cid, stringify(obj)  );

        let listenFn = (...args) => {
            // console.log('[EventsAsync][listenToAsync] recv ' + stringify(arguments) + ' for name '+ name);
            asyncListenQueue.push({ c: callback, a: args, name });
        };

        // this._asyncListeneners = this._asyncListeneners || (this._asyncListeneners={});
        // this._asyncListeneners[name] = listenFn;

        return this.listenTo(obj, name, listenFn);
    }

    /**
     * Releases all previously received events
     */
    releaseAsync() {
        let item, ii, len, args;
        if (!this._asyncListenQueue) {
            return this;
        }
        this._isReleasingEvents = true;
        for (ii = 0, len = this._asyncListenQueue.length; ii < len; ii++) {
            item = this._asyncListenQueue[ii];
            args = [item.name].concat(item.a);
            // console.log('[EventsAsync][releaseAsync] releasing', item.name, JSON.stringify(args) );
            item.c.apply(item.c, args);
        }
        this._asyncListenQueue.length = 0;
        this._isReleasingEvents = false;
        return this;
    }

    isReleasingEvents() : boolean {
        return this._isReleasingEvents;
    }
}


// Iterates over the standard `event, callback` (as well as the fancy multiple
// space-separated events `"change blur", callback` and jQuery-style event
// maps `{event: callback}`).
let eventsApi = function(iteratee, events, name, callback, opts) {
    let i = 0,
        names;
    if (name && typeof name === 'object') {
        // Handle event maps.
        if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
        for (names = Object.keys(name); i < names.length; i++) {
            events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
        }
    } else if (name && eventSplitter.test(name)) {
        // Handle space-separated event names by delegating them individually.
        for (names = name.split(eventSplitter); i < names.length; i++) {
            events = iteratee(events, names[i], callback, opts);
        }
    } else {
        // Finally, standard events.
        events = iteratee(events, name, callback, opts);
    }
    return events;
};



// Guard the `listening` argument from the public API.
let internalOn = function(obj, name, callback, context, listening?) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
        context: context,
        ctx: obj,
        listening: listening
    });

    if (listening) {
        let listeners = obj._listeners || (obj._listeners = {});
        listeners[listening.id] = listening;
    }

    return obj;
};

;

// The reducing API that adds a callback to the `events` object.
let onApi = function(events, name, callback, options) {
    if (callback) {
        let handlers = events[name] || (events[name] = []);
        let context = options.context,
            ctx = options.ctx,
            listening = options.listening;
        if (listening) listening.count++;

        handlers.push({ callback: callback, context: context, ctx: context || ctx, listening: listening });
    }
    return events;
};





// The reducing API that removes a callback from the `events` object.
let offApi = function(events, name, callback, options) {
    if (!events) return;

    let i = 0,
        listening;
    let context = options.context,
        listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
        let ids = Object.keys(listeners);
        for (; i < ids.length; i++) {
            listening = listeners[ids[i]];
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objID];
        }
        return;
    }

    let names = name ? [name] : Object.keys(events);
    for (; i < names.length; i++) {
        name = names[i];
        let handlers = events[name];

        // Bail out if there are no events stored.
        if (!handlers) break;

        // Replace events if there are any remaining.  Otherwise, clean up.
        let remaining = [];
        for (let j = 0; j < handlers.length; j++) {
            let handler = handlers[j];
            if (
                (callback && callback !== handler.callback && callback !== handler.callback._callback) ||
                (context && context !== handler.context)
            ) {
                remaining.push(handler);
            } else {
                listening = handler.listening;
                if (listening && --listening.count === 0) {
                    delete listeners[listening.id];
                    delete listening.listeningTo[listening.objID];
                }
            }
        }

        // Update tail event if the list has any events.  Otherwise, clean up.
        if (remaining.length) {
            events[name] = remaining;
        } else {
            delete events[name];
        }
    }
    return events;
};



// Handles triggering the appropriate event callbacks.
let triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
        let events = objEvents[name];
        let allEvents = objEvents.all;
        if (events && allEvents) allEvents = allEvents.slice();
        if (events) triggerEvents(events, args);
        if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
};

// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
let triggerEvents = function(events, args) : void {
    let ev,
        i = -1,
        l = events.length,
        a1 = args[0],
        a2 = args[1],
        a3 = args[2];
    switch (args.length) {
        case 0:
            while (++i < l) (ev = events[i]).callback.call(ev.ctx);
            return;
        case 1:
            while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1);
            return;
        case 2:
            while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2);
            return;
        case 3:
            while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
            return;
        default:
            while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
            return;
    }
};
