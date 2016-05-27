const _ = require('underscore');
var test = require('tape');

var Elsinore = require('elsinore');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;


function goodwork( t, res ){
    return new Promise( (resolve,reject) => {
        _.delay( () => {
            t.equals( res, 'that', 'ooh dear');
            return resolve(true);
        },1000);
    })
    
}

test.skip('adding an entity with a component', function(t){
    t.plan(3);

    return goodwork(t, 'that').
        then( () => {
            console.log('good work');
            t.ok( true );
            t.equals( 'this', 'that', 'this should equal that' );
            t.end();
        });

    // _.delay( () => {
        
    //     // return t.end();    
    // }, 1000 );
});

test('initialising the indexeddb entity set', t => {
    t.ok(true, 'all went well');
    return t.end();
});
