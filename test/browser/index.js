'use strict';

window.log = {
    error: (...args) => {
        console.error.apply(console, args);
    },
}

var _ = window._ = require('underscore');
var Backbone = window.Backbone = require('backbone');

var test = require('tape').test;
var Sinon = require('sinon');
var report = require('browserify-tape-spec');

var _ = require('underscore');
var Path = require('path');
var Elsinore = window.Elsinore = require('elsinore');
var Common = require('./common');

// console.log('Elsinore: ');
// console.log( Elsinore );

// require('../entity')( test, Common, Elsinore );
require('../entity');
require('../cmd_buffer_async');

require('./entity_set.indexeddb');

require('../cmd_buffer_async');

test.createStream().pipe(report('out'));