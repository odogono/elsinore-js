'use strict'

import test from 'tape';
import _ from 'underscore';
import {Events} from 'odgn-backbone-model';
import Common  from './common';

import EventsAsync from '../src/util/events.async';
import Utils from '../src/util';


test('basic', function(t){
    let core = Object.assign({}, EventsAsync);
    let bus = Object.assign({}, EventsAsync);

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