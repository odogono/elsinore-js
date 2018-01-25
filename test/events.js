'use strict'

import test from 'tape';
import _ from 'underscore';
// import Common  from './common';
// import Base from '../src/base';
import Events from '../src/util/events';
// import EventsAsync from '../src/util/events.async';
import {createLog} from '../src/util/log';

const Log = createLog('TestEvents');



test('listenTo', t => {
    const object = Object.create(Events);
    const subject = Object.create(Events);

    let eventCount = 0;
    
    object.listenTo( subject, 'door', arg => eventCount++);

    subject.emit('door', 'open');

    object.stopListening();

    subject.emit('door', 'close');

    t.equals( eventCount, 1 );

    t.end();
});

test('listenToAsync', t => {
    const object = Object.create(Events);
    const subject = Object.create(Events);

    let eventCount = 0;

    object.listenToAsync( subject, 'all', arg => eventCount++);

    subject.trigger('door', 'open');

    subject.trigger('go', 'north');

    subject.trigger('door', 'close');

    t.equals( eventCount, 0 );

    object.releaseAsync();

    t.equals( eventCount, 3 );

    t.end();
});

// test('basic', function(t){
//     let core = Object.assign({}, EventsAsync);
//     let bus = Object.assign({}, EventsAsync);

//     core.listenToAsync( bus, 'all', name => {
//         console.log('nailed it ' + name + ' ' + JSON.stringify(_.toArray(arguments).slice(0)) );
//     });

//     core.listenToAsync( bus, 'doorClose', name => {
//         console.log('!closing');
//     });

//     core.listenToAsync( bus, 'doorOpen', name => {
//         console.log('!opening');
//     });
//     core.listenToAsync( bus, 'doorOpen', name => {
//         console.log('!opening2');
//     });

    

//     // bus.listenToAsync( 'my-event', function(name){
//     //     console.log('nailed it async ' + name);
//     // });

//     // bus.trigger('my-event');
//     // bus.trigger('my-event', 22 );
//     // bus.trigger('my-event', 'barry');
//     // bus.trigger('msg', 'welcome', 'to', 'the', 'stuff' );
//     bus.trigger('doorOpen');
//     // bus.trigger('close');

//     // core.stopListening();
//     core.releaseAsync();
//     // core.releaseAsync(); // won't release anymore
//     // core.releaseAsync();
//     // printIns( core );
//     // printIns( core );

//     t.end();
// });