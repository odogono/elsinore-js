var test = require('tape');
var Promise = require('bluebird');

var Elsinore = require('elsinore');

// var Elsinore = Common.Elsinore;
var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;


test('adding an entity with a component', function(t){
    t.ok( true );
    return t.end();
});

test('initialising the indexeddb entity set', function(t){
    t.ok(true, 'all went well');
    return t.end();
});