'use strict';

var _ = require('underscore');
var BitField = require('../bit_field');
var Utils = require('../utils');
var Query = require('../query');
var EntitySet = require('../entity_set');

/**
*   Query functions for the memory based entity set.   
*
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/


_.extend( EntitySet.prototype, {
    query: function( commands, options ){
        return Query.execute( this, commands, options );
    },
});

module.exports = {
    EntitySet: EntitySet,
    Query: Query
}

