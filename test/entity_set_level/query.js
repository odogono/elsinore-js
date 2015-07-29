'use strict';

let _ = require('underscore');
let test = require('tape');

let PromiseQ = require('promise-queue');

let Sinon = require('sinon');

import { Common, Elsinore, 
    LevelEntitySet, LU, 
    createEntitySet, printKeys, destroyEntitySet } from './common'

let EntityFilter = Elsinore.EntityFilter;
let EntitySet = Elsinore.EntitySet;
let Entity = Elsinore.Entity;
let Query = Elsinore.Query;
let Registry = Elsinore.Registry;
let Utils = Elsinore.Utils;

test('adding an existing entity doesnt changes its id if it originated from the entityset', t => {
    let registry;
    return createEntitySet( null, {loadComponents:true, loadEntities:'query.entities', debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            let query = Query.all('/component/mode/invite_only');
            // LevelEntitySet.Query.poop();
            let entities = Common.loadEntities(registry, 'query.entities');
            // printE( entities.query( query ) );

            // log.debug('->ldb query');
            return entitySet.query( query, {debug:false} )
                .then( result => {
                    t.ok( EntitySet.isEntitySet(result), 'the result should be an entityset' );
                    t.equals( result.size(), 1, 'there should be a single entity' );
                })
                .then( () => destroyEntitySet(entitySet, true) )
        })
        .then( () => t.end() )
        .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});

// test('entityset filter ALL', t => {
//     initialiseEntitySet().then( ([registry,entitySet]) => {

//         let result = entitySet.query(
//             Query.all('/component/mode/invite_only') );
//         // let result = entitySet.query( 
//         //     [ [ Query.ALL, '/component/mode/invite_only' ] ],
//         //     {debug:false, result:false} );

//         t.ok( EntitySet.isEntitySet(result) );
//         t.ok( result.size(), 1 );

//         t.end();
//     });
// });